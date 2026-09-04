import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearAdminRateLimits,
  consumeAdminRateLimit,
  canAdminWriteLocally,
  getAdminConfigError,
  getAllowedAdminHosts,
  isAdminEnabled,
  isAllowedAdminHost,
  hasAdminRateLimitStore,
  normalizeHost,
} from '@/lib/admin';

const ORIGINAL_ENV = { ...process.env };

describe('admin helpers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.ADMIN_ENABLED = 'true';
    process.env.ADMIN_ALLOWED_HOSTS = 'localhost,admin.internal';
    process.env.NEXTAUTH_SECRET = 'nextauth-secret';
    process.env.ADMIN_GITHUB_CLIENT_ID = 'github-client-id';
    process.env.ADMIN_GITHUB_CLIENT_SECRET = 'github-client-secret';
    process.env.ADMIN_GITHUB_USERS = 'admin-user';
    delete process.env.VERCEL_ENV;
  });

  afterEach(() => {
    clearAdminRateLimits();
    process.env = { ...ORIGINAL_ENV };
  });

  it('normalizes hostnames and ports', () => {
    expect(normalizeHost('LOCALHOST:3000')).toBe('localhost');
    expect(normalizeHost('[::1]:3000')).toBe('::1');
  });

  it('uses explicit allowlist hosts only', () => {
    expect(getAllowedAdminHosts()).toEqual(['localhost', 'admin.internal']);
    expect(isAllowedAdminHost('localhost:3000')).toBe(true);
    expect(isAllowedAdminHost('10.0.0.5')).toBe(false);
  });

  it('defaults admin enabled outside production', () => {
    delete process.env.ADMIN_ENABLED;
    process.env = { ...process.env, NODE_ENV: 'development' };
    expect(isAdminEnabled()).toBe(true);
    process.env = { ...process.env, NODE_ENV: 'production' };
    expect(isAdminEnabled()).toBe(false);
  });

  it('reports missing admin config before login flow starts', () => {
    delete process.env.ADMIN_GITHUB_CLIENT_ID;
    expect(getAdminConfigError({ requireGitHubAuth: true })).toBe(
      'Admin GitHub OAuth not configured'
    );
  });

  it('requires a persistent rate limit store for production admin', () => {
    process.env = { ...process.env, NODE_ENV: 'production' };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    expect(hasAdminRateLimitStore()).toBe(false);
    expect(getAdminConfigError({ requireRateLimitStore: true })).toBe(
      'Admin rate limit store not configured'
    );
  });

  it('keeps local writes enabled only outside hosted production', () => {
    expect(canAdminWriteLocally()).toBe(true);
    process.env.VERCEL_ENV = 'production';
    expect(canAdminWriteLocally()).toBe(false);
  });
  it('limits repeated admin login attempts', async () => {
    const request = new NextRequest('http://localhost/api/admin/session', {
      headers: { 'user-agent': 'vitest' },
    });

    for (let index = 0; index < 5; index += 1) {
      expect((await consumeAdminRateLimit('login', request)).allowed).toBe(true);
    }

    const blocked = await consumeAdminRateLimit('login', request);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });
});
