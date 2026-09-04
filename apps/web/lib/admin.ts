import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';
import { getAdminSession, hasAdminGitHubOAuthConfig, isAdminGitHubSession } from '@/lib/admin-auth';

export const ADMIN_RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

const DEFAULT_ADMIN_HOSTS = ['localhost', '127.0.0.1', '::1'];
const RATE_LIMITS = {
  login: { limit: 5, windowMs: 10 * 60 * 1000 },
  write: { limit: 20, windowMs: 10 * 60 * 1000 },
} as const;

type RateLimitScope = keyof typeof RATE_LIMITS;
type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
  resetAt: number;
};

type AdminGlobal = typeof globalThis & {
  __aiondaAdminRateLimitStore?: Map<string, RateLimitBucket>;
  __aiondaAdminRedis?: Redis;
};

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function normalizeHost(rawHost?: string | null): string {
  if (!rawHost) return '';
  const trimmed = rawHost.trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    if (end !== -1) {
      return trimmed.slice(1, end);
    }
  }
  return trimmed.split(':')[0] || '';
}

export function adminJson(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(ADMIN_RESPONSE_HEADERS);
  if (init.headers) {
    const incoming = new Headers(init.headers);
    incoming.forEach((value, key) => headers.set(key, value));
  }

  return Response.json(data, { ...init, headers });
}

export function isAdminEnabled(): boolean {
  return parseBoolean(process.env.ADMIN_ENABLED, process.env.NODE_ENV !== 'production');
}

export function isAdminPublishEnabled(): boolean {
  return process.env.ADMIN_PUBLISH_ENABLED === 'true';
}

export function getAllowedAdminHosts(): string[] {
  const raw = process.env.ADMIN_ALLOWED_HOSTS;
  const hosts = (raw || DEFAULT_ADMIN_HOSTS.join(','))
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean);

  return hosts.length > 0 ? Array.from(new Set(hosts)) : [...DEFAULT_ADMIN_HOSTS];
}

export function isAllowedAdminHost(hostname?: string | null): boolean {
  const normalized = normalizeHost(hostname);
  if (!normalized) return false;
  return getAllowedAdminHosts().includes(normalized);
}

export function getRequestHost(request: NextRequest): string {
  return normalizeHost(request.nextUrl.hostname || request.headers.get('host'));
}

export function hasAdminRateLimitStore(): boolean {
  return (
    String(process.env.UPSTASH_REDIS_REST_URL || '').trim().length > 0 &&
    String(process.env.UPSTASH_REDIS_REST_TOKEN || '').trim().length > 0
  );
}

function requiresPersistentAdminRateLimit(): boolean {
  return isAdminEnabled() && process.env.NODE_ENV === 'production';
}

export function getAdminConfigError(
  options: {
    requireGitHubAuth?: boolean;
    requireRateLimitStore?: boolean;
  } = {}
): string | null {
  if (!isAdminEnabled()) return null;
  if (options.requireGitHubAuth && !hasAdminGitHubOAuthConfig()) {
    return 'Admin GitHub OAuth not configured';
  }
  if (
    options.requireRateLimitStore &&
    requiresPersistentAdminRateLimit() &&
    !hasAdminRateLimitStore()
  ) {
    return 'Admin rate limit store not configured';
  }
  return null;
}

function timingSafeEqual(a: string, b: string): boolean {
  const aDigest = crypto.createHash('sha256').update(a).digest();
  const bDigest = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aDigest, bDigest);
}

export function canAdminWriteLocally(): boolean {
  return !process.env.VERCEL_ENV || process.env.VERCEL_ENV === 'development';
}

export function requireAdminHost(request: NextRequest): Response | null {
  if (!isAdminEnabled()) {
    return adminJson({ error: 'Not found' }, { status: 404 });
  }

  if (!isAllowedAdminHost(getRequestHost(request))) {
    return adminJson({ error: 'Not found' }, { status: 404 });
  }

  return null;
}

export async function requireAdminSession(request: NextRequest): Promise<Response | null> {
  const hostError = requireAdminHost(request);
  if (hostError) return hostError;

  const configError = getAdminConfigError({
    requireGitHubAuth: true,
    requireRateLimitStore: true,
  });
  if (configError) {
    return adminJson({ error: configError }, { status: 500 });
  }

  const session = await getAdminSession();
  if (!isAdminGitHubSession(session)) {
    return adminJson({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function getRateLimitStore(): Map<string, RateLimitBucket> {
  const adminGlobal = globalThis as AdminGlobal;
  if (!adminGlobal.__aiondaAdminRateLimitStore) {
    adminGlobal.__aiondaAdminRateLimitStore = new Map<string, RateLimitBucket>();
  }
  return adminGlobal.__aiondaAdminRateLimitStore;
}

function getAdminRedis(): Redis | null {
  if (!hasAdminRateLimitStore()) return null;

  const adminGlobal = globalThis as AdminGlobal;
  if (!adminGlobal.__aiondaAdminRedis) {
    adminGlobal.__aiondaAdminRedis = Redis.fromEnv();
  }
  return adminGlobal.__aiondaAdminRedis;
}

function getRateLimitKey(scope: RateLimitScope, request: NextRequest): string {
  const forwardedFor = String(request.headers.get('x-forwarded-for') || '')
    .split(',')[0]
    ?.trim();
  const realIp = String(request.headers.get('x-real-ip') || '').trim();
  const userAgent = String(request.headers.get('user-agent') || 'unknown').slice(0, 160);
  const fingerprint = realIp || forwardedFor || `${getRequestHost(request)}|${userAgent}`;
  return `${scope}:${fingerprint}`;
}

export function clearAdminRateLimits(): void {
  getRateLimitStore().clear();
}

function consumeAdminRateLimitInMemory(
  scope: RateLimitScope,
  request: NextRequest,
  now = Date.now()
): RateLimitResult {
  const config = RATE_LIMITS[scope];
  const key = getRateLimitKey(scope, request);
  const store = getRateLimitStore();
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const next: RateLimitBucket = {
      count: 1,
      resetAt: now + config.windowMs,
    };
    store.set(key, next);
    return {
      allowed: true,
      limit: config.limit,
      remaining: Math.max(config.limit - next.count, 0),
      retryAfter: 0,
      resetAt: next.resetAt,
    };
  }

  existing.count += 1;
  store.set(key, existing);

  const remaining = Math.max(config.limit - existing.count, 0);
  const retryAfter = existing.count > config.limit
    ? Math.max(Math.ceil((existing.resetAt - now) / 1000), 1)
    : 0;

  return {
    allowed: existing.count <= config.limit,
    limit: config.limit,
    remaining,
    retryAfter,
    resetAt: existing.resetAt,
  };
}

export async function consumeAdminRateLimit(
  scope: RateLimitScope,
  request: NextRequest,
  now = Date.now()
): Promise<RateLimitResult> {
  const redis = getAdminRedis();
  if (!redis) {
    return consumeAdminRateLimitInMemory(scope, request, now);
  }

  const config = RATE_LIMITS[scope];
  const key = `aionda:admin:ratelimit:${getRateLimitKey(scope, request)}`;
  const count = Number(await redis.incr(key));

  if (count === 1) {
    await redis.expire(key, Math.ceil(config.windowMs / 1000));
  }

  let ttlSeconds = Number(await redis.ttl(key));
  if (ttlSeconds < 0) {
    await redis.expire(key, Math.ceil(config.windowMs / 1000));
    ttlSeconds = Math.ceil(config.windowMs / 1000);
  }

  const remaining = Math.max(config.limit - count, 0);
  const retryAfter = count > config.limit ? Math.max(ttlSeconds, 1) : 0;

  return {
    allowed: count <= config.limit,
    limit: config.limit,
    remaining,
    retryAfter,
    resetAt: now + Math.max(ttlSeconds, 0) * 1000,
  };
}

export async function getAdminRateLimitResponse(
  scope: RateLimitScope,
  request: NextRequest
): Promise<Response | null> {
  let result: RateLimitResult;
  try {
    result = await consumeAdminRateLimit(scope, request);
  } catch {
    return adminJson(
      { error: 'Admin rate limit unavailable' },
      { status: 503 }
    );
  }

  if (result.allowed) return null;

  return adminJson(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'RateLimit-Limit': String(result.limit),
        'RateLimit-Remaining': String(result.remaining),
        'RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}

export function canRenderAdminPage(hostname?: string | null): boolean {
  if (!isAdminEnabled()) return false;
  return isAllowedAdminHost(hostname);
}
