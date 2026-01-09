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
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('lastUpdated')}: 2025-01-10</p>

      <div className="prose prose-lg dark:prose-invert space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('introTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('intro')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('collectTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">{t('collectIntro')}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>{t('collectItem1')}</li>
            <li>{t('collectItem2')}</li>
            <li>{t('collectItem3')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('useTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">{t('useIntro')}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>{t('useItem1')}</li>
            <li>{t('useItem2')}</li>
            <li>{t('useItem3')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('cookiesTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('cookies')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('thirdPartyTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed mb-4">{t('thirdParty')}</p>
          <ul className="space-y-2 text-muted-foreground">
            <li>Google Analytics - {t('analytics')}</li>
            <li>Google AdSense - {t('advertising')}</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('rightsTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('rights')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('contactTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t('contact')}: <a href="mailto:privacy@aionda.blog" className="text-accent hover:underline">privacy@aionda.blog</a>
          </p>
        </section>
      </div>
    </div>
  );
}
