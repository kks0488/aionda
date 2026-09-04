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
import { PUT } from '@/app/api/admin/posts/[slug]/route';

const ORIGINAL_ENV = { ...process.env };

describe('admin post write routes', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.ADMIN_ENABLED = 'true';
    process.env.ADMIN_ALLOWED_HOSTS = 'localhost';
    process.env.NEXTAUTH_SECRET = 'nextauth-secret';
    process.env.ADMIN_GITHUB_CLIENT_ID = 'github-client-id';
    process.env.ADMIN_GITHUB_CLIENT_SECRET = 'github-client-secret';
    process.env.ADMIN_GITHUB_USERS = 'admin-user';
    delete process.env.VERCEL_ENV;
    getServerSession.mockReset();
    getServerSession.mockResolvedValue({ user: { name: 'admin-user', login: 'admin-user' } });
  });

  afterEach(() => {
    clearAdminRateLimits();
    process.env = { ...ORIGINAL_ENV };
  });

  it('rate limits repeated write attempts', async () => {
    for (let index = 0; index < 20; index += 1) {
      const request = new NextRequest('http://localhost/api/admin/posts/missing-post?locale=ko', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'vitest-write-rate-limit',
        },
        body: JSON.stringify({ title: 'Updated title' }),
      });

      const response = await PUT(request, { params: { slug: 'missing-post' } });
      expect(response.status).toBe(404);
    }

    const blockedRequest = new NextRequest('http://localhost/api/admin/posts/missing-post?locale=ko', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'vitest-write-rate-limit',
      },
      body: JSON.stringify({ title: 'Updated title' }),
    });

    const blockedResponse = await PUT(blockedRequest, { params: { slug: 'missing-post' } });
    expect(blockedResponse.status).toBe(429);
    expect(blockedResponse.headers.get('Retry-After')).toBeTruthy();
  });
});
