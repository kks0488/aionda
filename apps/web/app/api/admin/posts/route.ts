import { NextRequest } from 'next/server';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { isLocalHost, isLocalOnlyEnabled } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');
const LOCALES = new Set(['en', 'ko', 'ja', 'es']);

const ADMIN_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function adminJson(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, { ...init, headers: ADMIN_HEADERS });
}

function requireLocal(request: NextRequest): Response | null {
  if (!isLocalOnlyEnabled()) return null;

  const host =
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    request.nextUrl.hostname;

  if (!isLocalHost(host)) {
    return adminJson({ error: 'Not found' }, { status: 404 });
  }

  return null;
}

function requireAdmin(request: NextRequest): Response | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return adminJson({ error: 'Admin API key not configured' }, { status: 500 });
  }

  const provided = request.headers.get('x-api-key');
  if (provided !== expected) {
    return adminJson({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function normalizeTags(rawTags: unknown): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.map(String);
  return [String(rawTags)];
}

export async function GET(request: NextRequest) {
  const local = requireLocal(request);
  if (local) return local;

  const auth = requireAdmin(request);
  if (auth) return auth;

  const locale = request.nextUrl.searchParams.get('locale') || 'ko';
  if (!LOCALES.has(locale)) {
    return adminJson({ error: 'Invalid locale' }, { status: 400 });
  }

  const localeDir = path.join(POSTS_DIR, locale);
  if (!existsSync(localeDir)) {
    return adminJson({ posts: [] });
  }

  const files = readdirSync(localeDir).filter((file) => file.endsWith('.mdx') || file.endsWith('.md'));
  const posts = files.map((file) => {
    const fullPath = path.join(localeDir, file);
    const raw = readFileSync(fullPath, 'utf8');
    const { data } = matter(raw);
    const slug = file.replace(/\.mdx?$/, '');

    return {
      slug,
      title: data.title || slug,
      description: data.description || data.excerpt || '',
      date: data.date || '',
      tags: normalizeTags(data.tags),
      coverImage: data.coverImage || '',
      verificationScore: data.verificationScore,
      sourceUrl: data.sourceUrl || '',
      sourceId: data.sourceId || '',
    };
  });

  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return adminJson({ posts });
}
