import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export default function middleware(request: NextRequest) {
  // Temporarily disable next-intl middleware to prevent production 500s
  // (MIDDLEWARE_INVOCATION_FAILED) on Vercel Edge runtime.
  return NextResponse.next();
}

export const config = {
  // Keep matcher simple to avoid Edge runtime matcher parsing issues.
  matcher: ['/:path*'],
};
