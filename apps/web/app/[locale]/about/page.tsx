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
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-8">{t('title')}</h1>

      <div className="prose prose-lg dark:prose-invert">
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('whatWeDoTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('whatWeDo')}</p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('missionTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('mission')}</p>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('verificationTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('verification')}</p>
          <ul className="mt-4 space-y-2 text-muted-foreground">
            <li>{t('verificationStep1')}</li>
            <li>{t('verificationStep2')}</li>
            <li>{t('verificationStep3')}</li>
            <li>{t('verificationStep4')}</li>
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4">{t('contactTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t('contact')}: <a href="mailto:contact@aionda.blog" className="text-accent hover:underline">contact@aionda.blog</a>
          </p>
        </section>
      </div>
    </div>
  );
}
