import { getTranslations, setRequestLocale } from 'next-intl/server';

const BASE_URL = 'https://aionda.blog';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'privacy' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/privacy`,
      languages: {
        'en': `${BASE_URL}/en/privacy`,
        'ko': `${BASE_URL}/ko/privacy`,
      },
    },
  };
}

export default async function PrivacyPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'privacy' });

  return (
    <div className="bg-white dark:bg-[#101922] min-h-screen">
      {/* Header */}
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400">{t('lastUpdated')}: 2025-01-10</p>
        </div>
      </section>

      {/* Content */}
      <main className="w-full max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-lg dark:prose-invert space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('introTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('intro')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('collectTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{t('collectIntro')}</p>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>{t('collectItem1')}</li>
              <li>{t('collectItem2')}</li>
              <li>{t('collectItem3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('useTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{t('useIntro')}</p>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>{t('useItem1')}</li>
              <li>{t('useItem2')}</li>
              <li>{t('useItem3')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('cookiesTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('cookies')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('thirdPartyTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed mb-4">{t('thirdParty')}</p>
            <ul className="space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>Google Analytics - {t('analytics')}</li>
              <li>Google AdSense - {t('advertising')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('rightsTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('rights')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('contactTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('contact')}: <a href="mailto:privacy@aionda.blog" className="text-primary hover:underline">privacy@aionda.blog</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
