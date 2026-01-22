const REDIRECT_MAX_HOPS = 5;
const DEFAULT_TIMEOUT_MS = 8_000;

const VERTEX_GROUNDING_HOST = 'vertexaisearch.cloud.google.com';
const VERTEX_GROUNDING_PATH_PREFIX = '/grounding-api-redirect/';

const cache = new Map<string, string>();

export function isVertexGroundingRedirect(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.toLowerCase() === VERTEX_GROUNDING_HOST &&
      parsed.pathname.startsWith(VERTEX_GROUNDING_PATH_PREFIX)
    );
  } catch {
    return false;
  }
}

function resolveUrl(base: string, location: string): string {
  try {
    return new URL(location, base).toString();
  } catch {
    return location;
  }
}

async function fetchRedirectLocation(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        // Some endpoints behave differently without a UA.
        'User-Agent': 'aionda-content-tools/1.0',
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) return resolveUrl(url, location);
    }

    // Fallback: try GET (some servers don't support HEAD correctly)
    if (response.status === 405 || response.status === 400) {
      const getResponse = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'aionda-content-tools/1.0',
        },
      });
      if (getResponse.status >= 300 && getResponse.status < 400) {
        const location = getResponse.headers.get('location');
        if (location) return resolveUrl(url, location);
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function resolveRedirectUrl(
  url: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, maxHops = REDIRECT_MAX_HOPS } = {}
): Promise<string> {
  const cached = cache.get(url);
  if (cached) return cached;

  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    const next = await fetchRedirectLocation(current, timeoutMs);
    if (!next) break;
    if (next === current) break;
    current = next;
    // Stop early once we’ve exited the Vertex redirect domain.
    if (!isVertexGroundingRedirect(current)) break;
  }

  cache.set(url, current);
  return current;
}

export async function normalizeSourceUrl(url: string): Promise<string> {
  if (!url) return url;
  if (!isVertexGroundingRedirect(url)) return url;
  return resolveRedirectUrl(url);
}

export function clearUrlNormalizeCache(): void {
  cache.clear();
}

