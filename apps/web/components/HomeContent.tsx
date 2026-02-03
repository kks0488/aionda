'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';
import PostCard from './PostCard';
import Sidebar from './Sidebar';
import { getSourceKind } from '@/lib/source-utils';

interface HomeContentProps {
  posts: Post[];
  locale: Locale;
}

const CATEGORIES = [
  { id: 'all', label: { en: 'Latest', ko: '최신' } },
  { id: 'agi', label: { en: 'AGI', ko: 'AGI' } },
  { id: 'llm', label: { en: 'LLM', ko: 'LLM' } },
  { id: 'robotics', label: { en: 'Robotics', ko: '로보틱스' } },
  { id: 'hardware', label: { en: 'Hardware', ko: '하드웨어' } },
  { id: 'news', label: { en: 'News', ko: '뉴스' } },
  { id: 'opinion', label: { en: 'Opinion', ko: '의견' } },
];

export default function HomeContent({ posts, locale }: HomeContentProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const normalizedCategory = selectedCategory.toLowerCase();

  const filteredPosts = useMemo(() => {
    if (normalizedCategory === 'all') return posts;
    return posts.filter((post) =>
      post.tags.some((tag) => tag.toLowerCase().includes(normalizedCategory))
    );
  }, [posts, normalizedCategory]);

  const orderedPosts = useMemo(() => {
    const hasTag = (post: Post, tag: string) =>
      post.tags.some((t) => t.toLowerCase() === tag);
    const isPulse = (post: Post) => hasTag(post, 'k-ai-pulse');
    const isEvergreen = (post: Post) => hasTag(post, 'explainer') || hasTag(post, 'deep-dive');
    const isCommunity = (post: Post) =>
      getSourceKind({ sourceId: post.sourceId, sourceUrl: post.sourceUrl }) === 'community';

    const byDateDesc = (a: Post, b: Post) => new Date(b.date).getTime() - new Date(a.date).getTime();
    const sorted = [...filteredPosts].sort(byDateDesc);

    // "Latest" should feel current: prioritize fast-news posts over evergreen explainers.
    if (normalizedCategory === 'all') {
      sorted.sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        const dateDiff = timeB - timeA; // newest first

        // Never let older "pulse" items hide truly newer posts.
        // Apply pulse/evergreen preference only inside a short recency window.
        const RECENCY_WINDOW_MS = 36 * 60 * 60 * 1000; // 36h
        if (Math.abs(dateDiff) > RECENCY_WINDOW_MS) return dateDiff;

        const pulseDiff = Number(isPulse(b)) - Number(isPulse(a));
        if (pulseDiff !== 0) return pulseDiff;
        const evergreenDiff = Number(isEvergreen(a)) - Number(isEvergreen(b));
        if (evergreenDiff !== 0) return evergreenDiff;
        const communityDiff = Number(isCommunity(a)) - Number(isCommunity(b));
        if (communityDiff !== 0) return communityDiff;
        return dateDiff;
      });
    }

    return sorted;
  }, [filteredPosts, normalizedCategory]);

  const featuredPosts = useMemo(() => {
    const kind = (post: Post) => getSourceKind({ sourceId: post.sourceId, sourceUrl: post.sourceUrl });
    const isTrusted = (post: Post) => {
      const k = kind(post);
      return k === 'official' || k === 'news' || k === 'evergreen' || k === 'roundup';
    };

    const trustedFirst = orderedPosts.filter(isTrusted).slice(0, 2);
    if (trustedFirst.length >= 2) return trustedFirst;
    const fill = orderedPosts
      .filter((p) => !trustedFirst.some((x) => x.slug === p.slug))
      .slice(0, 2 - trustedFirst.length);
    return [...trustedFirst, ...fill];
  }, [orderedPosts]);

  const gridPosts = useMemo(() => {
    const used = new Set(featuredPosts.map((p) => p.slug));
    const rest = orderedPosts.filter((p) => !used.has(p.slug));
    return rest.slice(0, 4);
  }, [featuredPosts, orderedPosts]);

  const trendingPosts = useMemo(() => (
    (() => {
      const pulse = posts.filter((post) => post.tags.some((t) => t.toLowerCase() === 'k-ai-pulse'));
      const sortedPulse = [...pulse].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sortedPulse.length >= 4) return sortedPulse.slice(0, 4);

      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      const inLastDays = (days: number) => {
        const since = now - days * DAY_MS;
        return posts.filter((p) => new Date(p.date).getTime() >= since);
      };

      const pick = (candidates: Post[]) => {
        const kind = (post: Post) => getSourceKind({ sourceId: post.sourceId, sourceUrl: post.sourceUrl });
        const trustBoost = (post: Post) => {
          const k = kind(post);
          if (k === 'official' || k === 'news') return 0.25;
          if (k === 'evergreen' || k === 'roundup') return 0.15;
          return 0;
        };

        const scored = candidates
          .map((p) => {
            const dt = new Date(p.date).getTime();
            const ageDays = Number.isNaN(dt) ? 999 : Math.max(0, Math.floor((now - dt) / DAY_MS));
            const recencyBoost = Math.max(0, 1 - ageDays / 21); // strongest inside ~3 weeks
            const verification = Math.max(0, Math.min(1, p.verificationScore || 0));
            const pulseBonus = p.tags.some((t) => t.toLowerCase() === 'k-ai-pulse') ? 0.2 : 0;
            return {
              post: p,
              score: verification * 1.1 + recencyBoost * 0.9 + trustBoost(p) + pulseBonus,
            };
          })
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return new Date(b.post.date).getTime() - new Date(a.post.date).getTime();
          })
          .map((x) => x.post);

        return scored.slice(0, 4);
      };

      // Keep "Trending" actually current; widen only if necessary.
      const recent30 = inLastDays(30);
      if (recent30.length >= 4) return pick(recent30);
      const recent120 = inLastDays(120);
      if (recent120.length >= 4) return pick(recent120);
      return pick(posts);
    })()
  ), [posts]);

  const popularTags = useMemo(() => {
    const exclude = new Set(['k-ai-pulse', 'explainer', 'deep-dive', 'article', 'ai']);
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    const RECENT_DAYS = 21;
    const recent = posts.filter((p) => new Date(p.date).getTime() >= now - RECENT_DAYS * DAY_MS);
    const pool = recent.length >= 24 ? recent : posts;

    const counts = new Map<string, number>();
    for (const post of pool) {
      for (const raw of post.tags) {
        const tag = String(raw || '').trim().toLowerCase();
        if (!tag || exclude.has(tag)) continue;
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14)
      .map(([tag]) => tag);
  }, [posts]);

  return (
    <main className="w-full max-w-7xl mx-auto px-6 pb-20">
      {/* Category Chips */}
      <div className="flex flex-wrap gap-2 mb-12 justify-center lg:justify-start">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            aria-pressed={selectedCategory === category.id}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedCategory === category.id
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 scale-105'
                : 'bg-gray-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            {category.label[locale]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Article Feed (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-16">
          {orderedPosts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                {locale === 'ko'
                  ? '해당 카테고리의 글이 없습니다'
                  : 'No posts found in this category'}
              </p>
              <button
                onClick={() => setSelectedCategory('all')}
                className="mt-4 px-4 py-2 text-primary hover:underline"
              >
                {locale === 'ko' ? '전체 글 보기' : 'View all posts'}
              </button>
            </div>
          ) : (
            <>
              {/* Featured Articles */}
              {featuredPosts.map((post) => (
                <PostCard
                  key={post.slug}
                  post={post}
                  locale={locale}
                  variant="large"
                />
              ))}

              {/* Grid of smaller articles */}
              {gridPosts.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12">
                  {gridPosts.map((post) => (
                    <PostCard
                      key={post.slug}
                      post={post}
                      locale={locale}
                      variant="small"
                    />
                  ))}
                </div>
              )}

              {/* Load More */}
              {orderedPosts.length > 6 && (
                <div className="flex justify-center pt-8">
                  <Link
                    href={`/${locale}/posts`}
                    className="px-8 py-3 border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors font-bold text-sm"
                  >
                    {locale === 'ko' ? '더 보기' : 'Load More Articles'}
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar (Right 4 cols) */}
        <div className="lg:col-span-4">
          <Sidebar
            locale={locale}
            trendingPosts={trendingPosts}
            popularTags={popularTags}
          />
        </div>
      </div>
    </main>
  );
}
