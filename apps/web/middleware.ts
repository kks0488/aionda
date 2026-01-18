import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export default function middleware(request: NextRequest) {
  // Temporarily disable next-intl middleware to prevent production 500s
  // (MIDDLEWARE_INVOCATION_FAILED) on Vercel Edge runtime.
  return NextResponse.next();
}

export const config = {
  // Run on all non-static routes
  matcher: ['/((?!_next|.*\\..*).*)'],
};
