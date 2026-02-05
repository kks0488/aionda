'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { trackPageView } from '@/lib/analytics';

const GA_TRACKING_ID = process.env.NEXT_PUBLIC_GA_ID;

export default function GoogleAnalytics() {
  useEffect(() => {
    if (!GA_TRACKING_ID) return;

    const anyWindow = window as unknown as { __aiondaHistoryPatched?: boolean };
    if (!anyWindow.__aiondaHistoryPatched) {
      anyWindow.__aiondaHistoryPatched = true;
      const pushState = history.pushState.bind(history);
      const replaceState = history.replaceState.bind(history);

      history.pushState = (...args) => {
        const result = pushState(...args);
        window.dispatchEvent(new Event('aionda:navigation'));
        return result;
      };

      history.replaceState = (...args) => {
        const result = replaceState(...args);
        window.dispatchEvent(new Event('aionda:navigation'));
        return result;
      };
    }

    const handler = () => {
      const url = `${window.location.pathname}${window.location.search}`;
      trackPageView(GA_TRACKING_ID, url);
    };

    window.addEventListener('popstate', handler);
    window.addEventListener('aionda:navigation', handler);
    handler();

    return () => {
      window.removeEventListener('popstate', handler);
      window.removeEventListener('aionda:navigation', handler);
    };
  }, []);

  if (!GA_TRACKING_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_TRACKING_ID}', {
            page_path: window.location.pathname + window.location.search,
          });
        `}
      </Script>
    </>
  );
}
