import type { Locale } from '@/i18n';
import { getSourceBadge, getSourceHostname, getSourceKind } from '@/lib/source-utils';

export default function SourceBadge({
  locale,
  sourceId,
  sourceUrl,
  compact = false,
}: {
  locale: Locale;
  sourceId?: string;
  sourceUrl?: string;
  compact?: boolean;
}) {
  const kind = getSourceKind({ sourceId, sourceUrl });
  const badge = getSourceBadge(locale, kind);
  const host = getSourceHostname(sourceUrl);

  const toneClass =
    badge.tone === 'success'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60'
      : badge.tone === 'info'
        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/60'
        : badge.tone === 'warn'
          ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60'
          : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700';

  const sizeClass = compact ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${toneClass} ${sizeClass} font-semibold tracking-tight`}
      title={host || undefined}
    >
      <span className={`material-symbols-outlined ${compact ? 'text-[14px]' : 'text-[16px]'} icon-filled`} aria-hidden="true">
        {badge.icon}
      </span>
      <span className="leading-none">{badge.label}</span>
      {host && !compact && (
        <span className="ml-1 hidden md:inline text-[11px] font-medium opacity-70">
          {host}
        </span>
      )}
    </span>
  );
}

