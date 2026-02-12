import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPostSummaries } from '@/lib/posts';
import { buildTopicStats, getTopics } from '@/lib/topics';
import type { Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';
import { buildBreadcrumbJsonLd } from '@/lib/breadcrumbs';
import { safeJsonLd } from '@/lib/json-ld';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const title = locale === 'ko' ? '토픽' : 'Topics';
  const description =
    locale === 'ko'
      ? 'AI 분야의 큰 흐름을 토픽별로 모아봅니다.'
      : 'Browse AI coverage by topic clusters.';

  return {
    title,
    description,
    alternates: {
      canonical: `${BASE_URL}/${locale}/topics`,
      languages: {
        en: `${BASE_URL}/en/topics`,
        ko: `${BASE_URL}/ko/topics`,
      },
    },
  };
}

export default function TopicsIndexPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);

  const typedLocale = locale as Locale;
  const posts = getPostSummaries(typedLocale);
  const topics = getTopics(typedLocale);
  const stats = buildTopicStats(topics, posts);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: locale === 'ko' ? '홈' : 'Home', path: `/${locale}` },
    { name: locale === 'ko' ? '토픽' : 'Topics', path: `/${locale}/topics` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <div className="bg-white dark:bg-[#101922] min-h-screen">
        {/* Header */}
        <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
              {locale === 'ko' ? '토픽' : 'Topics'}
            </h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl">
              {locale === 'ko'
                ? '태그가 흩어지지 않도록, 큰 주제로 묶어서 탐색합니다.'
                : 'Curated clusters that keep discovery clean and useful.'}
            </p>
          </div>
        </section>

        <main className="w-full max-w-7xl mx-auto px-6 py-12">
          {stats.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {stats.map(({ topic, count, lastUsedAt }) => {
                const updated = lastUsedAt
                  ? new Date(lastUsedAt).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';

                return (
                  <Link
                    key={topic.id}
                    href={`/${locale}/topics/${encodeURIComponent(topic.id)}`}
                    data-analytics-event="topic_click"
                    data-analytics-params={JSON.stringify({ topic: topic.id, locale })}
                    className="group p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-[0_18px_55px_rgba(0,0,0,0.08)] transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                          {topic.title}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {topic.description}
                        </p>
                      </div>
                      <span className="shrink-0 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-extrabold text-sm px-3 py-1">
                        {count}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(topic.tags || []).slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border border-gray-200/80 dark:border-gray-700/80 bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {updated && (
                      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                        {locale === 'ko' ? `최근 업데이트: ${updated}` : `Last updated: ${updated}`}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                {locale === 'ko' ? '토픽이 아직 없습니다' : 'No topics yet'}
              </p>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
