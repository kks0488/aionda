import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPosts } from '@/lib/posts';
import PostCard from '@/components/PostCard';
import Sidebar from '@/components/Sidebar';
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
  const featuredPosts = posts.slice(0, 2);
  const gridPosts = posts.slice(2, 6);
  const trendingPosts = [...posts].sort((a, b) =>
    (b.verificationScore || 0) - (a.verificationScore || 0)
  ).slice(0, 4);

  return (
    <div className="bg-white dark:bg-[#101922] text-slate-900 dark:text-white min-h-screen">
      {/* Hero Section */}
      <section className="relative w-full py-20 lg:py-32 px-6 flex flex-col items-center justify-center text-center">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
            Intelligence, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              Accelerated.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-light max-w-xl mx-auto">
            {locale === 'ko'
              ? 'AGI 시대를 향한 AI 인사이트. 한국 테크 커뮤니티에서 검증된 정보.'
              : 'Daily curated insights into the era of AGI. Tracking the asymptotic curve of human progress.'}
          </p>
          <div className="pt-6 w-full max-w-md mx-auto">
            <div className="flex w-full items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
              <input
                type="email"
                placeholder={locale === 'ko' ? '이메일을 입력하세요...' : 'Enter your email for updates...'}
                className="flex-1 border-none bg-transparent px-4 py-3 text-sm focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:text-white"
              />
              <button className="px-6 py-3 bg-primary text-white text-sm font-bold hover:bg-blue-600 transition-colors">
                {locale === 'ko' ? '구독' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="w-full max-w-7xl mx-auto px-6 pb-20">
        {/* Category Chips */}
        <div className="flex flex-wrap gap-2 mb-12 justify-center lg:justify-start">
          <button className="px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium transition-transform hover:scale-105">
            {locale === 'ko' ? '최신' : 'Latest'}
          </button>
          <button className="px-4 py-2 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors">
            AGI
          </button>
          <button className="px-4 py-2 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors">
            LLM
          </button>
          <button className="px-4 py-2 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors">
            Robotics
          </button>
          <button className="px-4 py-2 rounded-full bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors">
            Hardware
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Article Feed (Left 8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-16">
            {/* Featured Articles */}
            {featuredPosts.map((post) => (
              <PostCard key={post.slug} post={post} locale={locale as Locale} variant="large" />
            ))}

            {/* Grid of smaller articles */}
            {gridPosts.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                {gridPosts.map((post) => (
                  <PostCard key={post.slug} post={post} locale={locale as Locale} variant="small" />
                ))}
              </div>
            )}

            {/* Load More */}
            {posts.length > 6 && (
              <div className="flex justify-center pt-8">
                <Link
                  href={`/${locale}/posts`}
                  className="px-8 py-3 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-bold text-sm"
                >
                  {locale === 'ko' ? '더 보기' : 'Load More Articles'}
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar (Right 4 cols) */}
          <div className="lg:col-span-4">
            <Sidebar locale={locale as Locale} trendingPosts={trendingPosts} />
          </div>
        </div>
      </main>
    </div>
  );
}
