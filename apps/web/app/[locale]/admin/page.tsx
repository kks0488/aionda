import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import AdminPanel from '@/components/AdminPanel';
import {
  canAdminWriteLocally,
  canRenderAdminPage,
  getAdminConfigError,
  isAdminPublishEnabled,
} from '@/lib/admin';
import { getAdminGitHubLoginFromSession, getAdminSession, isAdminGitHubSession } from '@/lib/admin-auth';
import type { Locale } from '@/i18n';

export default async function AdminPage({ params }: { params: { locale: Locale } }) {
  const host = headers().get('host');
  if (!canRenderAdminPage(host)) {
    notFound();
  }

  const configError = getAdminConfigError({
    requireGitHubAuth: true,
    requireRateLimitStore: true,
  });

  if (configError) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-6 py-5 text-amber-950">
          <h1 className="text-xl font-semibold">Admin configuration error</h1>
          <p className="mt-2 text-sm">{configError}</p>
          <p className="mt-2 text-sm">
            Set the required admin environment variables before using this page.
          </p>
        </div>
      </div>
    );
  }

  const session = await getAdminSession();
  const initialAuthenticated = isAdminGitHubSession(session);
  const initialUserLogin = getAdminGitHubLoginFromSession(session);

  return (
    <AdminPanel
      locale={params.locale}
      initialAuthenticated={initialAuthenticated}
      initialUserLogin={initialUserLogin}
      initialCapabilities={{
        canLocalWrite: canAdminWriteLocally(),
        canPublish: isAdminPublishEnabled(),
      }}
    />
  );
}
