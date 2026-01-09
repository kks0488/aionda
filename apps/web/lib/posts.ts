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
  alternateLocale?: string;
  coverImage?: string;
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
        date: data.date || new Date().toISOString(),
        tags: data.tags || [],
        content,
        locale,
        verificationScore: data.verificationScore,
        sourceUrl: data.sourceUrl,
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
