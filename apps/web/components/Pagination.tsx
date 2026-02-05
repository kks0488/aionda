import Link from 'next/link';
import { buildPageHref } from '@/lib/pagination';
import type { Locale } from '@/i18n';

type PageToken = number | 'ellipsis';

function buildTokens(currentPage: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const tokens: PageToken[] = [];
  const add = (value: PageToken) => tokens.push(value);

  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  add(1);

  if (windowStart > 2) add('ellipsis');
  for (let p = windowStart; p <= windowEnd; p++) add(p);
  if (windowEnd < totalPages - 1) add('ellipsis');

  add(totalPages);

  // Ensure current page is present.
  if (!tokens.includes(currentPage)) {
    const insertion = Math.min(Math.max(2, currentPage), totalPages - 1);
    const idx = tokens.findIndex((t) => typeof t === 'number' && t > insertion);
    tokens.splice(idx === -1 ? tokens.length - 1 : idx, 0, insertion);
  }

  // De-duplicate consecutive ellipsis.
  return tokens.filter((t, idx) => !(t === 'ellipsis' && tokens[idx - 1] === 'ellipsis'));
}

export default function Pagination({
  baseHref,
  currentPage,
  totalPages,
  locale,
  analyticsFrom,
}: {
  baseHref: string;
  currentPage: number;
  totalPages: number;
  locale: Locale;
  analyticsFrom: string;
}) {
  if (totalPages <= 1) return null;

  const clampedCurrent = Math.min(Math.max(1, currentPage), totalPages);
  const tokens = buildTokens(clampedCurrent, totalPages);
  const prevHref = buildPageHref(baseHref, clampedCurrent - 1);
  const nextHref = buildPageHref(baseHref, clampedCurrent + 1);

  return (
    <nav
      className="mt-10 flex items-center justify-center gap-2"
      aria-label={locale === 'ko' ? '페이지네이션' : 'Pagination'}
    >
      <Link
        href={prevHref}
        aria-disabled={clampedCurrent <= 1}
        tabIndex={clampedCurrent <= 1 ? -1 : 0}
        className={`h-9 px-3 inline-flex items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
          clampedCurrent <= 1
            ? 'pointer-events-none opacity-50 border-gray-200 dark:border-gray-800 text-slate-500'
            : 'border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800'
        }`}
        data-analytics-event="pagination_click"
        data-analytics-params={JSON.stringify({ from: analyticsFrom, locale, to_page: clampedCurrent - 1 })}
      >
        {locale === 'ko' ? '이전' : 'Prev'}
      </Link>

      <div className="hidden sm:flex items-center gap-2">
        {tokens.map((token, idx) => {
          if (token === 'ellipsis') {
            return (
              <span key={`e-${idx}`} className="px-1 text-slate-400" aria-hidden="true">
                …
              </span>
            );
          }

          const page = token;
          const href = buildPageHref(baseHref, page);
          const isActive = page === clampedCurrent;

          return (
            <Link
              key={page}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border text-sm font-bold transition-colors ${
                isActive
                  ? 'border-primary bg-primary text-white'
                  : 'border-gray-200 dark:border-gray-700 text-slate-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800'
              }`}
              data-analytics-event="pagination_click"
              data-analytics-params={JSON.stringify({ from: analyticsFrom, locale, to_page: page })}
            >
              {page}
            </Link>
          );
        })}
      </div>

      <span className="sm:hidden text-sm font-semibold text-slate-600 dark:text-slate-300">
        {locale === 'ko' ? `${clampedCurrent} / ${totalPages}` : `${clampedCurrent} / ${totalPages}`}
      </span>

      <Link
        href={nextHref}
        aria-disabled={clampedCurrent >= totalPages}
        tabIndex={clampedCurrent >= totalPages ? -1 : 0}
        className={`h-9 px-3 inline-flex items-center justify-center rounded-lg border text-sm font-semibold transition-colors ${
          clampedCurrent >= totalPages
            ? 'pointer-events-none opacity-50 border-gray-200 dark:border-gray-800 text-slate-500'
            : 'border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white hover:bg-gray-50 dark:hover:bg-slate-800'
        }`}
        data-analytics-event="pagination_click"
        data-analytics-params={JSON.stringify({ from: analyticsFrom, locale, to_page: clampedCurrent + 1 })}
      >
        {locale === 'ko' ? '다음' : 'Next'}
      </Link>
    </nav>
  );
}

