import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getServerSession } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
}));

vi.mock('next-auth', async () => {
  const actual = await vi.importActual<typeof import('next-auth')>('next-auth');
  return {
    ...actual,
    getServerSession,
  };
});

import { clearAdminRateLimits } from '@/lib/admin';
import { GET } from '@/app/api/admin/posts/route';

const ORIGINAL_ENV = { ...process.env };

describe('admin posts route', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.ADMIN_ENABLED = 'true';
    process.env.ADMIN_ALLOWED_HOSTS = 'localhost';
    process.env.ADMIN_PUBLISH_ENABLED = 'false';
    process.env.NEXTAUTH_SECRET = 'nextauth-secret';
    process.env.ADMIN_GITHUB_CLIENT_ID = 'github-client-id';
    process.env.ADMIN_GITHUB_CLIENT_SECRET = 'github-client-secret';
    process.env.ADMIN_GITHUB_USERS = 'admin-user';
    getServerSession.mockReset();
  });

  afterEach(() => {
    clearAdminRateLimits();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects unauthenticated admin requests', async () => {
    getServerSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/admin/posts?locale=ko');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('allows allowlisted GitHub sessions', async () => {
    getServerSession.mockResolvedValue({ user: { name: 'admin-user', login: 'admin-user' } });

    const request = new NextRequest('http://localhost/api/admin/posts?locale=ko');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.posts)).toBe(true);
    expect(data.capabilities.canPublish).toBe(false);
  });
});
