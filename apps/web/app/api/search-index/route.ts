import { NextRequest, NextResponse } from 'next/server';
import { locales, type Locale } from '@/i18n';
import { getPostSummaries } from '@/lib/posts';

type SearchIndexPost = {
  slug: string;
  title: string;
  description: string;
  tags: string[];
};

const LOCALES = new Set<string>(locales);

export function GET(request: NextRequest) {
  const localeParam = (request.nextUrl.searchParams.get('locale') || 'ko').trim();
  if (!LOCALES.has(localeParam)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const locale = localeParam as Locale;
  const posts: SearchIndexPost[] = getPostSummaries(locale).map((post) => ({
    slug: post.slug,
    title: post.title,
    description: post.description,
    tags: Array.isArray(post.tags) ? post.tags : [],
  }));

  return NextResponse.json(
    { posts },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}
