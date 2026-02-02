'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';
import PostCard from './PostCard';
import Sidebar from './Sidebar';

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
        return dateDiff;
      });
    }

    return sorted;
  }, [filteredPosts, normalizedCategory]);

  const featuredPosts = orderedPosts.slice(0, 2);
  const gridPosts = orderedPosts.slice(2, 6);
  const trendingPosts = useMemo(() => (
    (() => {
      const pulse = posts.filter((post) => post.tags.some((t) => t.toLowerCase() === 'k-ai-pulse'));
      const sortedPulse = [...pulse].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sortedPulse.length >= 4) return sortedPulse.slice(0, 4);
      const fallback = [...posts].sort((a, b) => (b.verificationScore || 0) - (a.verificationScore || 0));
      return fallback.slice(0, 4);
    })()
  ), [posts]);

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
              <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-500 mb-4">
                search_off
              </span>
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
          <Sidebar locale={locale} trendingPosts={trendingPosts} />
        </div>
      </div>
    </main>
  );
}
