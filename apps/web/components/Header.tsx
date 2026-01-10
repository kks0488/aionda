'use client';

import Link from 'next/link';
import type { Locale } from '@/i18n';

interface HeaderProps {
  locale: Locale;
}

export default function Header({ locale }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2 group cursor-pointer">
          <span className="material-symbols-outlined text-primary text-3xl icon-filled">all_inclusive</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Aionda</h1>
        </Link>

        <div className="flex items-center gap-4">
          <button className="p-2 text-slate-600 hover:text-primary transition-colors dark:text-slate-300">
            <span className="material-symbols-outlined">search</span>
          </button>

          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-md p-1 border border-gray-200 dark:border-gray-700">
            <Link
              href="/en"
              className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${
                locale === 'en'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              EN
            </Link>
            <Link
              href="/ko"
              className={`px-3 py-1 text-xs font-bold rounded-sm transition-all ${
                locale === 'ko'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              KR
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
