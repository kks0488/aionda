import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export default function middleware(request: NextRequest) {
  try {
    return intlMiddleware(request);
  } catch {
    // Fail open to avoid taking the entire site down if middleware crashes in production.
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/', '/(en|ko)/:path*'],
};
