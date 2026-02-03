'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n';
import { useSearch } from './SearchProvider';
import ThemeToggle from './ThemeToggle';

interface HeaderProps {
  locale: Locale;
}

export default function Header({ locale }: HeaderProps) {
  const { openSearch } = useSearch();
  const pathname = usePathname();

  // Get current path without locale prefix for language switching
  const parts = pathname.split('/').filter(Boolean);
  const isLocalePrefixed = parts.length > 0 && locales.includes(parts[0] as Locale);
  const currentPath = isLocalePrefixed ? `/${parts.slice(1).join('/')}` : pathname;

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
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-2 group cursor-pointer"
          aria-label={locale === 'ko' ? 'AI온다 홈으로 가기' : 'Go to Aionda home'}
        >
          <span className="material-symbols-outlined text-primary text-3xl icon-filled" aria-hidden="true">all_inclusive</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {locale === 'ko' ? 'AI온다' : 'Aionda'}
          </h1>
        </Link>

        <nav
          aria-label={locale === 'ko' ? '주요 메뉴' : 'Primary navigation'}
          className="hidden md:flex items-center gap-1 flex-1"
        >
          <Link
            href={`/${locale}/posts`}
            className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
          >
            {locale === 'ko' ? '글' : 'Posts'}
          </Link>
          <Link
            href={`/${locale}/tags`}
            className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
          >
            {locale === 'ko' ? '태그' : 'Tags'}
          </Link>
          <Link
            href={`/${locale}/about`}
            className="px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-primary transition-colors"
          >
            {locale === 'ko' ? '소개' : 'About'}
          </Link>
          <a
            href="/feed.xml"
            className="ml-2 inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-gray-300 dark:hover:border-gray-600 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">rss_feed</span>
            RSS
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={openSearch}
            aria-label={locale === 'ko' ? '검색 열기 (⌘K)' : 'Open search (⌘K)'}
            className="flex items-center gap-2 h-9 px-3 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-gray-100 dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-gray-700 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
          >
            <span className="material-symbols-outlined text-lg" aria-hidden="true">search</span>
            <span className="hidden sm:inline text-sm">{locale === 'ko' ? '검색' : 'Search'}</span>
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
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}${currentPath}`}
                aria-current={locale === l ? 'page' : undefined}
                className={`flex items-center px-3 text-xs font-bold rounded-md transition-all ${
                  locale === l
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {l.toUpperCase()}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
