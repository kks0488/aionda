'use client';

import { useMemo } from 'react';
import type { Locale } from '@/i18n';
import { trackEvent } from '@/lib/analytics';

const BUTTONDOWN_HANDLE = process.env.NEXT_PUBLIC_NEWSLETTER_BUTTONDOWN_HANDLE?.trim();

export default function NewsletterSignup({
  locale,
  from,
}: {
  locale: Locale;
  from: 'home' | 'post';
}) {
  const action = useMemo(() => {
    if (!BUTTONDOWN_HANDLE) return '';
    return `https://buttondown.email/api/emails/embed-subscribe/${encodeURIComponent(BUTTONDOWN_HANDLE)}`;
  }, []);

  const title = locale === 'ko' ? '업데이트 받기' : 'Get updates';
  const description = locale === 'ko'
    ? '주간 요약과 중요한 업데이트만 모아서 보내드려요.'
    : 'A weekly digest of what actually matters.';

  if (!action) {
    return (
      <section className="mt-12 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {from !== 'home' && (
            <a
              href={`/${locale}/feed.xml`}
              className="inline-flex items-center justify-center h-10 px-4 rounded-lg bg-primary text-white font-bold hover:opacity-95 transition-opacity"
              data-analytics-event="rss_click"
              data-analytics-params={JSON.stringify({ from: `${from}_newsletter_fallback`, locale })}
            >
              {locale === 'ko' ? 'RSS로 구독' : 'Subscribe via RSS'}
            </a>
          )}
          <a
            href={`mailto:kks0488@gmail.com?subject=${encodeURIComponent(locale === 'ko' ? 'Aionda 업데이트 문의' : 'Aionda updates')}`}
            className="inline-flex items-center justify-center h-10 px-4 rounded-lg border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            data-analytics-event="newsletter_signup"
            data-analytics-params={JSON.stringify({ provider: 'mailto', from, locale })}
          >
            {locale === 'ko' ? '메일로 문의' : 'Email'}
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-12 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30 p-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{description}</p>

      <form
        action={action}
        method="post"
        target="_blank"
        className="mt-4 flex flex-col sm:flex-row gap-3"
        onSubmit={() => {
          trackEvent('newsletter_signup', { provider: 'buttondown', from, locale });
        }}
      >
        <input type="hidden" name="embed" value="1" />
        <input
          type="email"
          required
          name="email"
          aria-label={locale === 'ko' ? '이메일 주소' : 'Email address'}
          placeholder={locale === 'ko' ? '이메일 주소' : 'Email address'}
          className="flex-1 h-11 px-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-slate-950/30 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          className="h-11 px-5 rounded-lg bg-primary text-white font-bold shadow-sm hover:opacity-95 transition-opacity"
        >
          {locale === 'ko' ? '구독하기' : 'Subscribe'}
        </button>
      </form>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        {locale === 'ko'
          ? '원치 않으면 언제든 구독을 해지할 수 있어요.'
          : 'Unsubscribe anytime.'}
      </p>
    </section>
  );
}
