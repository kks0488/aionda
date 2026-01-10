'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';

interface SidebarProps {
  locale: Locale;
  trendingPosts?: Post[];
}

export default function Sidebar({ locale, trendingPosts = [] }: SidebarProps) {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsLoading(false);
    setIsSubmitted(true);
    setEmail('');

    // Reset after 3 seconds
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  return (
    <aside className="space-y-12">
      {/* About Widget */}
      <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/50">
        <h3 className="text-lg font-bold mb-3 text-slate-900 dark:text-white">Origin</h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
          {locale === 'ko' ? (
            <>
              Aionda는 DC Inside <span className="font-bold text-slate-900 dark:text-white">'thesingularity'</span> 갤러리의 집단 지성에서 탄생했습니다. AI 시대의 기술 발전을 추적합니다.
            </>
          ) : (
            <>
              Aionda was born from the collective intelligence of DC Inside <span className="font-bold text-slate-900 dark:text-white">'thesingularity'</span> gallery. Tracking the exponential curve of technological progress.
            </>
          )}
        </p>
        <Link
          href={`/${locale}/about`}
          className="text-primary text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
        >
          {locale === 'ko' ? '더 알아보기' : 'Read More'}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      {/* Trending Topics */}
      {trendingPosts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">trending_up</span>
            {locale === 'ko' ? '인기 글' : 'Trending Now'}
          </h3>
          <div className="space-y-6">
            {trendingPosts.slice(0, 4).map((post, index) => (
              <Link
                key={post.slug}
                href={`/${locale}/posts/${post.slug}`}
                className="group flex gap-4 items-start"
              >
                <span className="text-3xl font-bold text-slate-200 dark:text-slate-700 group-hover:text-primary transition-colors leading-none">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-snug line-clamp-2">
                    {post.title}
                  </h4>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {post.verificationScore ? `${Math.round(post.verificationScore * 100)}% verified` : ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Newsletter */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'ko' ? '뉴스레터' : 'Daily Digest'}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          {locale === 'ko'
            ? '매일 아침 AI 뉴스를 받아보세요.'
            : 'Get the top AI news every morning.'}
        </p>

        {isSubmitted ? (
          <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            <span className="text-sm font-medium">
              {locale === 'ko' ? '구독해주셔서 감사합니다!' : 'Thanks for subscribing!'}
            </span>
          </div>
        ) : (
          <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="bg-primary text-white rounded-lg px-3 py-2 hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              )}
            </button>
          </form>
        )}
      </div>
    </aside>
  );
}
