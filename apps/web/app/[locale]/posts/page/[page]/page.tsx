import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';
import { deriveSeries, getPostSummaries } from '@/lib/posts';
import PostCard from '@/components/PostCard';
import SearchDataSetter from '@/components/SearchDataSetter';
import Pagination from '@/components/Pagination';
import { DEFAULT_PAGE_SIZE, getTotalPages, parsePageParam, sliceForPage } from '@/lib/pagination';
import type { Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';
import { buildBreadcrumbJsonLd } from '@/lib/breadcrumbs';
import { safeJsonLd } from '@/lib/json-ld';

export async function generateMetadata({
  params: { locale, page },
}: {
  params: { locale: string; page: string };
}) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  const pageNumber = parsePageParam(page);
  const title = locale === 'ko'
    ? `${t('posts')} · ${pageNumber}페이지`
    : `${t('posts')} · Page ${pageNumber}`;

  return {
    title,
    description: locale === 'ko'
      ? 'AI 관련 최신 뉴스와 인사이트'
      : 'Latest AI news and insights',
    robots: { index: false, follow: true },
    alternates: {
      canonical: `${BASE_URL}/${locale}/posts/page/${pageNumber}`,
      languages: {
        en: `${BASE_URL}/en/posts/page/${pageNumber}`,
        ko: `${BASE_URL}/ko/posts/page/${pageNumber}`,
      },
    },
  };
}

export default function PostsPageNumber({
  params: { locale, page },
}: {
  params: { locale: string; page: string };
}) {
  setRequestLocale(locale);

  const typedLocale = locale as Locale;
  const pageNumber = parsePageParam(page);
  if (pageNumber <= 1) {
    redirect(`/${locale}/posts`);
  }

  const allPosts = getPostSummaries(typedLocale);
  const totalPosts = allPosts.length;
  const totalPages = getTotalPages(totalPosts, DEFAULT_PAGE_SIZE);

  if (pageNumber > totalPages) notFound();

  const pagePosts = sliceForPage(allPosts, pageNumber, DEFAULT_PAGE_SIZE);
  const searchPosts = allPosts.map(({ slug, title, description, tags, date, lastReviewedAt, primaryKeyword, intent, topic, schema }) => ({
    slug,
    title,
    description,
    tags,
    date,
    lastReviewedAt,
    primaryKeyword,
    intent,
    topic,
    schema,
    series: deriveSeries(tags),
  }));
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: locale === 'ko' ? '홈' : 'Home', path: `/${locale}` },
    { name: locale === 'ko' ? '글' : 'Posts', path: `/${locale}/posts` },
    { name: locale === 'ko' ? `${pageNumber}페이지` : `Page ${pageNumber}`, path: `/${locale}/posts/page/${pageNumber}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <div className="bg-white dark:bg-[#101922] min-h-screen">
        <SearchDataSetter posts={searchPosts} locale={typedLocale} />
        <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
              {locale === 'ko' ? '모든 글' : 'All Articles'}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              {locale === 'ko'
                ? `${totalPosts}개 · ${pageNumber} / ${totalPages}페이지`
                : `${totalPosts} articles · Page ${pageNumber} / ${totalPages}`}
            </p>
          </div>
        </section>

        <main className="w-full max-w-7xl mx-auto px-6 py-12">
          {pagePosts.length > 0 ? (
            <>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {pagePosts.map((post) => (
                  <PostCard key={post.slug} post={post} locale={typedLocale} variant="medium" />
                ))}
              </div>
              <Pagination
                baseHref={`/${locale}/posts`}
                currentPage={pageNumber}
                totalPages={totalPages}
                locale={typedLocale}
                analyticsFrom="posts"
              />
            </>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                {locale === 'ko' ? '아직 글이 없습니다' : 'No posts yet'}
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
