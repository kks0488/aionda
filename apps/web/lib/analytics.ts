'use client';

type GtagFn = (command: 'config' | 'event', targetIdOrEventName: string, params?: Record<string, unknown>) => void;

function getGtag(): GtagFn | null {
  if (typeof window === 'undefined') return null;
  const anyWindow = window as unknown as { gtag?: GtagFn };
  return typeof anyWindow.gtag === 'function' ? anyWindow.gtag : null;
}

export function trackPageView(trackingId: string, url: string) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('config', trackingId, { page_path: url });
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', eventName, params || {});
}

