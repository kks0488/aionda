import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { defaultLocale, locales } from '@/i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: false,
});

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://www.googletagservices.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com https://pagead2.googlesyndication.com https:",
    "frame-src https://www.google.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export default function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const intlRequest = new NextRequest(request.url, {
    method: request.method,
    headers: requestHeaders,
  });

  const response =
    request.nextUrl.pathname === '/'
      ? NextResponse.redirect(new URL(`/${defaultLocale}`, request.url))
      : intlMiddleware(intlRequest);

  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  response.headers.set('x-nonce', nonce);

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
