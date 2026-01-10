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

  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'all') return posts;
    return posts.filter((post) =>
      post.tags.some((tag) => tag.toLowerCase().includes(selectedCategory.toLowerCase()))
    );
  }, [posts, selectedCategory]);

  const featuredPosts = filteredPosts.slice(0, 2);
  const gridPosts = filteredPosts.slice(2, 6);
  const trendingPosts = [...posts]
    .sort((a, b) => (b.verificationScore || 0) - (a.verificationScore || 0))
    .slice(0, 4);

  return (
    <main className="w-full max-w-7xl mx-auto px-6 pb-20">
      {/* Category Chips */}
      <div className="flex flex-wrap gap-2 mb-12 justify-center lg:justify-start">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => setSelectedCategory(category.id)}
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
          {filteredPosts.length === 0 ? (
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
              {filteredPosts.length > 6 && (
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
