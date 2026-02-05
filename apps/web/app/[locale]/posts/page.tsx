import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { deriveSeries, getPostSummaries } from '@/lib/posts';
import PostCard from '@/components/PostCard';
import SearchDataSetter from '@/components/SearchDataSetter';
import Pagination from '@/components/Pagination';
import { DEFAULT_PAGE_SIZE, getTotalPages, sliceForPage } from '@/lib/pagination';
import type { Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';
import { buildBreadcrumbJsonLd } from '@/lib/breadcrumbs';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  const posts = getPostSummaries(locale as Locale);
  const latest = posts[0]?.lastReviewedAt || posts[0]?.date || '';
  const latestMs = latest ? new Date(latest).getTime() : 0;
  const updatedLabel = latestMs && !Number.isNaN(latestMs)
    ? new Date(latestMs).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const descriptionBase = locale === 'ko'
    ? 'AI 관련 최신 뉴스와 인사이트'
    : 'Latest AI news and insights';
  const description = updatedLabel
    ? locale === 'ko'
      ? `${descriptionBase} (최근 업데이트: ${updatedLabel})`
      : `${descriptionBase} (Last updated: ${updatedLabel})`
    : descriptionBase;

  return {
    title: t('posts'),
    description,
    alternates: {
      canonical: `${BASE_URL}/${locale}/posts`,
      languages: {
        en: `${BASE_URL}/en/posts`,
        ko: `${BASE_URL}/ko/posts`,
      },
    },
  };
}

export default function PostsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { tag?: string };
}) {
  setRequestLocale(locale);

  const allPosts = getPostSummaries(locale as Locale);
  const totalPosts = allPosts.length;
  const totalPages = getTotalPages(totalPosts, DEFAULT_PAGE_SIZE);
  const pagePosts = sliceForPage(allPosts, 1, DEFAULT_PAGE_SIZE);
  const tagParam = typeof searchParams?.tag === 'string' ? searchParams.tag.trim() : '';
  const normalizedTag = tagParam ? tagParam.toLowerCase() : '';
  if (normalizedTag) {
    redirect(`/${locale}/tags/${encodeURIComponent(normalizedTag)}`);
  }
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
  const headerTitle = locale === 'ko' ? '모든 글' : 'All Articles';
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: locale === 'ko' ? '홈' : 'Home', path: `/${locale}` },
    { name: locale === 'ko' ? '글' : 'Posts', path: `/${locale}/posts` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="bg-white dark:bg-[#101922] min-h-screen">
        {/* Set posts for search */}
        <SearchDataSetter posts={searchPosts} locale={locale as Locale} />

        {/* Header */}
        <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
              {headerTitle}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400">
              {locale === 'ko' ? `${totalPosts}개의 글이 있습니다` : `${totalPosts} articles available`}
            </p>
          </div>
        </section>

        {/* Posts Grid */}
        <main className="w-full max-w-7xl mx-auto px-6 py-12">
          {pagePosts.length > 0 ? (
            <>
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {pagePosts.map((post) => (
                  <PostCard
                    key={post.slug}
                    post={post}
                    locale={locale as Locale}
                    variant="medium"
                  />
                ))}
              </div>
              <Pagination
                baseHref={`/${locale}/posts`}
                currentPage={1}
                totalPages={totalPages}
                locale={locale as Locale}
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
