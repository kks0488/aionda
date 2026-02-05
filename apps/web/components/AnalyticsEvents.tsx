'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

function safeParseParams(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function getLinkInfo(element: HTMLElement): { url?: string; domain?: string; path?: string } {
  const anchor = element.tagName.toLowerCase() === 'a'
    ? (element as HTMLAnchorElement)
    : (element.closest('a') as HTMLAnchorElement | null);

  const href = anchor?.href;
  if (!href) return {};

  try {
    const url = new URL(href, window.location.href);
    const domain = url.hostname.replace(/^www\./, '');
    const path = `${url.pathname}${url.search}`;
    return { url: url.toString(), domain, path };
  } catch {
    return { url: href };
  }
}

export default function AnalyticsEvents() {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const element = target.closest<HTMLElement>('[data-analytics-event]');
      if (!element) return;

      const name = element.getAttribute('data-analytics-event');
      if (!name) return;

      const params = safeParseParams(element.getAttribute('data-analytics-params'));
      const linkInfo = getLinkInfo(element);

      trackEvent(name, {
        ...params,
        ...(linkInfo.domain ? { link_domain: linkInfo.domain } : {}),
        ...(linkInfo.path ? { link_path: linkInfo.path } : {}),
      });
    };

    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, []);

  return null;
}

