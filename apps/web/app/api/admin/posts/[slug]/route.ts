import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { NextRequest } from 'next/server';
import { adminJson, canAdminWriteLocally, getAdminRateLimitResponse, requireAdminSession } from '@/lib/admin';

export const dynamic = 'force-dynamic';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');
const LOCALES = new Set(['en', 'ko']);

function resolvePostPath(locale: string, slug: string): string | null {
  if (!slug || slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    return null;
  }

  const baseDir = path.join(POSTS_DIR, locale);
  const candidates = [path.join(baseDir, `${slug}.mdx`), path.join(baseDir, `${slug}.md`)];

  for (const fullPath of candidates) {
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

function normalizeTags(rawTags: unknown): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.map(String);
  return [String(rawTags)];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;

  const locale = request.nextUrl.searchParams.get('locale') || 'ko';
  if (!LOCALES.has(locale)) {
    return adminJson({ error: 'Invalid locale' }, { status: 400 });
  }

  const fullPath = resolvePostPath(locale, params.slug);
  if (!fullPath) {
    return adminJson({ error: 'Post not found' }, { status: 404 });
  }

  const raw = readFileSync(fullPath, 'utf8');
  const { data, content } = matter(raw);

  return adminJson({
    slug: params.slug,
    locale,
    title: data.title || params.slug,
    description: data.description || data.excerpt || '',
    date: data.date || '',
    tags: normalizeTags(data.tags),
    coverImage: data.coverImage || '',
    verificationScore: data.verificationScore,
    sourceUrl: data.sourceUrl || '',
    sourceId: data.sourceId || '',
    content: content || '',
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;

  const limited = await getAdminRateLimitResponse('write', request);
  if (limited) return limited;

  if (!canAdminWriteLocally()) {
    return adminJson(
      { error: 'File write is disabled in production. Use PR-based publish.' },
      { status: 403 }
    );
  }

  const locale = request.nextUrl.searchParams.get('locale') || 'ko';
  if (!LOCALES.has(locale)) {
    return adminJson({ error: 'Invalid locale' }, { status: 400 });
  }

  const fullPath = resolvePostPath(locale, params.slug);
  if (!fullPath) {
    return adminJson({ error: 'Post not found' }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const raw = readFileSync(fullPath, 'utf8');
  const { data, content } = matter(raw);

  const nextData = { ...data };
  if (typeof payload.title === 'string') nextData.title = payload.title.trim();
  if (typeof payload.description === 'string') nextData.description = payload.description.trim();
  if (typeof payload.date === 'string') nextData.date = payload.date.trim();

  if (typeof payload.coverImage === 'string') {
    const value = payload.coverImage.trim();
    if (value) {
      nextData.coverImage = value;
    } else {
      delete nextData.coverImage;
    }
  }

  if (payload.tags !== undefined) {
    const tags = Array.isArray(payload.tags)
      ? payload.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
      : String(payload.tags)
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
    nextData.tags = tags;
  }

  const nextContent = typeof payload.content === 'string' ? payload.content : content;
  const updated = matter.stringify(nextContent, nextData);
  writeFileSync(fullPath, updated);

  return adminJson({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;

  const limited = await getAdminRateLimitResponse('write', request);
  if (limited) return limited;

  if (!canAdminWriteLocally()) {
    return adminJson(
      { error: 'File write is disabled in production. Use PR-based publish.' },
      { status: 403 }
    );
  }

  const locale = request.nextUrl.searchParams.get('locale') || 'ko';
  if (!LOCALES.has(locale)) {
    return adminJson({ error: 'Invalid locale' }, { status: 400 });
  }

  const fullPath = resolvePostPath(locale, params.slug);
  if (!fullPath) {
    return adminJson({ error: 'Post not found' }, { status: 404 });
  }

  unlinkSync(fullPath);
  return adminJson({ ok: true });
}
