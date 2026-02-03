import { notFound, redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPosts } from '@/lib/posts';
import { getTagStats } from '@/lib/tags';
import SearchDataSetter from '@/components/SearchDataSetter';
import PostCard from '@/components/PostCard';
import { BASE_URL } from '@/lib/site';
import { locales, type Locale } from '@/i18n';

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
  const posts = getPosts(locale as Locale);
  const count = posts.filter((post) => post.tags.some((t) => normalizeTag(t) === normalizedTag)).length;
  const shouldIndex = count >= 3;

  return {
    title,
    description,
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

  const posts = getPosts(locale as Locale);
  const filteredPosts = posts.filter((post) =>
    post.tags.some((t) => normalizeTag(t) === normalizedTag)
  );

  if (filteredPosts.length === 0) notFound();

  const searchPosts = posts.map(({ slug, title, description, tags }) => ({
    slug,
    title,
    description,
    tags,
  }));

  const headerTitle = locale === 'ko' ? `"${normalizedTag}" 태그` : `Tag: ${normalizedTag}`;

  return (
    <div className="bg-white dark:bg-[#101922] min-h-screen">
      <SearchDataSetter posts={searchPosts} locale={locale as Locale} />

      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {headerTitle}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            {locale === 'ko'
              ? `${filteredPosts.length}개의 글이 있습니다`
              : `${filteredPosts.length} articles available`}
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
          {filteredPosts.map((post) => (
            <PostCard
              key={post.slug}
              post={post}
              locale={locale as Locale}
              variant="medium"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
