import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPosts } from '@/lib/posts';
import HomeContent from '@/components/HomeContent';
import SearchDataSetter from '@/components/SearchDataSetter';
import type { Locale } from '@/i18n';

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

export default function HomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);

  const posts = getPosts(locale as Locale);
  const postCount = posts.length;
  const searchPosts = posts.map(({ slug, title, description, tags }) => ({
    slug,
    title,
    description,
    tags,
  }));

  return (
    <div className="bg-white dark:bg-[#101922] text-slate-900 dark:text-white min-h-screen">
      {/* Set posts for search */}
      <SearchDataSetter posts={searchPosts} locale={locale as Locale} />

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
          <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-slate-900/40 backdrop-blur px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="material-symbols-outlined text-[16px] text-primary icon-filled" aria-hidden="true">verified</span>
            {locale === 'ko'
              ? `최신 신호 + 근거 기반 리서치 · 총 ${postCount}개 아티클`
              : `Signals + source-backed research · ${postCount} articles`}
          </div>

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

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/${locale}/posts`}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-primary text-white font-bold shadow-sm hover:opacity-95 transition-opacity w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-[18px] icon-filled" aria-hidden="true">bolt</span>
              {locale === 'ko' ? '최신 글 보기' : 'Read Latest'}
            </Link>
            <Link
              href={`/${locale}/tags`}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-slate-900/40 backdrop-blur text-slate-900 dark:text-white font-bold hover:border-gray-300 dark:hover:border-gray-600 transition-colors w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">tag</span>
              {locale === 'ko' ? '태그로 탐색' : 'Explore Tags'}
            </Link>
            <a
              href="/feed.xml"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-slate-900/40 backdrop-blur text-slate-700 dark:text-slate-200 font-bold hover:border-gray-300 dark:hover:border-gray-600 hover:text-primary transition-colors w-full sm:w-auto"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">rss_feed</span>
              RSS
            </a>
          </div>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-5xl mx-auto text-left">
            <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-slate-900/30 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary icon-filled" aria-hidden="true">trending_up</span>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {locale === 'ko' ? 'K‑AI Pulse' : 'K‑AI Pulse'}
                </h2>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {locale === 'ko'
                  ? '국내에서 가장 빠른 커뮤니티 신호를 잡고, “지금 왜 중요한지”만 짧게 정리합니다.'
                  : 'Fast signal briefs with a crisp “why it matters” angle.'}
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-slate-900/30 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary icon-filled" aria-hidden="true">shield</span>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {locale === 'ko' ? '근거 기반' : 'Source‑Backed'}
                </h2>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {locale === 'ko'
                  ? '커뮤니티 글은 반드시 공식/신뢰 링크로 교차검증합니다. “근거 없는 단정”을 줄입니다.'
                  : 'Community signals are triangulated with trusted references.'}
              </p>
            </div>
            <div className="p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-slate-900/30 backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary icon-filled" aria-hidden="true">menu_book</span>
                <h2 className="font-bold text-slate-900 dark:text-white">
                  {locale === 'ko' ? '검색형 가이드' : 'Evergreen Guides'}
                </h2>
              </div>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {locale === 'ko'
                  ? 'RAG·에이전트·보안·운영처럼 “검색해서 들어오는” 주제를 Pillar/Explainer로 쌓습니다.'
                  : 'SEO‑friendly explainers on RAG, agents, safety, and ops.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <HomeContent posts={posts} locale={locale as Locale} />
    </div>
  );
}
