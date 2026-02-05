import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPostSummaries } from '@/lib/posts';
import PostCard from '@/components/PostCard';
import type { Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';

function normalizeQuery(value: unknown): string {
  return String(value || '').trim();
}

function matches(post: { title: string; description: string; tags: string[] }, q: string) {
  const query = q.toLowerCase();
  if (!query) return true;
  if (post.title.toLowerCase().includes(query)) return true;
  if (post.description.toLowerCase().includes(query)) return true;
  return (post.tags || []).some((tag) => String(tag || '').toLowerCase().includes(query));
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const title = locale === 'ko' ? '검색' : 'Search';
  const description = locale === 'ko' ? '아티클을 검색합니다.' : 'Search articles.';

  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${BASE_URL}/${locale}/search`,
      languages: {
        en: `${BASE_URL}/en/search`,
        ko: `${BASE_URL}/ko/search`,
      },
    },
  };
}

export default function SearchPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { q?: string };
}) {
  setRequestLocale(locale);

  const typedLocale = locale as Locale;
  const q = normalizeQuery(searchParams?.q);
  const posts = getPostSummaries(typedLocale);
  const results = q ? posts.filter((post) => matches(post, q)) : [];

  return (
    <div className="bg-white dark:bg-[#101922] min-h-screen">
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <Link href={`/${locale}`} className="text-primary hover:underline">
              {locale === 'ko' ? '홈' : 'Home'}
            </Link>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-slate-900 dark:text-white">{locale === 'ko' ? '검색' : 'Search'}</span>
          </div>

          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            {locale === 'ko' ? '검색' : 'Search'}
          </h1>

          <form
            action={`/${locale}/search`}
            method="get"
            className="mt-6 flex flex-col sm:flex-row gap-3 max-w-2xl"
            data-analytics-event="search_open"
            data-analytics-params={JSON.stringify({ from: 'search_page', locale })}
          >
            <input
              name="q"
              defaultValue={q}
              placeholder={locale === 'ko' ? '검색어를 입력하세요…' : 'Type to search…'}
              className="flex-1 h-11 px-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-slate-900/40 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="submit"
              className="h-11 px-5 rounded-lg bg-primary text-white font-bold shadow-sm hover:opacity-95 transition-opacity"
              data-analytics-event="search_result_click"
              data-analytics-params={JSON.stringify({ from: 'search_page_submit', locale })}
            >
              {locale === 'ko' ? '검색' : 'Search'}
            </button>
          </form>

          {q && (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {locale === 'ko'
                ? `"${q}" 검색 결과: ${results.length}개`
                : `Results for "${q}": ${results.length}`}
            </p>
          )}
        </div>
      </section>

      <main className="w-full max-w-7xl mx-auto px-6 py-12">
        {q ? (
          results.length > 0 ? (
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {results.map((post) => (
                <PostCard key={post.slug} post={post} locale={typedLocale} variant="medium" />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                {locale === 'ko' ? '검색 결과가 없습니다' : 'No results found'}
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              {locale === 'ko' ? '검색어를 입력하세요' : 'Start typing to search'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
