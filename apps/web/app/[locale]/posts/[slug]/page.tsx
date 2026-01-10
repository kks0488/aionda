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

// Generate a consistent color based on the first tag
function getTagColor(tag: string): string {
  const colors = [
    'from-blue-500 to-cyan-400',
    'from-purple-500 to-pink-400',
    'from-green-500 to-emerald-400',
    'from-orange-500 to-amber-400',
    'from-red-500 to-rose-400',
    'from-indigo-500 to-violet-400',
  ];
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Get icon for tag
function getTagIcon(tag: string): string {
  const icons: Record<string, string> = {
    news: 'newspaper',
    opinion: 'lightbulb',
    openai: 'smart_toy',
    anthropic: 'psychology',
    grok: 'auto_awesome',
    xai: 'rocket_launch',
    gpt: 'chat',
    llama: 'pets',
    ai: 'memory',
    default: 'article',
  };
  return icons[tag.toLowerCase()] || icons.default;
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

  const readingTime = estimateReadingTime(post.content);
  const primaryTag = post.tags[0] || 'ai';
  const tagColor = getTagColor(primaryTag);
  const tagIcon = getTagIcon(primaryTag);

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

      <div className="bg-white dark:bg-[#101922] min-h-screen">
        {/* Hero Image */}
        <div className="w-full max-w-5xl mx-auto px-6 pt-8">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden shadow-lg">
            {post.coverImage ? (
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover"
                priority
              />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${tagColor} flex items-center justify-center relative overflow-hidden`}>
                {/* Pattern overlay */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }} />
                </div>
                <span className="material-symbols-outlined text-white/80 text-8xl">
                  {tagIcon}
                </span>
              </div>
            )}
            {post.tags[0] && (
              <span className="absolute top-4 left-4 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white">
                {post.tags[0]}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-center gap-8 px-6 py-12">
          {/* Main content */}
          <article className="max-w-3xl w-full">
            {/* Header */}
            <header className="mb-10">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-6 leading-tight text-slate-900 dark:text-white">
                {post.title}
              </h1>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mb-6">
                <time dateTime={post.date} className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">calendar_today</span>
                  {new Date(post.date).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </time>

                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">schedule</span>
                  {readingTime} min read
                </span>

                {post.verificationScore !== undefined && (
                  <span className={`flex items-center gap-1 ${
                    post.verificationScore >= 0.7
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    <span className="material-symbols-outlined text-base icon-filled">verified</span>
                    {Math.round(post.verificationScore * 100)}% verified
                  </span>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-primary/10 text-primary text-sm font-medium rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Language Switch */}
              {post.alternateLocale && (
                <Link
                  href={post.alternateLocale}
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  {locale === 'en' ? '🇰🇷 한국어로 읽기' : '🇺🇸 Read in English'}
                </Link>
              )}
            </header>

            {/* Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-code:text-primary">
              <MDXContent source={post.content} />
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-800">
              {post.sourceUrl && (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('originalSource')}:{' '}
                  <a
                    href={post.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    DC Inside
                  </a>
                </p>
              )}

              {/* Back to posts */}
              <Link
                href={`/${locale}/posts`}
                className="inline-flex items-center gap-2 mt-6 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-xl">arrow_back</span>
                {locale === 'ko' ? '모든 글 보기' : 'Back to all posts'}
              </Link>
            </footer>
          </article>

          {/* Table of Contents - sidebar */}
          <TableOfContents content={post.content} />
        </div>
      </div>
    </>
  );
}
