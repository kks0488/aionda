import { beforeEach, describe, expect, it } from 'vitest';
import {
  getAdminGitHubLoginFromSession,
  getAllowedAdminGitHubUsers,
  hasAdminGitHubOAuthConfig,
  isAdminGitHubSession,
  isAllowedAdminGitHubUser,
} from '@/lib/admin-auth';

const ORIGINAL_ENV = { ...process.env };

describe('admin auth helpers', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.NEXTAUTH_SECRET = 'nextauth-secret';
    process.env.ADMIN_GITHUB_CLIENT_ID = 'github-client-id';
    process.env.ADMIN_GITHUB_CLIENT_SECRET = 'github-client-secret';
    process.env.ADMIN_GITHUB_USERS = 'admin-user,second-admin';
  });

  it('parses allowed GitHub users', () => {
    expect(getAllowedAdminGitHubUsers()).toEqual(['admin-user', 'second-admin']);
    expect(isAllowedAdminGitHubUser('Admin-User')).toBe(true);
    expect(isAllowedAdminGitHubUser('outsider')).toBe(false);
  });

  it('detects GitHub OAuth configuration', () => {
    expect(hasAdminGitHubOAuthConfig()).toBe(true);
    delete process.env.ADMIN_GITHUB_CLIENT_SECRET;
    expect(hasAdminGitHubOAuthConfig()).toBe(false);
  });

  it('accepts only allowlisted GitHub sessions', () => {
    const allowedSession = { user: { name: 'Admin User', login: 'admin-user' } } as any;
    const blockedSession = { user: { name: 'Outsider', login: 'outsider' } } as any;

    expect(getAdminGitHubLoginFromSession(allowedSession)).toBe('admin-user');
    expect(isAdminGitHubSession(allowedSession)).toBe(true);
    expect(isAdminGitHubSession(blockedSession)).toBe(false);
  });
});
