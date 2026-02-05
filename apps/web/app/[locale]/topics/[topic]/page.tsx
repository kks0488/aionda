import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPostSummaries } from '@/lib/posts';
import { getTopicConfig, getTopics, normalizeTopicId, postMatchesTopic } from '@/lib/topics';
import { getTopicHubContent } from '@/lib/topic-hubs';
import PostCard from '@/components/PostCard';
import { MDXContent } from '@/components/MDXContent';
import Pagination from '@/components/Pagination';
import { DEFAULT_PAGE_SIZE, getTotalPages, sliceForPage } from '@/lib/pagination';
import type { Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';
import { buildBreadcrumbJsonLd } from '@/lib/breadcrumbs';

export const dynamicParams = true;

export async function generateStaticParams() {
  const params: Array<{ locale: Locale; topic: string }> = [];
  for (const locale of ['en', 'ko'] as const) {
    for (const topic of getTopics(locale)) {
      params.push({ locale, topic: topic.id });
    }
  }
  return params;
}

export async function generateMetadata({
  params: { locale, topic },
}: {
  params: { locale: string; topic: string };
}) {
  const typedLocale = locale as Locale;
  const normalized = normalizeTopicId(topic);
  const config = getTopicConfig(typedLocale, normalized);

  const title = config
    ? locale === 'ko'
      ? `${config.title} 토픽`
      : `Topic: ${config.title}`
    : locale === 'ko'
      ? '토픽'
      : 'Topic';

  const description = config?.description
    ? config.description
    : locale === 'ko'
      ? '토픽별 AI 아티클 모음.'
      : 'AI articles grouped by topic.';

  const url = `${BASE_URL}/${locale}/topics/${encodeURIComponent(normalized)}`;
  const languageAlternates = {
    en: `${BASE_URL}/en/topics/${encodeURIComponent(normalized)}`,
    ko: `${BASE_URL}/ko/topics/${encodeURIComponent(normalized)}`,
  };

  const posts = getPostSummaries(typedLocale);
  const matched = config ? posts.filter((post) => postMatchesTopic(post, config)) : [];
  const count = matched.length;
  const shouldIndex = count >= 2;
  const lastUsedAtMs = matched.reduce((max, post) => {
    const t = new Date(post.lastReviewedAt || post.date).getTime();
    return Number.isNaN(t) ? max : Math.max(max, t);
  }, 0);
  const updatedLabel = lastUsedAtMs
    ? new Date(lastUsedAtMs).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '';
  const descriptionWithUpdated = updatedLabel
    ? locale === 'ko'
      ? `${description} 최근 업데이트: ${updatedLabel}.`
      : `${description} Last updated: ${updatedLabel}.`
    : description;

  return {
    title,
    description: descriptionWithUpdated,
    robots: shouldIndex ? undefined : { index: false, follow: true },
    alternates: {
      canonical: url,
      languages: languageAlternates,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: 'AI온다',
      type: 'website',
      images: [
        {
          url: `${BASE_URL}/api/og?title=${encodeURIComponent(title)}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BASE_URL}/api/og?title=${encodeURIComponent(title)}`],
    },
  };
}

export default function TopicPage({
  params: { locale, topic },
}: {
  params: { locale: string; topic: string };
}) {
  setRequestLocale(locale);

  const typedLocale = locale as Locale;
  const raw = typeof topic === 'string' ? topic : '';
  const normalized = normalizeTopicId(raw);
  if (!normalized) notFound();

  if (raw !== normalized) {
    redirect(`/${locale}/topics/${encodeURIComponent(normalized)}`);
  }

  const topicConfig = getTopicConfig(typedLocale, normalized);
  if (!topicConfig) notFound();

  const posts = getPostSummaries(typedLocale);
  const filtered = posts.filter((post) => postMatchesTopic(post, topicConfig));
  if (filtered.length === 0) notFound();
  const hub = getTopicHubContent(typedLocale, topicConfig.id);

  const toFreshnessMs = (post: { date: string; lastReviewedAt?: string }) => {
    const raw = post.lastReviewedAt || post.date;
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  };
  const featured = [...filtered].sort((a, b) => toFreshnessMs(b) - toFreshnessMs(a)).slice(0, 5);
  const howto = filtered
    .filter((post) => post.schema === 'howto' || post.intent === 'troubleshooting')
    .sort((a, b) => toFreshnessMs(b) - toFreshnessMs(a))
    .slice(0, 6);
  const faq = filtered
    .filter((post) => post.schema === 'faq')
    .sort((a, b) => toFreshnessMs(b) - toFreshnessMs(a))
    .slice(0, 6);

  const availableTags = new Set(
    filtered.flatMap((post) => (post.tags || []).map((tag) => String(tag || '').toLowerCase()))
  );
  const displayTags = (topicConfig.tags || [])
    .filter((tag) => availableTags.has(String(tag || '').toLowerCase()))
    .slice(0, 8);

  const totalPosts = filtered.length;
  const totalPages = getTotalPages(totalPosts, DEFAULT_PAGE_SIZE);
  const pagePosts = sliceForPage(filtered, 1, DEFAULT_PAGE_SIZE);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: locale === 'ko' ? '홈' : 'Home', path: `/${locale}` },
    { name: locale === 'ko' ? '토픽' : 'Topics', path: `/${locale}/topics` },
    { name: topicConfig.title, path: `/${locale}/topics/${encodeURIComponent(topicConfig.id)}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="bg-white dark:bg-[#101922] min-h-screen">
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <Link
              href={`/${locale}/topics`}
              className="text-primary hover:underline"
            >
              {locale === 'ko' ? '토픽' : 'Topics'}
            </Link>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-slate-900 dark:text-white">{topicConfig.title}</span>
          </div>

          <h1 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight text-slate-900 dark:text-white">
            {topicConfig.title}
          </h1>
          <p className="mt-4 text-lg text-slate-500 dark:text-slate-400 max-w-3xl">
            {topicConfig.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {displayTags.map((tag) => (
              <Link
                key={tag}
                href={`/${locale}/tags/${encodeURIComponent(tag)}`}
                data-analytics-event="tag_click"
                data-analytics-params={JSON.stringify({ tag, from: 'topic', topic: topicConfig.id, locale })}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>

          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            {locale === 'ko' ? `${totalPosts}개의 글` : `${totalPosts} articles`}
          </p>
        </div>
      </section>

      <main className="w-full max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            {hub?.content ? (
              <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-6">
                <MDXContent source={hub.content} />
              </section>
            ) : (
              <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {locale === 'ko' ? '이 토픽은 무엇인가' : 'What this topic covers'}
                </h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {topicConfig.description}
                </p>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  {locale === 'ko'
                    ? '허브 콘텐츠는 점진적으로 업데이트됩니다.'
                    : 'Hub content is updated incrementally.'}
                </p>
              </section>
            )}
          </div>

          <aside className="lg:col-span-5 space-y-8">
            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-6">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {locale === 'ko' ? '시작하기 (추천)' : 'Start Here'}
              </h2>
              <ul className="mt-4 space-y-3">
                {featured.map((post) => (
                  <li key={post.slug} className="min-w-0">
                    <Link
                      href={`/${locale}/posts/${post.slug}`}
                      className="block font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors line-clamp-2"
                      data-analytics-event="topic_featured_click"
                      data-analytics-params={JSON.stringify({ locale, topic: topicConfig.id, slug: post.slug })}
                    >
                      {post.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {new Date(post.lastReviewedAt || post.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            {howto.length > 0 && (
              <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {locale === 'ko' ? 'HowTo / 트러블슈팅' : 'HowTo / Troubleshooting'}
                </h2>
                <ul className="mt-4 space-y-3">
                  {howto.map((post) => (
                    <li key={post.slug} className="min-w-0">
                      <Link
                        href={`/${locale}/posts/${post.slug}`}
                        className="block text-sm font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors line-clamp-2"
                        data-analytics-event="topic_howto_click"
                        data-analytics-params={JSON.stringify({ locale, topic: topicConfig.id, slug: post.slug })}
                      >
                        {post.title}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {post.primaryKeyword ? post.primaryKeyword : post.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {faq.length > 0 && (
              <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-6">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">FAQ</h2>
                <ul className="mt-4 space-y-3">
                  {faq.map((post) => (
                    <li key={post.slug} className="min-w-0">
                      <Link
                        href={`/${locale}/posts/${post.slug}`}
                        className="block text-sm font-semibold text-slate-900 dark:text-white hover:text-primary transition-colors line-clamp-2"
                        data-analytics-event="topic_faq_click"
                        data-analytics-params={JSON.stringify({ locale, topic: topicConfig.id, slug: post.slug })}
                      >
                        {post.title}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                        {post.primaryKeyword ? post.primaryKeyword : post.description}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            {locale === 'ko' ? '모든 글' : 'All Articles'}
          </h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {pagePosts.map((post) => (
              <PostCard key={post.slug} post={post} locale={typedLocale} variant="medium" />
            ))}
          </div>
          <Pagination
            baseHref={`/${locale}/topics/${encodeURIComponent(topicConfig.id)}`}
            currentPage={1}
            totalPages={totalPages}
            locale={typedLocale}
            analyticsFrom="topic"
          />
        </section>
      </main>
      </div>
    </>
  );
}
