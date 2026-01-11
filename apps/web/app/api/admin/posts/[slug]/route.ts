import { NextRequest } from 'next/server';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');
const LOCALES = new Set(['en', 'ko']);

function requireAdmin(request: NextRequest): Response | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return Response.json({ error: 'Admin API key not configured' }, { status: 500 });
  }

  const provided = request.headers.get('x-api-key');
  if (provided !== expected) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

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
  const auth = requireAdmin(request);
  if (auth) return auth;

  const locale = request.nextUrl.searchParams.get('locale') || 'ko';
  if (!LOCALES.has(locale)) {
    return Response.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const fullPath = resolvePostPath(locale, params.slug);
  if (!fullPath) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
  }

  const raw = readFileSync(fullPath, 'utf8');
  const { data, content } = matter(raw);

  return Response.json({
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
  const auth = requireAdmin(request);
  if (auth) return auth;

  const locale = request.nextUrl.searchParams.get('locale') || 'ko';
  if (!LOCALES.has(locale)) {
    return Response.json({ error: 'Invalid locale' }, { status: 400 });
  }

  const fullPath = resolvePostPath(locale, params.slug);
  if (!fullPath) {
    return Response.json({ error: 'Post not found' }, { status: 404 });
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

  return Response.json({ ok: true });
}
