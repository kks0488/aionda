import type { NextAuthOptions, Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import GitHubProvider from 'next-auth/providers/github';

function normalizeLogin(login?: string | null): string {
  return String(login || '').trim().toLowerCase();
}

export function getAllowedAdminGitHubUsers(): string[] {
  return String(process.env.ADMIN_GITHUB_USERS || '')
    .split(',')
    .map((value) => normalizeLogin(value))
    .filter(Boolean);
}

export function isAllowedAdminGitHubUser(login?: string | null): boolean {
  const normalized = normalizeLogin(login);
  if (!normalized) return false;
  return getAllowedAdminGitHubUsers().includes(normalized);
}

export function hasAdminGitHubOAuthConfig(): boolean {
  return (
    String(process.env.NEXTAUTH_SECRET || '').trim().length > 0 &&
    String(process.env.ADMIN_GITHUB_CLIENT_ID || '').trim().length > 0 &&
    String(process.env.ADMIN_GITHUB_CLIENT_SECRET || '').trim().length > 0 &&
    getAllowedAdminGitHubUsers().length > 0
  );
}

export function getAdminGitHubLoginFromSession(session: Session | null): string | null {
  const sessionUser = session?.user as Session['user'] & { login?: string } | undefined;
  return normalizeLogin(sessionUser?.login || sessionUser?.name || null) || null;
}

export function isAdminGitHubSession(session: Session | null): boolean {
  return isAllowedAdminGitHubUser(getAdminGitHubLoginFromSession(session));
}

export const adminAuthOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  providers: [
    GitHubProvider({
      clientId: process.env.ADMIN_GITHUB_CLIENT_ID || 'missing-client-id',
      clientSecret: process.env.ADMIN_GITHUB_CLIENT_SECRET || 'missing-client-secret',
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      const githubProfile = profile as { login?: string } | undefined;
      const login = typeof githubProfile?.login === 'string' ? githubProfile.login : null;
      return isAllowedAdminGitHubUser(login);
    },
    async jwt({ token, profile }) {
      const githubProfile = profile as { login?: string } | undefined;
      if (typeof githubProfile?.login === 'string') {
        token.login = normalizeLogin(githubProfile.login);
      }
      return token;
    },
    async session({ session, token }) {
      const login = typeof token.login === 'string' ? normalizeLogin(token.login) : '';
      if (session.user && login) {
        (session.user as typeof session.user & { login?: string }).login = login;
        if (!session.user.name) {
          session.user.name = login;
        }
      }
      return session;
    },
  },
};

export function getAdminSession() {
  return getServerSession(adminAuthOptions);
}
