'use client';

import Link from 'next/link';
import type { PostSummary } from '@/lib/posts';
import type { Locale } from '@/i18n';

interface PostNavigationProps {
  prevPost: PostSummary | null;
  nextPost: PostSummary | null;
  locale: Locale;
}

export default function PostNavigation({ prevPost, nextPost, locale }: PostNavigationProps) {
  if (!prevPost && !nextPost) return null;

  return (
    <nav className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Previous Post */}
        {prevPost ? (
          <Link
            href={`/${locale}/posts/${prevPost.slug}`}
            className="group flex flex-col p-5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all"
          >
            <span className="text-xs font-medium text-slate-400 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              {locale === 'ko' ? '← 이전 글' : '← Previous'}
            </span>
            <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {prevPost.title}
            </span>
          </Link>
        ) : (
          <div />
        )}

        {/* Next Post */}
        {nextPost ? (
          <Link
            href={`/${locale}/posts/${nextPost.slug}`}
            className="group flex flex-col p-5 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all text-right"
          >
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-3 flex items-center gap-1.5 justify-end">
              {locale === 'ko' ? '다음 글 →' : 'Next →'}
            </span>
            <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {nextPost.title}
            </span>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </nav>
  );
}
