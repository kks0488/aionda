import { getTranslations, setRequestLocale } from 'next-intl/server';

const BASE_URL = 'https://aionda.blog';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'terms' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/terms`,
      languages: {
        'en': `${BASE_URL}/en/terms`,
        'ko': `${BASE_URL}/ko/terms`,
      },
    },
  };
}

export default async function TermsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'terms' });

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold mb-4">{t('title')}</h1>
      <p className="text-muted-foreground mb-8">{t('lastUpdated')}: 2025-01-10</p>

      <div className="prose prose-lg dark:prose-invert space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('acceptanceTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('acceptance')}</p>
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
          <h2 className="text-2xl font-semibold mb-4">{t('contentTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('content')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('disclaimerTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('disclaimer')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('intellectualTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('intellectual')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('limitationTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('limitation')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('changesTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">{t('changes')}</p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">{t('contactTitle')}</h2>
          <p className="text-muted-foreground leading-relaxed">
            {t('contact')}: <a href="mailto:legal@aionda.blog" className="text-accent hover:underline">legal@aionda.blog</a>
          </p>
        </section>
      </div>
    </div>
  );
}
