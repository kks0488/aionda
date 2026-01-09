import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import { getPostBySlug, getPosts } from '@/lib/posts';
import { MDXContent } from '@/components/MDXContent';
import { ReadingProgress } from '@/components/ReadingProgress';
import { TableOfContents } from '@/components/TableOfContents';
import type { Locale } from '@/i18n';

export async function generateStaticParams() {
  const enPosts = getPosts('en');
  const koPosts = getPosts('ko');

  return [
    ...enPosts.map((post) => ({ locale: 'en', slug: post.slug })),
    ...koPosts.map((post) => ({ locale: 'ko', slug: post.slug })),
  ];
}

const BASE_URL = 'https://aionda.blog';

export async function generateMetadata({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  const post = getPostBySlug(slug, locale as Locale);
  if (!post) return { title: 'Not Found' };

  const url = `${BASE_URL}/${locale}/posts/${slug}`;
  const ogImageUrl = `${BASE_URL}/api/og?title=${encodeURIComponent(post.title)}&date=${post.date}`;

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: url,
      languages: {
        'en': `${BASE_URL}/en/posts/${slug}`,
        'ko': `${BASE_URL}/ko/posts/${slug}`,
      },
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: 'AI온다',
      type: 'article',
      publishedTime: post.date,
      tags: post.tags,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [ogImageUrl],
    },
  };
}

function estimateReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

export default async function PostPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(locale);

  const post = getPostBySlug(slug, locale as Locale);
  const t = await getTranslations({ locale, namespace: 'post' });

  if (!post) {
    notFound();
  }

  const otherLocale = locale === 'en' ? 'ko' : 'en';
  const readingTime = estimateReadingTime(post.content);

  // JSON-LD structured data for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    url: `${BASE_URL}/${locale}/posts/${slug}`,
    image: post.coverImage || `${BASE_URL}/api/og?title=${encodeURIComponent(post.title)}&date=${post.date}`,
    author: {
      '@type': 'Organization',
      name: 'AI온다',
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'AI온다',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/api/og-default`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/${locale}/posts/${slug}`,
    },
    keywords: post.tags.join(', '),
    inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ReadingProgress />

      <div className="flex justify-center gap-8">
        {/* Main content */}
        <article className="max-w-3xl w-full">
          {/* Cover Image */}
          {post.coverImage && (
            <div className="relative w-full aspect-video mb-8 rounded-xl overflow-hidden shadow-lg">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Header */}
          <header className="mb-10">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 leading-tight">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
              <time dateTime={post.date} className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {new Date(post.date).toLocaleDateString(locale, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>

              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {readingTime} min read
              </span>

              {post.verificationScore !== undefined && (
                <span className={`flex items-center gap-1 ${
                  post.verificationScore >= 0.7
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {Math.round(post.verificationScore * 100)}% verified
                </span>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-accent/10 text-accent text-sm font-medium rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Language Switch */}
            {post.alternateLocale && (
              <Link
                href={post.alternateLocale}
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                {locale === 'en' ? '🇰🇷 한국어로 읽기' : '🇺🇸 Read in English'}
              </Link>
            )}
          </header>

          {/* Content */}
          <MDXContent source={post.content} />

          {/* Footer */}
          <footer className="mt-16 pt-8 border-t border-border">
            {post.sourceUrl && (
              <p className="text-sm text-muted-foreground">
                {t('originalSource')}:{' '}
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  DC Inside
                </a>
              </p>
            )}
          </footer>
        </article>

        {/* Table of Contents - sidebar */}
        <TableOfContents content={post.content} />
      </div>
    </>
  );
}
