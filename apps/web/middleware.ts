import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const SUPPORTED_LOCALES = new Set(['en', 'ko']);
const DEFAULT_LOCALE = 'ko';
const LOCALE_HEADER = 'X-NEXT-INTL-LOCALE';

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next.js internals and common static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/feed') ||
    /\.[a-z0-9]+$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  const segments = pathname.split('/');
  const firstSegment = segments[1];

  const locale = SUPPORTED_LOCALES.has(firstSegment) ? firstSegment : DEFAULT_LOCALE;

  // Ensure next-intl can resolve the locale without relying on `next-intl/middleware`
  // (keeps Edge middleware small and avoids runtime incompatibilities).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  // Redirect bare root to default locale home.
  if (pathname === '/' || pathname === '') {
    const url = request.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/:path*'],
};
