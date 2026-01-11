import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Locale } from '@/i18n';

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string;
  locale: Locale;
  verificationScore?: number;
  sourceUrl?: string;
  sourceId?: string;
  alternateLocale?: string;
  coverImage?: string;
}

export type SearchPost = Pick<Post, 'slug' | 'title' | 'description' | 'tags'>;

/**
 * Parse various date formats to ISO string
 * Supports: 'YYYY.MM.DD HH:mm:ss', 'YYYY-MM-DD', ISO 8601, etc.
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Handle 'YYYY.MM.DD HH:mm:ss' format
  const dotFormat = dateStr.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (dotFormat) {
    const [, year, month, day, hour, min, sec] = dotFormat;
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`).toISOString();
  }

  // Handle 'YYYY.MM.DD' format without time
  const dotDateOnly = dateStr.match(/^(\d{4})\.(\d{2})\.(\d{2})$/);
  if (dotDateOnly) {
    const [, year, month, day] = dotDateOnly;
    return new Date(`${year}-${month}-${day}`).toISOString();
  }

  // Try standard Date parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Fallback
  return new Date().toISOString();
}

const TAG_ALIASES: Record<string, string> = {
  'chat gpt': 'chatgpt',
  'chat-gpt': 'chatgpt',
  '챗gpt': 'chatgpt',
  '챗지피티': 'chatgpt',
  '젬나이': 'gemini',
  '제미나이': 'gemini',
};

function normalizeTagValue(value: string): string {
  const normalized = value.trim().toLowerCase();
  return TAG_ALIASES[normalized] || normalized;
}

function normalizeTags(rawTags: unknown): string[] {
  if (!rawTags) return [];
  const tags = Array.isArray(rawTags) ? rawTags : [rawTags];
  const normalizedTags: string[] = [];
  const seen = new Set<string>();

  for (const tag of tags) {
    let value = '';
    if (typeof tag === 'string') value = tag;
    if (typeof tag === 'number') value = String(tag);
    if (!value) continue;

    const normalized = normalizeTagValue(value);
    if (!normalized || seen.has(normalized)) continue;

    seen.add(normalized);
    normalizedTags.push(normalized);
  }

  return normalizedTags;
}

const postsDirectory = path.join(process.cwd(), 'content/posts');
let cachedPostPaths: Set<string> | null = null;
const publicDirectory = path.join(process.cwd(), 'public');
const ENABLE_COVER_IMAGES = process.env.ENABLE_COVER_IMAGES !== 'false';

function getExistingPostPaths(): Set<string> {
  if (process.env.NODE_ENV === 'production' && cachedPostPaths) {
    return cachedPostPaths;
  }

  const paths = new Set<string>();

  if (!fs.existsSync(postsDirectory)) {
    return paths;
  }

  const locales = fs.readdirSync(postsDirectory);
  for (const locale of locales) {
    const localeDir = path.join(postsDirectory, locale);
    if (!fs.statSync(localeDir).isDirectory()) continue;

    const fileNames = fs.readdirSync(localeDir);
    for (const fileName of fileNames) {
      if (!fileName.endsWith('.mdx') && !fileName.endsWith('.md')) continue;
      const slug = fileName.replace(/\.mdx?$/, '');
      paths.add(`/${locale}/posts/${slug}`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    cachedPostPaths = paths;
  }

  return paths;
}

function normalizeAlternateLocale(
  rawLocale: unknown,
  existingPaths?: Set<string>
): string | undefined {
  if (!rawLocale || typeof rawLocale !== 'string') return undefined;
  const value = rawLocale.trim();
  if (!value) return undefined;
  const normalized = value.startsWith('/') ? value : `/${value}`;
  const existing = existingPaths || getExistingPostPaths();
  return existing.has(normalized) ? normalized : undefined;
}

function normalizeCoverImage(rawCoverImage: unknown): string | undefined {
  if (!ENABLE_COVER_IMAGES) return undefined;
  if (!rawCoverImage || typeof rawCoverImage !== 'string') return undefined;
  const value = rawCoverImage.trim();
  if (!value) return undefined;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  const relativePath = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const fullPath = path.join(publicDirectory, relativePath);

  return fs.existsSync(fullPath) ? normalized : undefined;
}

function parsePostFile(
  fullPath: string,
  slug: string,
  locale: Locale,
  existingPaths?: Set<string>
): Post {
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);

  return {
    slug,
    title: data.title || slug,
    description: data.description || data.excerpt || content.slice(0, 160),
    date: parseDate(data.date),
    tags: normalizeTags(data.tags),
    content,
    locale,
    verificationScore: data.verificationScore,
    sourceUrl: data.sourceUrl,
    sourceId: data.sourceId,
    alternateLocale: normalizeAlternateLocale(data.alternateLocale, existingPaths),
    coverImage: normalizeCoverImage(data.coverImage),
  } as Post;
}

export function getPosts(locale: Locale): Post[] {
  const localeDir = path.join(postsDirectory, locale);

  // Return empty array if directory doesn't exist
  if (!fs.existsSync(localeDir)) {
    return [];
  }

  const fileNames = fs.readdirSync(localeDir);
  const existingPaths = getExistingPostPaths();
  const posts = fileNames
    .filter((fileName) => fileName.endsWith('.mdx') || fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx?$/, '');
      const fullPath = path.join(localeDir, fileName);
      return parsePostFile(fullPath, slug, locale, existingPaths);
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

export function getPostBySlug(slug: string, locale: Locale): Post | null {
  const localeDir = path.join(postsDirectory, locale);
  if (!fs.existsSync(localeDir)) {
    return null;
  }

  const extensions = ['.mdx', '.md'];
  for (const ext of extensions) {
    const fullPath = path.join(localeDir, `${slug}${ext}`);
    if (fs.existsSync(fullPath)) {
      const existingPaths = getExistingPostPaths();
      return parsePostFile(fullPath, slug, locale, existingPaths);
    }
  }

  return null;
}

export function getAllSlugs(): { locale: Locale; slug: string }[] {
  const locales: Locale[] = ['en', 'ko'];
  const slugs: { locale: Locale; slug: string }[] = [];

  for (const locale of locales) {
    const posts = getPosts(locale);
    for (const post of posts) {
      slugs.push({ locale, slug: post.slug });
    }
  }

  return slugs;
}
