'use client';

import Link from 'next/link';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';

interface PostNavigationProps {
  prevPost: Post | null;
  nextPost: Post | null;
  locale: Locale;
}

export default function PostNavigation({ prevPost, nextPost, locale }: PostNavigationProps) {
  if (!prevPost && !nextPost) return null;

  return (
    <nav className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Previous Post */}
        {prevPost ? (
          <Link
            href={`/${locale}/posts/${prevPost.slug}`}
            className="group flex flex-col p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all"
          >
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              {locale === 'ko' ? '이전 글' : 'Previous'}
            </span>
            <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
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
            className="group flex flex-col p-4 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-primary/30 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-all text-right"
          >
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1 justify-end">
              {locale === 'ko' ? '다음 글' : 'Next'}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </span>
            <span className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
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
