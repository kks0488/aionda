const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function sanitizeHref(href?: string | null): string | undefined {
  if (typeof href !== 'string') return undefined;

  const trimmed = href.trim();
  if (!trimmed) return undefined;

  // Allow relative paths and anchors
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol.toLowerCase())) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}
