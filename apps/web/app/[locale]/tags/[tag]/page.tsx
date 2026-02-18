import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPostSummaries } from '@/lib/posts';
import { getTagStats } from '@/lib/tags';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';
import { DEFAULT_PAGE_SIZE, getTotalPages, sliceForPage } from '@/lib/pagination';
import { BASE_URL } from '@/lib/site';
import { locales, type Locale } from '@/i18n';
import { buildBreadcrumbJsonLd } from '@/lib/breadcrumbs';
import { safeJsonLd } from '@/lib/json-ld';

function normalizeTag(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export const dynamicParams = true;

export async function generateStaticParams() {
  const MIN_INDEXED_TAG_COUNT = 3;
  const MAX_STATIC_TAGS_PER_LOCALE = 200;
  const params: Array<{ locale: Locale; tag: string }> = [];
  for (const locale of locales) {
    const tags = getTagStats(locale)
      .filter((stat) => stat.count >= MIN_INDEXED_TAG_COUNT)
      .slice(0, MAX_STATIC_TAGS_PER_LOCALE)
      .map((stat) => stat.tag);
    for (const tag of tags) {
      params.push({ locale, tag });
    }
  }
  return params;
}

export async function generateMetadata({
  params: { locale, tag },
}: {
  params: { locale: string; tag: string };
}) {
  const normalizedTag = normalizeTag(tag);
  const title = locale === 'ko' ? `"${normalizedTag}" 태그` : `Tag: ${normalizedTag}`;
  const description =
    locale === 'ko'
      ? `${normalizedTag} 관련 AI 아티클 모음.`
      : `AI articles tagged with ${normalizedTag}.`;
  const url = `${BASE_URL}/${locale}/tags/${encodeURIComponent(normalizedTag)}`;
  const languageAlternates = Object.fromEntries(
    locales.map((l) => [l, `${BASE_URL}/${l}/tags/${encodeURIComponent(normalizedTag)}`])
  );
  const ogImageUrl = `${BASE_URL}/api/og?title=${encodeURIComponent(title)}`;
  const posts = getPostSummaries(locale as Locale);
  const matched = posts.filter((post) => post.tags.some((t) => normalizeTag(t) === normalizedTag));
  const count = matched.length;
  const shouldIndex = count >= 1;
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
          url: ogImageUrl,
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
      images: [ogImageUrl],
    },
  };
}

export default function TagPage({
  params: { locale, tag },
}: {
  params: { locale: string; tag: string };
}) {
  setRequestLocale(locale);

  const rawTag = typeof tag === 'string' ? tag : '';
  const normalizedTag = normalizeTag(rawTag);
  if (!normalizedTag) notFound();

  if (rawTag !== normalizedTag) {
    redirect(`/${locale}/tags/${encodeURIComponent(normalizedTag)}`);
  }

  const posts = getPostSummaries(locale as Locale);
  const filteredPosts = posts.filter((post) =>
    post.tags.some((t) => normalizeTag(t) === normalizedTag)
  );

  if (filteredPosts.length === 0) notFound();

  const totalPosts = filteredPosts.length;
  const totalPages = getTotalPages(totalPosts, DEFAULT_PAGE_SIZE);
  const pagePosts = sliceForPage(filteredPosts, 1, DEFAULT_PAGE_SIZE);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: locale === 'ko' ? '홈' : 'Home', path: `/${locale}` },
    { name: locale === 'ko' ? '태그' : 'Tags', path: `/${locale}/tags` },
    { name: normalizedTag, path: `/${locale}/tags/${encodeURIComponent(normalizedTag)}` },
  ]);

  const headerTitle = locale === 'ko' ? `"${normalizedTag}" 태그` : `Tag: ${normalizedTag}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <div className="bg-white dark:bg-[#101922] min-h-screen">
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {headerTitle}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            {locale === 'ko'
              ? `${totalPosts}개의 글이 있습니다`
              : `${totalPosts} articles available`}
          </p>
          <div className="mt-4 flex gap-3">
            <Link
              href={`/${locale}/tags`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {locale === 'ko' ? '전체 태그 보기' : 'View all tags'}
            </Link>
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
              baseHref={`/${locale}/tags/${encodeURIComponent(normalizedTag)}`}
              currentPage={1}
              totalPages={totalPages}
              locale={locale as Locale}
              analyticsFrom="tag"
            />
          </>
        </main>
      </div>
    </>
  );
}
