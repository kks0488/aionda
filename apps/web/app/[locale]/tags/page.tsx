import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { deriveSeries, getPostSummaries } from '@/lib/posts';
import { getTagStats } from '@/lib/tags';
import { getTagColor } from '@/lib/tag-utils';
import SearchDataSetter from '@/components/SearchDataSetter';
import type { Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';
import { buildBreadcrumbJsonLd } from '@/lib/breadcrumbs';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  return {
    title: locale === 'ko' ? '태그' : 'Tags',
    description:
      locale === 'ko'
        ? '주제별로 AI 아티클을 찾아보세요.'
        : 'Browse AI articles by topic.',
    alternates: {
      canonical: `${BASE_URL}/${locale}/tags`,
      languages: {
        en: `${BASE_URL}/en/tags`,
        ko: `${BASE_URL}/ko/tags`,
      },
    },
  };
}

export default function TagsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);

  const posts = getPostSummaries(locale as Locale);
  const tagStats = getTagStats(locale as Locale);
  const MIN_INDEXED_TAG_COUNT = 3;
  const MAX_TAGS = 120;
  const popularTags = tagStats
    .filter((stat) => stat.count >= MIN_INDEXED_TAG_COUNT)
    .slice(0, MAX_TAGS);
  const displayTags = popularTags.length > 0 ? popularTags : tagStats.slice(0, MAX_TAGS);
  const searchPosts = posts.map(({ slug, title, description, tags, date, lastReviewedAt, primaryKeyword, intent, topic, schema }) => ({
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
    { name: locale === 'ko' ? '태그' : 'Tags', path: `/${locale}/tags` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="bg-white dark:bg-[#101922] min-h-screen">
        <SearchDataSetter posts={searchPosts} locale={locale as Locale} />

      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {locale === 'ko' ? '태그' : 'Tags'}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            {locale === 'ko' ? (
              <>
                총 {tagStats.length}개 태그 중 상위 {displayTags.length}개 표시
              </>
            ) : (
              <>
                Showing top {displayTags.length} of {tagStats.length} tags
              </>
            )}
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/${locale}/posts`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {locale === 'ko' ? '전체 글 보기' : 'View all posts'}
            </Link>
          </div>
        </div>
      </section>

        <main className="w-full max-w-7xl mx-auto px-6 py-12">
          {displayTags.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayTags.map((stat) => {
                const tagColor = getTagColor(stat.tag);
                const updated = new Date(stat.lastUsedAt).toLocaleDateString(
                  locale === 'ko' ? 'ko-KR' : 'en-US',
                  { year: 'numeric', month: 'short', day: 'numeric' }
                );
                const href = `/${locale}/tags/${encodeURIComponent(stat.tag)}`;

                return (
                  <Link
                    key={stat.tag}
                    href={href}
                    data-analytics-event="tag_click"
                    data-analytics-params={JSON.stringify({ tag: stat.tag, from: 'tags_index', locale })}
                    className="group p-5 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${tagColor} flex items-center justify-center`}
                        aria-hidden="true"
                      >
                        <span className="text-white font-extrabold tracking-tight">
                          {stat.tag.slice(0, 1).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-slate-900 dark:text-white truncate">
                            {stat.tag}
                          </h2>
                          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            {stat.count}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          {locale === 'ko'
                            ? `최근 업데이트: ${updated}`
                            : `Last updated: ${updated}`}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                {locale === 'ko' ? '태그가 아직 없습니다' : 'No tags yet'}
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
