'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n';

interface ShareButtonsProps {
  url: string;
  title: string;
  locale: Locale;
}

export default function ShareButtons({ url, title, locale }: ShareButtonsProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2000);
  };

  return (
    <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex items-center justify-start gap-5">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        {locale === 'ko' ? '공유하기:' : 'Share this article:'}
      </span>
      <div className="flex gap-3" role="group" aria-label={locale === 'ko' ? '공유 옵션' : 'Share options'}>
        <button
          onClick={handleCopyLink}
          className="h-9 w-9 flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
          aria-label={
            copyState === 'copied'
              ? locale === 'ko' ? '복사됨!' : 'Copied!'
              : copyState === 'failed'
                ? locale === 'ko' ? '복사 실패' : 'Copy failed'
                : locale === 'ko' ? '링크 복사' : 'Copy link'
          }
          aria-live="polite"
        >
          {copyState === 'copied' ? (
            <span className="material-symbols-outlined text-lg text-green-500" aria-hidden="true">check</span>
          ) : copyState === 'failed' ? (
            <span className="material-symbols-outlined text-lg text-red-500" aria-hidden="true">error</span>
          ) : (
            <span className="material-symbols-outlined text-lg" aria-hidden="true">link</span>
          )}
        </button>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 w-9 flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
          aria-label={locale === 'ko' ? '트위터에 공유' : 'Share on Twitter'}
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.37-.83.5-1.75.85-2.72 1.05C18.3 4.6 17.21 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.53 7.6 3.73 5.36c-.37.64-.58 1.39-.58 2.22 0 1.49.75 2.81 1.91 3.56-.7-.02-1.35-.22-1.92-.53v.03c0 2.08 1.48 3.82 3.44 4.21-.36.1-.73.15-1.11.15-.27 0-.53-.03-.79-.08.55 1.71 2.13 2.95 4.02 2.98-1.48 1.16-3.34 1.85-5.36 1.85-.35 0-.69-.02-1.03-.06C2.78 20.29 4.93 21 7.27 21c8.74 0 13.51-7.22 13.51-13.5l-.01-.61.47-.36c.8-.62 1.47-1.37 2-2.19z" />
          </svg>
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`}
          className="h-9 w-9 flex items-center justify-center bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
          aria-label={locale === 'ko' ? '이메일로 공유' : 'Share via Email'}
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">email</span>
        </a>
      </div>
    </div>
  );
}
