'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n';

interface ShareButtonsProps {
  url: string;
  title: string;
  locale: Locale;
}

export default function ShareButtons({ url, title, locale }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-gray-100 dark:border-gray-800 flex items-center justify-start gap-5">
      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        {locale === 'ko' ? '공유하기:' : 'Share this article:'}
      </span>
      <div className="flex gap-3">
        <button
          onClick={handleCopyLink}
          className="p-2 bg-gray-50 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:text-primary transition-colors relative"
          title={locale === 'ko' ? '링크 복사' : 'Copy link'}
        >
          {copied ? (
            <span className="material-symbols-outlined text-lg text-green-500">check</span>
          ) : (
            <span className="material-symbols-outlined text-lg">link</span>
          )}
        </button>
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-gray-50 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
          title={locale === 'ko' ? '트위터에 공유' : 'Share on Twitter'}
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.37-.83.5-1.75.85-2.72 1.05C18.3 4.6 17.21 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.53 7.6 3.73 5.36c-.37.64-.58 1.39-.58 2.22 0 1.49.75 2.81 1.91 3.56-.7-.02-1.35-.22-1.92-.53v.03c0 2.08 1.48 3.82 3.44 4.21-.36.1-.73.15-1.11.15-.27 0-.53-.03-.79-.08.55 1.71 2.13 2.95 4.02 2.98-1.48 1.16-3.34 1.85-5.36 1.85-.35 0-.69-.02-1.03-.06C2.78 20.29 4.93 21 7.27 21c8.74 0 13.51-7.22 13.51-13.5l-.01-.61.47-.36c.8-.62 1.47-1.37 2-2.19z" />
          </svg>
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`}
          className="p-2 bg-gray-50 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
          title={locale === 'ko' ? '이메일로 공유' : 'Share via Email'}
        >
          <span className="material-symbols-outlined text-lg">email</span>
        </a>
      </div>
    </div>
  );
}
