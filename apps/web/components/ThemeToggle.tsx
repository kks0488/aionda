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
        className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700"
        aria-label={locale === 'ko' ? '테마 로딩 중' : 'Loading theme'}
      >
        <span className="material-symbols-outlined text-lg text-slate-400" aria-hidden="true">
          contrast
        </span>
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:text-primary transition-colors"
      aria-label={
        isDark
          ? locale === 'ko' ? '라이트 모드로 전환' : 'Switch to light mode'
          : locale === 'ko' ? '다크 모드로 전환' : 'Switch to dark mode'
      }
    >
      {isDark ? (
        <span className="material-symbols-outlined text-lg" aria-hidden="true">light_mode</span>
      ) : (
        <span className="material-symbols-outlined text-lg" aria-hidden="true">dark_mode</span>
      )}
    </button>
  );
}
