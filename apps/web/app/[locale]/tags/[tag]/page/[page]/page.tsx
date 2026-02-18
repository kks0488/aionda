import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPostSummaries } from '@/lib/posts';
import PostCard from '@/components/PostCard';
import Pagination from '@/components/Pagination';
import { DEFAULT_PAGE_SIZE, getTotalPages, parsePageParam, sliceForPage } from '@/lib/pagination';
import { BASE_URL } from '@/lib/site';
import { locales, type Locale } from '@/i18n';
import { buildBreadcrumbJsonLd } from '@/lib/breadcrumbs';
import { safeJsonLd } from '@/lib/json-ld';

function normalizeTag(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export async function generateMetadata({
  params: { locale, tag, page },
}: {
  params: { locale: string; tag: string; page: string };
}) {
  const normalizedTag = normalizeTag(tag);
  const pageNumber = parsePageParam(page);
  const title = locale === 'ko'
    ? `"${normalizedTag}" 태그 · ${pageNumber}페이지`
    : `Tag: ${normalizedTag} · Page ${pageNumber}`;
  const description =
    locale === 'ko'
      ? `${normalizedTag} 관련 AI 아티클 모음.`
      : `AI articles tagged with ${normalizedTag}.`;
  const url = `${BASE_URL}/${locale}/tags/${encodeURIComponent(normalizedTag)}/page/${pageNumber}`;
  const languageAlternates = Object.fromEntries(
    locales.map((l) => [l, `${BASE_URL}/${l}/tags/${encodeURIComponent(normalizedTag)}/page/${pageNumber}`])
  );

  return {
    title,
    description,
    robots: { index: false, follow: true },
    alternates: {
      canonical: url,
      languages: languageAlternates,
    },
  };
}

export default function TagPageNumber({
  params: { locale, tag, page },
}: {
  params: { locale: string; tag: string; page: string };
}) {
  setRequestLocale(locale);

  const rawTag = typeof tag === 'string' ? tag : '';
  const normalizedTag = normalizeTag(rawTag);
  if (!normalizedTag) notFound();

  const pageNumber = parsePageParam(page);
  if (pageNumber <= 1) {
    redirect(`/${locale}/tags/${encodeURIComponent(normalizedTag)}`);
  }

  if (rawTag !== normalizedTag) {
    redirect(`/${locale}/tags/${encodeURIComponent(normalizedTag)}/page/${pageNumber}`);
  }

  const typedLocale = locale as Locale;
  const posts = getPostSummaries(typedLocale);
  const filteredPosts = posts.filter((post) =>
    post.tags.some((t) => normalizeTag(t) === normalizedTag)
  );
  if (filteredPosts.length === 0) notFound();

  const totalPosts = filteredPosts.length;
  const totalPages = getTotalPages(totalPosts, DEFAULT_PAGE_SIZE);
  if (pageNumber > totalPages) notFound();

  const pagePosts = sliceForPage(filteredPosts, pageNumber, DEFAULT_PAGE_SIZE);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: locale === 'ko' ? '홈' : 'Home', path: `/${locale}` },
    { name: locale === 'ko' ? '태그' : 'Tags', path: `/${locale}/tags` },
    { name: normalizedTag, path: `/${locale}/tags/${encodeURIComponent(normalizedTag)}` },
    { name: locale === 'ko' ? `${pageNumber}페이지` : `Page ${pageNumber}`, path: `/${locale}/tags/${encodeURIComponent(normalizedTag)}/page/${pageNumber}` },
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
              ? `${totalPosts}개 · ${pageNumber} / ${totalPages}페이지`
              : `${totalPosts} articles · Page ${pageNumber} / ${totalPages}`}
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
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {pagePosts.map((post) => (
              <PostCard key={post.slug} post={post} locale={typedLocale} variant="medium" />
            ))}
          </div>
          <Pagination
            baseHref={`/${locale}/tags/${encodeURIComponent(normalizedTag)}`}
            currentPage={pageNumber}
            totalPages={totalPages}
            locale={typedLocale}
            analyticsFrom="tag"
          />
        </main>
      </div>
    </>
  );
}
