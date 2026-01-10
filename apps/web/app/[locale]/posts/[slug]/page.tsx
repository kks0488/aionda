import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import { getPostBySlug, getPosts } from '@/lib/posts';
import { MDXContent } from '@/components/MDXContent';
import { ReadingProgress } from '@/components/ReadingProgress';
import ShareButtons from '@/components/ShareButtons';
import PostNavigation from '@/components/PostNavigation';
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
    hardware: 'memory',
    agi: 'psychology',
    llm: 'chat',
    robotics: 'precision_manufacturing',
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
  const allPosts = getPosts(locale as Locale);

  if (!post) {
    notFound();
  }

  // Get related posts (same tag, excluding current)
  const relatedPosts = allPosts
    .filter((p) => p.slug !== post.slug && p.tags.some((tag) => post.tags.includes(tag)))
    .slice(0, 3);

  // If not enough related posts, fill with recent posts
  if (relatedPosts.length < 3) {
    const recentPosts = allPosts
      .filter((p) => p.slug !== post.slug && !relatedPosts.includes(p))
      .slice(0, 3 - relatedPosts.length);
    relatedPosts.push(...recentPosts);
  }

  // Get previous and next posts
  const currentIndex = allPosts.findIndex((p) => p.slug === post.slug);
  const prevPost = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;

  const readingTime = estimateReadingTime(post.content);
  const primaryTag = post.tags[0] || 'ai';
  const tagColor = getTagColor(primaryTag);
  const tagIcon = getTagIcon(primaryTag);

  const formattedDate = new Date(post.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

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

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Article */}
          <article className="lg:col-span-8 flex flex-col">
            {/* Header */}
            <div className="mb-8 md:mb-12">
              {/* Meta info */}
              <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">
                {post.tags[0] && (
                  <>
                    <span className="text-primary hover:underline cursor-pointer">
                      {post.tags[0]}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                  </>
                )}
                <span>{formattedDate}</span>
                {post.verificationScore !== undefined && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-slate-300" />
                    <span className="flex items-center gap-1 text-primary">
                      <span className="material-symbols-outlined text-[16px] icon-filled">verified</span>
                      {Math.round(post.verificationScore * 100)}% Verified
                    </span>
                  </>
                )}
              </div>

              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-slate-900 dark:text-white">
                {post.title}
              </h1>

              {/* Description */}
              <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 font-light mb-10 leading-relaxed">
                {post.description}
              </p>

              {/* Hero Image */}
              <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 mb-10">
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
              </div>
            </div>

            {/* Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none text-slate-700 dark:text-slate-200 prose-headings:font-bold prose-headings:text-slate-900 dark:prose-headings:text-white prose-a:text-primary prose-strong:text-slate-900 dark:prose-strong:text-white prose-code:text-primary">
              <MDXContent source={post.content} />
            </div>

            {/* Share buttons */}
            <ShareButtons
              url={`${BASE_URL}/${locale}/posts/${slug}`}
              title={post.title}
              locale={locale as Locale}
            />

            {/* Source */}
            {post.sourceUrl && (
              <div className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                {t('originalSource')}:{' '}
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  DC Inside
                </a>
              </div>
            )}

            {/* Previous / Next Navigation */}
            <PostNavigation
              prevPost={prevPost}
              nextPost={nextPost}
              locale={locale as Locale}
            />
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-12">
            {/* Related Articles */}
            {relatedPosts.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary icon-filled text-2xl">auto_stories</span>
                  {locale === 'ko' ? '관련 글' : 'Related Articles'}
                </h3>
                <div className="space-y-6">
                  {relatedPosts.map((relatedPost) => {
                    const relatedTagColor = getTagColor(relatedPost.tags[0] || 'ai');
                    const relatedTagIcon = getTagIcon(relatedPost.tags[0] || 'ai');
                    const relatedDate = new Date(relatedPost.date).toLocaleDateString(
                      locale === 'ko' ? 'ko-KR' : 'en-US',
                      { month: 'short', day: 'numeric', year: 'numeric' }
                    );

                    return (
                      <Link
                        key={relatedPost.slug}
                        href={`/${locale}/posts/${relatedPost.slug}`}
                        className="group flex gap-4 items-start"
                      >
                        <div className="relative w-24 h-16 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800 flex-shrink-0">
                          {relatedPost.coverImage ? (
                            <Image
                              src={relatedPost.coverImage}
                              alt={relatedPost.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className={`w-full h-full bg-gradient-to-br ${relatedTagColor} flex items-center justify-center`}>
                              <span className="material-symbols-outlined text-white/80 text-2xl">
                                {relatedTagIcon}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-snug text-base line-clamp-2">
                            {relatedPost.title}
                          </h4>
                          <span className="text-xs text-slate-500 mt-1 block">
                            {relatedDate}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Newsletter */}
            <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
                {locale === 'ko' ? '뉴스레터' : 'Daily Digest'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {locale === 'ko'
                  ? '매일 아침 AI 뉴스를 받아보세요.'
                  : 'Get the top AI news every morning.'}
              </p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full rounded-lg bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button className="bg-primary text-white rounded-lg px-3 py-2 hover:bg-blue-600 transition-colors">
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Back to posts */}
            <Link
              href={`/${locale}/posts`}
              className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
              {locale === 'ko' ? '모든 글 보기' : 'Back to all posts'}
            </Link>
          </aside>
        </div>
      </main>
    </>
  );
}
