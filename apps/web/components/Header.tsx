'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n';
import { useSearch } from './SearchProvider';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  locale: Locale;
}

export default function Header({ locale }: HeaderProps) {
  const { openSearch } = useSearch();
  const pathname = usePathname();

  // Get current path without locale prefix for language switching
  const currentPath = pathname.replace(/^\/(en|ko)/, '') || '';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        openSearch();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [openSearch]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 dark:bg-[#101922]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 group cursor-pointer"
          aria-label={locale === 'ko' ? 'AI온다 홈으로 가기' : 'Go to Aionda home'}
        >
          <span className="material-symbols-outlined text-primary text-3xl icon-filled" aria-hidden="true">all_inclusive</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Aionda</h1>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={openSearch}
            aria-label={locale === 'ko' ? '검색 열기 (⌘K)' : 'Open search (⌘K)'}
            className="flex items-center gap-2 h-9 px-3 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">search</span>
            <span className="hidden sm:inline text-sm">Search</span>
            <kbd className="hidden sm:inline ml-1 px-1.5 py-0.5 text-xs font-medium bg-white dark:bg-slate-700 rounded border border-gray-200 dark:border-gray-600" aria-hidden="true">
              ⌘K
            </kbd>
          </button>

          <ThemeToggle locale={locale} />

          <nav
            role="group"
            aria-label={locale === 'ko' ? '언어 선택' : 'Language selection'}
            className="flex h-9 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700"
          >
            <Link
              href={`/en${currentPath}`}
              aria-current={locale === 'en' ? 'page' : undefined}
              className={`flex items-center px-3 text-xs font-bold rounded-md transition-all ${
                locale === 'en'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              EN
            </Link>
            <Link
              href={`/ko${currentPath}`}
              aria-current={locale === 'ko' ? 'page' : undefined}
              className={`flex items-center px-3 text-xs font-bold rounded-md transition-all ${
                locale === 'ko'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              KO
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
