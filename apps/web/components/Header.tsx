'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Locale } from '@/i18n';

interface HeaderProps {
  locale: Locale;
}

export default function Header({ locale }: HeaderProps) {
  const t = useTranslations('nav');
  const otherLocale = locale === 'en' ? 'ko' : 'en';

  return (
    <header className="border-b border-gray-200 dark:border-gray-800">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href={`/${locale}`} className="text-xl font-bold text-accent">
          AI온다
        </Link>

        <div className="flex items-center gap-6">
          <Link
            href={`/${locale}`}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {t('home')}
          </Link>
          <Link
            href={`/${locale}/posts`}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {t('posts')}
          </Link>
          <Link
            href={`/${locale}/about`}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            {t('about')}
          </Link>

          {/* Language Switcher */}
          <Link
            href={`/${otherLocale}`}
            className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            {locale === 'en' ? '한국어' : 'English'}
          </Link>
        </div>
      </nav>
    </header>
  );
}
