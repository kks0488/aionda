'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n';
import { useSearch } from './SearchProvider';

type MobileNavProps = {
  locale: Locale;
};

function normalizePathname(pathname: string): string {
  if (!pathname) return '';
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export default function MobileNav({ locale }: MobileNavProps) {
  const pathname = usePathname();
  const { openSearch } = useSearch();

  const normalized = normalizePathname(pathname);
  const localePrefix = `/${locale}`;
  const postsPrefix = `${localePrefix}/posts`;
  const tagsPrefix = `${localePrefix}/tags`;

  if (normalized.startsWith(`${localePrefix}/admin`)) return null;

  const isHome = normalized === localePrefix;
  const isPosts = normalized === postsPrefix || normalized.startsWith(`${postsPrefix}/`);
  const isTags = normalized === tagsPrefix || normalized.startsWith(`${tagsPrefix}/`);

  const baseItem =
    'group flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 transition-all select-none';
  const activeItem = 'bg-primary/10 text-primary shadow-[0_10px_30px_rgba(13,127,242,0.18)]';
  const inactiveItem =
    'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10';

  return (
    <nav
      aria-label={locale === 'ko' ? '하단 네비게이션' : 'Bottom navigation'}
      className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[min(560px,calc(100%-1.5rem))]"
    >
      <div className="relative rounded-[28px] border border-gray-200/70 dark:border-gray-700/70 bg-white/85 dark:bg-[#101922]/80 backdrop-blur-xl shadow-[0_18px_55px_rgba(0,0,0,0.18)]">
        <div className="grid grid-cols-4 px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <Link
            href={`/${locale}`}
            aria-current={isHome ? 'page' : undefined}
            className={`${baseItem} ${isHome ? activeItem : inactiveItem}`}
          >
            <span
              className={`material-symbols-outlined text-[22px] ${isHome ? 'icon-filled' : ''}`}
              aria-hidden="true"
            >
              home
            </span>
            <span className="text-[11px] font-bold tracking-tight">
              {locale === 'ko' ? '홈' : 'Home'}
            </span>
          </Link>

          <Link
            href={`/${locale}/posts`}
            aria-current={isPosts ? 'page' : undefined}
            className={`${baseItem} ${isPosts ? activeItem : inactiveItem}`}
          >
            <span
              className={`material-symbols-outlined text-[22px] ${isPosts ? 'icon-filled' : ''}`}
              aria-hidden="true"
            >
              article
            </span>
            <span className="text-[11px] font-bold tracking-tight">
              {locale === 'ko' ? '글' : 'Posts'}
            </span>
          </Link>

          <Link
            href={`/${locale}/tags`}
            aria-current={isTags ? 'page' : undefined}
            className={`${baseItem} ${isTags ? activeItem : inactiveItem}`}
          >
            <span
              className={`material-symbols-outlined text-[22px] ${isTags ? 'icon-filled' : ''}`}
              aria-hidden="true"
            >
              tag
            </span>
            <span className="text-[11px] font-bold tracking-tight">
              {locale === 'ko' ? '태그' : 'Tags'}
            </span>
          </Link>

          <button
            type="button"
            onClick={openSearch}
            className={`${baseItem} ${inactiveItem}`}
            aria-label={locale === 'ko' ? '검색 열기' : 'Open search'}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              search
            </span>
            <span className="text-[11px] font-bold tracking-tight">
              {locale === 'ko' ? '검색' : 'Search'}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}

