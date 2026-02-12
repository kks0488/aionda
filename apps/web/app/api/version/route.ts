import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (isProduction) {
    return NextResponse.json(
      { status: 'ok' },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }

  return NextResponse.json(
    {
      status: 'ok',
      commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      deploymentUrl: process.env.VERCEL_URL ?? null,
      gitRepo: process.env.VERCEL_GIT_REPO_SLUG ?? null,
      gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      environment: process.env.VERCEL_ENV ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
      timestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
