import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/i18n';
import { fontVariables } from '@/lib/fonts';
import { ThemeProvider } from '@/components/ThemeProvider';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import GoogleAdSense from '@/components/GoogleAdSense';
import SearchProvider from '@/components/SearchProvider';
import MobileNav from '@/components/MobileNav';
import { BASE_URL } from '@/lib/site';
import AnalyticsEvents from '@/components/AnalyticsEvents';
import { safeJsonLd } from '@/lib/json-ld';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}#organization`,
    name: 'Aionda',
    alternateName: 'AI온다',
    url: BASE_URL,
    logo: {
      '@type': 'ImageObject',
      url: `${BASE_URL}/api/og-default`,
    },
  };

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${BASE_URL}#website`,
    name: 'Aionda',
    url: BASE_URL,
    publisher: { '@id': `${BASE_URL}#organization` },
    inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BASE_URL}/${locale}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <head>
        <GoogleAnalytics />
        <GoogleAdSense />
        <script
          id="ld-org"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }}
        />
        <script
          id="ld-website"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-white dark:bg-[#101922] text-slate-900 dark:text-white antialiased overflow-x-hidden font-body">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <SearchProvider locale={locale as Locale}>
              <AnalyticsEvents />
              <Header locale={locale as Locale} />
              <main className="flex-1">
                {children}
              </main>
              <Footer />
              <MobileNav locale={locale as Locale} />
            </SearchProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
