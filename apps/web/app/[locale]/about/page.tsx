import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Locale } from '@/i18n';

const BASE_URL = 'https://aionda.blog';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'about' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/about`,
      languages: {
        'en': `${BASE_URL}/en/about`,
        'ko': `${BASE_URL}/ko/about`,
      },
    },
  };
}

export default async function AboutPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'about' });

  return (
    <div className="bg-white dark:bg-[#101922] min-h-screen">
      {/* Header */}
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {t('title')}
          </h1>
        </div>
      </section>

      {/* Content */}
      <main className="w-full max-w-3xl mx-auto px-6 py-12">
        <div className="prose prose-lg dark:prose-invert space-y-10">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('whatWeDoTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('whatWeDo')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('missionTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('mission')}</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('verificationTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t('verification')}</p>
            <ul className="mt-4 space-y-2 text-slate-600 dark:text-slate-300 list-disc pl-5">
              <li>{t('verificationStep1')}</li>
              <li>{t('verificationStep2')}</li>
              <li>{t('verificationStep3')}</li>
              <li>{t('verificationStep4')}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-slate-900 dark:text-white">{t('contactTitle')}</h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('contact')}: <a href="mailto:contact@aionda.blog" className="text-primary hover:underline">contact@aionda.blog</a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
