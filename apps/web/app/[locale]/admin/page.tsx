import AdminPanel from '@/components/AdminPanel';
import type { Locale } from '@/i18n';

export default function AdminPage({ params }: { params: { locale: Locale } }) {
  return <AdminPanel locale={params.locale} />;
}
