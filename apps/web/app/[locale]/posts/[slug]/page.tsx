import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import Image from 'next/image';
import { getAllSlugs, getAvailableLocalesForSlug, getPostBySlug, getPostSummaries } from '@/lib/posts';
import { getTagColor } from '@/lib/tag-utils';
import { getTopicConfig, normalizeTopicId } from '@/lib/topics';
import { BASE_URL } from '@/lib/site';
import { MDXContent } from '@/components/MDXContent';
import { ReadingProgress } from '@/components/ReadingProgress';
import ShareButtons from '@/components/ShareButtons';
import PostNavigation from '@/components/PostNavigation';
import SourceBadge from '@/components/SourceBadge';
import NewsletterSignup from '@/components/NewsletterSignup';
import { TableOfContents } from '@/components/TableOfContents';
import { defaultLocale, locales, type Locale } from '@/i18n';

const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  ko: 'ko_KR',
};

function pickCanonicalLocale(available: Locale[]): Locale {
  if (available.includes(defaultLocale)) return defaultLocale;
  if (available.includes('en')) return 'en';
  return available[0];
}

function buildOgImageUrl(post: {
  title: string;
  date?: string;
  tags?: string[];
  verificationScore?: number;
  byline?: string;
}): string {
  const params = new URLSearchParams();
  params.set('title', post.title);

  const dateValue = typeof post.date === 'string' ? post.date : '';
  const dateOnly = dateValue.includes('T') ? dateValue.split('T')[0] : dateValue;
  if (dateOnly) params.set('date', dateOnly);

  const tags = Array.isArray(post.tags) ? post.tags.filter(Boolean).slice(0, 4) : [];
  if (tags.length > 0) params.set('tags', tags.join(','));

  if (typeof post.verificationScore === 'number' && !Number.isNaN(post.verificationScore)) {
    params.set('score', String(Math.round(post.verificationScore * 100)));
  }

  const byline = typeof post.byline === 'string' ? post.byline.trim() : '';
  if (byline) params.set('byline', byline);

  return `${BASE_URL}/api/og?${params.toString()}`;
}

export async function generateStaticParams() {
  return getAllSlugs();
}

export async function generateMetadata({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  const requestedLocale = locale as Locale;
  const post = getPostBySlug(slug, requestedLocale);

  // If the post doesn't exist in the requested locale but exists in the other locale,
  // return metadata that points to the existing canonical version (and noindex the bridge page).
  if (!post) {
    const available = getAvailableLocalesForSlug(slug);
    if (available.length === 0) return { title: 'Not Found' };

    const canonicalLocale = pickCanonicalLocale(available);
    const canonicalPost = getPostBySlug(slug, canonicalLocale);
    if (!canonicalPost) return { title: 'Not Found' };

    const canonicalUrl = `${BASE_URL}/${canonicalLocale}/posts/${slug}`;
    const ogImageUrl = buildOgImageUrl(canonicalPost);
    const languageAlternates = Object.fromEntries(
      available.map((l) => [l, `${BASE_URL}/${l}/posts/${slug}`])
    );

    return {
      title: canonicalPost.title,
      description: canonicalPost.description,
      robots: { index: false, follow: true },
      alternates: {
        canonical: canonicalUrl,
        languages: languageAlternates,
      },
      openGraph: {
        title: canonicalPost.title,
        description: canonicalPost.description,
        url: canonicalUrl,
        siteName: 'AI온다',
        type: 'article',
        publishedTime: canonicalPost.date,
        modifiedTime: canonicalPost.lastReviewedAt || canonicalPost.date,
        tags: canonicalPost.tags,
        locale: OG_LOCALE[canonicalLocale] || 'en_US',
        images: [
          {
            url: ogImageUrl,
            width: 1200,
            height: 630,
            alt: canonicalPost.title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: canonicalPost.title,
        description: canonicalPost.description,
        images: [ogImageUrl],
      },
    };
  }

  const url = `${BASE_URL}/${requestedLocale}/posts/${slug}`;
  const ogImageUrl = buildOgImageUrl(post);
  const available = getAvailableLocalesForSlug(slug);
  const languageAlternates = Object.fromEntries(
    (available.length > 0 ? available : [requestedLocale]).map((l) => [l, `${BASE_URL}/${l}/posts/${slug}`])
  );

  return {
    title: post.title,
    description: post.description,
    alternates: {
      canonical: url,
      languages: languageAlternates,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url,
      siteName: 'AI온다',
      type: 'article',
      publishedTime: post.date,
      modifiedTime: post.lastReviewedAt || post.date,
      tags: post.tags,
      locale: OG_LOCALE[requestedLocale] || 'en_US',
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

function getHostname(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return null;
  }
}

function stripMarkdownForJsonLd(value: string): string {
  return String(value || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[*_]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadingSection(markdown: string, heading: RegExp): string {
  const raw = String(markdown || '');
  const match = heading.exec(raw);
  if (!match || typeof match.index !== 'number') return '';

  const after = raw.slice(match.index + match[0].length);
  const nextHeadingIndex = after.search(/^##\s+/m);
  const section = nextHeadingIndex === -1 ? after : after.slice(0, nextHeadingIndex);
  return section.trim();
}

function extractFaqPairs(markdown: string): Array<{ question: string; answer: string }> {
  const section = extractHeadingSection(markdown, /^##\s*FAQ\s*$/im);
  if (!section) return [];

  const lines = section
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map((l) => l.trimEnd());

  const pairs: Array<{ question: string; answer: string }> = [];
  let currentQ = '';
  let currentA: string[] = [];
  let sawAnswer = false;

  const flush = () => {
    const q = stripMarkdownForJsonLd(currentQ);
    const a = stripMarkdownForJsonLd(currentA.join(' '));
    if (q && a) pairs.push({ question: q, answer: a });
    currentQ = '';
    currentA = [];
    sawAnswer = false;
  };

  const qRe = /^\s*(?:\*\*)?\s*Q[:：]\s*(.+?)(?:\*\*)?\s*$/i;
  const aRe = /^\s*(?:\*\*)?\s*A[:：]\s*(.+?)(?:\*\*)?\s*$/i;

  for (const lineRaw of lines) {
    const line = String(lineRaw || '').trim();
    if (!line) {
      if (sawAnswer) currentA.push('');
      continue;
    }

    const qMatch = line.match(qRe);
    if (qMatch) {
      if (currentQ) flush();
      currentQ = qMatch[1] || '';
      continue;
    }

    const aMatch = line.match(aRe);
    if (aMatch) {
      if (!currentQ) continue;
      currentA.push(aMatch[1] || '');
      sawAnswer = true;
      continue;
    }

    if (!currentQ) continue;
    if (!sawAnswer) continue;
    if (/^##\s+/.test(line)) break;
    currentA.push(line);
  }

  if (currentQ) flush();
  return pairs.slice(0, 20);
}

function extractHowToSteps(markdown: string, locale: Locale): string[] {
  const marker = locale === 'ko' ? /\*\*오늘\s*바로\s*할\s*일:\*\*/i : /\*\*Checklist\s+for\s+Today:\*\*/i;
  const raw = String(markdown || '');
  const match = marker.exec(raw);
  if (!match || typeof match.index !== 'number') return [];

  const after = raw.slice(match.index + match[0].length);
  const nextHeadingIndex = after.search(/^##\s+/m);
  const section = nextHeadingIndex === -1 ? after : after.slice(0, nextHeadingIndex);

  return section
    .replace(/```[\s\S]*?```/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^-\s+/.test(l))
    .map((l) => stripMarkdownForJsonLd(l.replace(/^-\s+/, '')))
    .filter(Boolean)
    .slice(0, 20);
}

export default async function PostPage({
  params: { locale, slug },
}: {
  params: { locale: string; slug: string };
}) {
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'post' });
  const requestedLocale = locale as Locale;
  const post = getPostBySlug(slug, requestedLocale);
  const allPosts = getPostSummaries(requestedLocale);

  if (!post) {
    const available = getAvailableLocalesForSlug(slug);
    if (available.length === 0) notFound();

    return (
      <main className="w-full max-w-3xl mx-auto px-6 py-24">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">
          {t('translationUnavailableTitle')}
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">
          {t('translationUnavailableBody')}
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {available.map((l) => (
            <Link
              key={l}
              href={`/${l}/posts/${slug}`}
              className="px-4 py-2.5 rounded-lg bg-primary text-white font-bold text-sm hover:opacity-95 transition-opacity"
            >
              {l.toUpperCase()}
            </Link>
          ))}
          <Link
            href={`/${locale}/posts`}
            className="px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white font-bold text-sm hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            {t('backToPosts')}
          </Link>
        </div>
      </main>
    );
  }

  const postTopicId = post.topic ? normalizeTopicId(post.topic) : '';
  const postTopicConfig = postTopicId ? getTopicConfig(requestedLocale, postTopicId) : null;

  // Get related posts (topic first, then tags, then recent)
  const relatedByTopic = postTopicId
    ? allPosts
        .filter((p) => p.slug !== post.slug && normalizeTopicId(p.topic || '') === postTopicId)
        .slice(0, 3)
    : [];

  const relatedByTags = allPosts
    .filter(
      (p) =>
        p.slug !== post.slug &&
        !relatedByTopic.includes(p) &&
        p.tags.some((tag) => post.tags.includes(tag))
    )
    .slice(0, Math.max(0, 3 - relatedByTopic.length));

  const relatedPosts = [...relatedByTopic, ...relatedByTags].slice(0, 3);

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
  const placeholderMark = primaryTag.slice(0, 1).toUpperCase();
  const sourceHostname = getHostname(post.sourceUrl);
  const showSourceBadge = Boolean(post.sourceId || post.sourceUrl);
  const isDcInsideSource = Boolean(post.sourceUrl && /dcinside\.com/i.test(post.sourceUrl));
  const freshnessBase = post.lastReviewedAt || post.date;
  const freshnessAtMs = new Date(freshnessBase).getTime();
  const ageDays = Number.isNaN(freshnessAtMs)
    ? 0
    : Math.floor((Date.now() - freshnessAtMs) / (1000 * 60 * 60 * 24));
  const showStaleNotice = ageDays >= 120;

  const dateObj = new Date(post.date);
  const formattedDate = dateObj.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const formattedDateCompact = Number.isNaN(dateObj.getTime())
    ? formattedDate
    : `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

  const reviewedAt = post.lastReviewedAt ? new Date(post.lastReviewedAt) : null;
  const reviewedDateLabel =
    reviewedAt && !Number.isNaN(reviewedAt.getTime())
      ? reviewedAt.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

  const postUrl = `${BASE_URL}/${locale}/posts/${slug}`;
  const correctionsHref = `/${locale}/corrections?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(post.title)}`;

  // JSON-LD structured data for SEO
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.lastReviewedAt || post.date,
    url: postUrl,
    image: post.coverImage || buildOgImageUrl(post),
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
      '@id': postUrl,
    },
    keywords: post.tags.join(', '),
    inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
  };

  // BreadcrumbList structured data
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: locale === 'ko' ? '홈' : 'Home',
        item: `${BASE_URL}/${locale}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: locale === 'ko' ? '포스트' : 'Posts',
        item: `${BASE_URL}/${locale}/posts`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
      },
    ],
  };

  const faqPairs = post.schema === 'faq' ? extractFaqPairs(post.content) : [];
  const faqJsonLd =
    post.schema === 'faq' && faqPairs.length >= 2
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqPairs.map((qa) => ({
            '@type': 'Question',
            name: qa.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: qa.answer,
            },
          })),
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${BASE_URL}/${locale}/posts/${slug}`,
          },
          inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
        }
      : null;

  const howToSteps = post.schema === 'howto' ? extractHowToSteps(post.content, requestedLocale) : [];
  const howToJsonLd =
    post.schema === 'howto' && howToSteps.length >= 2
      ? {
          '@context': 'https://schema.org',
          '@type': 'HowTo',
          name: post.title,
          description: post.description,
          image: post.coverImage || buildOgImageUrl(post),
          step: howToSteps.map((text, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            name: text.length > 120 ? `${text.slice(0, 117)}...` : text,
            text,
          })),
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `${BASE_URL}/${locale}/posts/${slug}`,
          },
          inLanguage: locale === 'ko' ? 'ko-KR' : 'en-US',
        }
      : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          id="ld-faq"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      {howToJsonLd && (
        <script
          id="ld-howto"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
        />
      )}
      <ReadingProgress />

      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-12 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Article */}
          <article className="lg:col-span-8 flex flex-col">
            {/* Header */}
            <div className="mb-8 md:mb-12">
              {/* Meta info */}
              <div className="flex items-center gap-3 text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 min-w-0">
                <span className="sm:hidden">{formattedDateCompact}</span>
                <span className="hidden sm:contents">
                  {post.tags[0] && (
                    <>
                      <Link
                        href={`/${locale}/tags/${encodeURIComponent(post.tags[0])}`}
                        className="text-primary hover:underline"
                        data-analytics-event="tag_click"
                        data-analytics-params={JSON.stringify({ tag: post.tags[0], from: 'post_meta', locale })}
                      >
                        {post.tags[0]}
                      </Link>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    </>
                  )}
                  {showSourceBadge && (
                    <>
                      <SourceBadge locale={locale as Locale} sourceId={post.sourceId} sourceUrl={post.sourceUrl} compact />
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                    </>
                  )}
                  <span>{formattedDate}</span>
                  {typeof post.readingTime === 'number' && !Number.isNaN(post.readingTime) && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>{locale === 'ko' ? `${post.readingTime}분` : `${post.readingTime} min`}</span>
                    </>
                  )}
                  {post.byline && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="truncate">{post.byline}</span>
                    </>
                  )}
                  {reviewedDateLabel && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="truncate">
                        {locale === 'ko' ? `검토 ${reviewedDateLabel}` : `Reviewed ${reviewedDateLabel}`}
                      </span>
                    </>
                  )}
                  {post.verificationScore !== undefined && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span className="text-primary font-semibold">{Math.round(post.verificationScore * 100)}% Verified</span>
                    </>
                  )}
                </span>
              </div>

              {/* Freshness / staleness notice */}
              {showStaleNotice && (
                <div className="mb-8 rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/30 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {reviewedDateLabel
                          ? locale === 'ko'
                            ? `이 글은 ${reviewedDateLabel} 기준으로 마지막으로 검토되었습니다.`
                            : `This post was last reviewed on ${reviewedDateLabel}.`
                          : locale === 'ko'
                            ? `이 글은 ${formattedDate} 기준으로 작성되었습니다.`
                            : `This post was written on ${formattedDate}.`}
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                        {locale === 'ko' ? (
                          <>
                            모델/가격/정책은 바뀌었을 수 있어요.{' '}
                            <Link
                              href={`/${locale}/tags/${encodeURIComponent(primaryTag)}`}
                              className="text-primary hover:underline font-semibold"
                              data-analytics-event="tag_click"
                              data-analytics-params={JSON.stringify({ tag: primaryTag, from: 'stale_notice', locale })}
                            >
                              최신 {primaryTag} 글
                            </Link>
                            로 업데이트를 확인하세요.
                          </>
                        ) : (
                          <>
                            Models/pricing/policies may have changed. Check the latest{' '}
                            <Link
                              href={`/${locale}/tags/${encodeURIComponent(primaryTag)}`}
                              className="text-primary hover:underline font-semibold"
                              data-analytics-event="tag_click"
                              data-analytics-params={JSON.stringify({ tag: primaryTag, from: 'stale_notice', locale })}
                            >
                              {primaryTag} posts
                            </Link>
                            .
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Title */}
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-slate-900 dark:text-white">
                {post.title}
              </h1>

              {/* Description */}
              <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-300 font-light mb-10 leading-relaxed">
                {post.description}
              </p>

              {postTopicConfig && (
                <div className="mb-10 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white/70 dark:bg-slate-900/30 p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {locale === 'ko' ? '토픽' : 'Topic'}
                      </p>
                      <Link
                        href={`/${locale}/topics/${encodeURIComponent(postTopicConfig.id)}`}
                        className="mt-1 inline-flex items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white hover:text-primary transition-colors"
                        data-analytics-event="post_topic_hub_click"
                        data-analytics-params={JSON.stringify({ locale, topic: postTopicConfig.id, slug })}
                      >
                        {postTopicConfig.title}
                        <span aria-hidden="true" className="text-primary">→</span>
                      </Link>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
                        {postTopicConfig.description}
                      </p>
                    </div>
                    <Link
                      href={`/${locale}/topics/${encodeURIComponent(postTopicConfig.id)}`}
                      className="shrink-0 inline-flex items-center justify-center h-10 px-4 rounded-lg bg-primary text-white font-bold hover:opacity-95 transition-opacity"
                      data-analytics-event="post_topic_hub_cta_click"
                      data-analytics-params={JSON.stringify({ locale, topic: postTopicConfig.id, slug })}
                    >
                      {locale === 'ko' ? '토픽에서 더 보기' : 'Browse topic'}
                    </Link>
                  </div>
                </div>
              )}

              {/* Tag chips */}
              {post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-10">
                  {post.tags.slice(0, 4).map((tag) => {
                    const chipHref = `/${locale}/tags/${encodeURIComponent(tag)}`;
                    return (
                      <Link
                        key={tag}
                        href={chipHref}
                        className="group inline-flex items-center rounded-full border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-slate-900/40 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
                        data-analytics-event="tag_click"
                        data-analytics-params={JSON.stringify({ tag, from: 'post_chips', locale })}
                      >
                        <span className="max-w-[14rem] truncate">{tag}</span>
                      </Link>
                    );
                  })}
                  {post.tags.length > 4 && (
                    <Link
                      href={`/${locale}/tags`}
                      className="inline-flex items-center rounded-full border border-transparent bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      +{post.tags.length - 4}
                    </Link>
                  )}
                </div>
              )}

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
                    <div className="absolute inset-0 bg-black/25 dark:bg-black/10" />
                    {/* Pattern overlay */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute inset-0" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                      }} />
                    </div>
                    <span className="text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] text-6xl font-extrabold tracking-tight" aria-hidden="true">
                      {placeholderMark}
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

            <NewsletterSignup locale={locale as Locale} from="post" />

            <div className="mt-8 rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-slate-900/40 p-4">
              <p className="text-sm text-slate-700 dark:text-slate-200">
                {locale === 'ko' ? '오류를 발견했나요?' : 'Found an issue?'}{' '}
                <Link
                  href={correctionsHref}
                  className="text-primary hover:underline font-semibold"
                  data-analytics-event="corrections_click"
                  data-analytics-params={JSON.stringify({ from: 'post', locale, slug })}
                >
                  {locale === 'ko' ? '정정/오류 제보' : 'Report a correction'}
                </Link>
                {locale === 'ko'
                  ? '로 알려주시면 검토 후 업데이트에 반영할게요.'
                  : ' so we can review and update the post.'}
              </p>
            </div>

            {/* Inspiration & Source */}
            {(isDcInsideSource || post.sourceUrl) && (
              <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
                <div className="flex flex-col gap-2 text-sm text-slate-600 dark:text-slate-300">
                  {isDcInsideSource && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {locale === 'ko' ? '영감:' : 'Inspired by:'}
                      </span>
                      <a
                        href="https://gall.dcinside.com/mgallery/board/lists?id=thesingularity"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                        data-analytics-event="source_outbound_click"
                        data-analytics-params={JSON.stringify({ kind: 'inspired_by', locale })}
                      >
                        {locale === 'ko' ? '특이점이 온다 갤러리' : 'Singularity Gallery (Korea)'}
                      </a>
                    </div>
                  )}
                  {post.sourceUrl && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {locale === 'ko' ? '출처:' : 'Source:'}
                      </span>
                      <a
                        href={post.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate max-w-[300px]"
                        data-analytics-event="source_outbound_click"
                        data-analytics-params={JSON.stringify({ kind: 'source', locale, sourceId: post.sourceId || '' })}
                      >
                        {sourceHostname ?? post.sourceUrl}
                      </a>
                    </div>
                  )}
                </div>
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
          <aside className="lg:col-span-4">
            <div className="space-y-12">
              <TableOfContents content={post.content} className="lg:block" />

              {/* Related Articles */}
              {relatedPosts.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">
                    {locale === 'ko' ? '관련 글' : 'Related Articles'}
                  </h3>
                  <div className="space-y-6">
                    {relatedPosts.map((relatedPost) => {
                      const relatedTagColor = getTagColor(relatedPost.tags[0] || 'ai');
                      const relatedMark = (relatedPost.tags[0] || 'ai').slice(0, 1).toUpperCase();
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
                              <div className={`w-full h-full bg-gradient-to-br ${relatedTagColor} flex items-center justify-center relative overflow-hidden`}>
                                <div className="absolute inset-0 bg-black/25 dark:bg-black/10" />
                                <span className="text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)] text-xl font-extrabold tracking-tight" aria-hidden="true">
                                  {relatedMark}
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

              {/* Back to posts */}
              <Link
                href={`/${locale}/posts`}
                className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
              >
                {locale === 'ko' ? '모든 글 보기' : 'Back to all posts'}
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
