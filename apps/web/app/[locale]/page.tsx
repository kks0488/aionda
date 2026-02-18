import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPostSummaries } from '@/lib/posts';
import HomeContent from '@/components/HomeContent';
import NewsletterSignup from '@/components/NewsletterSignup';
import type { Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages: {
        en: `${BASE_URL}/en`,
        ko: `${BASE_URL}/ko`,
      },
    },
  };
}

export default function HomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);

  const posts = getPostSummaries(locale as Locale);
  const postCount = posts.length;
  const latestPostDate =
    posts.length > 0 ? new Date(posts[0].date) : null;
  const latestPostDateLabel =
    latestPostDate && !Number.isNaN(latestPostDate.getTime())
      ? latestPostDate.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

  return (
    <div className="bg-white dark:bg-[#101922] text-slate-900 dark:text-white min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full px-6 pt-16 pb-14 lg:pt-24 lg:pb-20 overflow-hidden">
        {/* Background atmosphere */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[420px] bg-[radial-gradient(closest-side,rgba(13,127,242,0.35),rgba(13,127,242,0))] blur-2xl" />
          <div className="absolute inset-0 opacity-[0.18] dark:opacity-[0.22]" style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.35) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse at 50% 30%, black 40%, transparent 75%)',
          }} />
        </div>

        <div className="relative max-w-6xl mx-auto text-center">
          <h1 className="mt-6 text-5xl md:text-7xl font-bold tracking-tighter leading-[1.05]">
            {locale === 'ko' ? (
              <>
                가장 빠른 AI 신호, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                  가장 단단한 근거.
                </span>
              </>
            ) : (
              <>
                Intelligence, <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                  Accelerated.
                </span>
              </>
            )}
          </h1>

          <p className="mt-6 text-lg md:text-xl text-slate-600 dark:text-slate-300 font-light max-w-2xl mx-auto leading-relaxed">
            {locale === 'ko'
              ? '한국 테크 커뮤니티의 신호를 가장 먼저 포착하고, 공식/신뢰 소스로 교차검증해 “지금 필요한 것”만 정리합니다.'
              : 'We catch early signals, then triangulate with trusted sources to publish what actually matters.'}
          </p>

          <div className="mt-8 text-sm text-slate-600 dark:text-slate-300">
            {locale === 'ko' ? (
              <>
                <span className="font-semibold text-slate-900 dark:text-white">{postCount}</span>개 아티클 ·
                {latestPostDateLabel ? <> 업데이트 {latestPostDateLabel}</> : <>매일 업데이트</>}
              </>
            ) : (
              <>
                <span className="font-semibold text-slate-900 dark:text-white">{postCount}</span> articles ·
                {latestPostDateLabel ? <> Updated {latestPostDateLabel}</> : <> Daily updates</>}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <HomeContent posts={posts} locale={locale as Locale} />

      <div className="w-full max-w-7xl mx-auto px-6 pb-16">
        <NewsletterSignup locale={locale as Locale} from="home" />
      </div>
    </div>
  );
}
