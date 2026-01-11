import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import AdminPanel from '@/components/AdminPanel';
import { isLocalHost, isLocalOnlyEnabled } from '@/lib/admin';
import type { Locale } from '@/i18n';

export default function AdminPage({ params }: { params: { locale: Locale } }) {
  if (isLocalOnlyEnabled()) {
    const headersList = headers();
    const host = headersList.get('x-forwarded-host') ?? headersList.get('host');
    if (!isLocalHost(host)) {
      notFound();
    }
  }

  return <AdminPanel locale={params.locale} />;
}
