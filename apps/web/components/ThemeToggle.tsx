'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  locale: string;
}

export default function ThemeToggle({ locale }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="h-9 px-3 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-xs font-bold text-slate-500 dark:text-slate-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={locale === 'ko' ? '테마 로딩 중' : 'Loading theme'}
      >
        {locale === 'ko' ? '테마' : 'Theme'}
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-9 px-3 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-slate-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors text-xs font-bold"
      aria-label={
        isDark
          ? locale === 'ko' ? '라이트 모드로 전환' : 'Switch to light mode'
          : locale === 'ko' ? '다크 모드로 전환' : 'Switch to dark mode'
      }
    >
      {locale === 'ko' ? (isDark ? '다크' : '라이트') : (isDark ? 'Dark' : 'Light')}
    </button>
  );
}
