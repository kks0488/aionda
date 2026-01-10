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

const postsDirectory = path.join(process.cwd(), 'content/posts');

export function getPosts(locale: Locale): Post[] {
  const localeDir = path.join(postsDirectory, locale);

  // Return empty array if directory doesn't exist
  if (!fs.existsSync(localeDir)) {
    return [];
  }

  const fileNames = fs.readdirSync(localeDir);
  const posts = fileNames
    .filter((fileName) => fileName.endsWith('.mdx') || fileName.endsWith('.md'))
    .map((fileName) => {
      const slug = fileName.replace(/\.mdx?$/, '');
      const fullPath = path.join(localeDir, fileName);
      const fileContents = fs.readFileSync(fullPath, 'utf8');
      const { data, content } = matter(fileContents);

      return {
        slug,
        title: data.title || slug,
        description: data.description || content.slice(0, 160),
        date: parseDate(data.date),
        tags: data.tags || [],
        content,
        locale,
        verificationScore: data.verificationScore,
        sourceUrl: data.sourceUrl,
        sourceId: data.sourceId,
        alternateLocale: data.alternateLocale,
        coverImage: data.coverImage,
      } as Post;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return posts;
}

export function getPostBySlug(slug: string, locale: Locale): Post | null {
  const posts = getPosts(locale);
  return posts.find((post) => post.slug === slug) || null;
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
