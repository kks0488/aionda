'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  locale: string;
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M4.93 19.07l1.41-1.41" />
      <path d="M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
    </svg>
  );
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
        className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-slate-500 dark:text-slate-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label={locale === 'ko' ? '테마 로딩 중' : 'Loading theme'}
      >
        <span className="inline-block h-4 w-4 rounded-full border border-current opacity-60" aria-hidden="true" />
      </button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="h-9 w-9 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-slate-700 dark:text-slate-200 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
      aria-label={
        isDark
          ? locale === 'ko' ? '라이트 모드로 전환' : 'Switch to light mode'
          : locale === 'ko' ? '다크 모드로 전환' : 'Switch to dark mode'
      }
      title={locale === 'ko' ? (isDark ? '라이트' : '다크') : (isDark ? 'Light' : 'Dark')}
    >
      {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
