import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { adminJson, canAdminWriteLocally, isAdminPublishEnabled, requireAdminSession } from '@/lib/admin';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');
const LOCALES = new Set(['en', 'ko']);

function normalizeTags(rawTags: unknown): string[] {
  if (!rawTags) return [];
  if (Array.isArray(rawTags)) return rawTags.map(String);
  return [String(rawTags)];
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession(request);
  if (auth) return auth;

  const locale = request.nextUrl.searchParams.get('locale') || 'ko';
  if (!LOCALES.has(locale)) {
    return adminJson({ error: 'Invalid locale' }, { status: 400 });
  }

  const localeDir = path.join(POSTS_DIR, locale);
  if (!existsSync(localeDir)) {
    return adminJson({
      posts: [],
      capabilities: {
        canLocalWrite: canAdminWriteLocally(),
        canPublish: isAdminPublishEnabled(),
      },
    });
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

  return adminJson({
    posts,
    capabilities: {
      canLocalWrite: canAdminWriteLocally(),
      canPublish: isAdminPublishEnabled(),
    },
  });
}
