import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

const POSTS_DIR = './apps/web/content/posts/ko';

interface PostMeta {
  slug: string;
  title: string;
  tags: string[];
  date: string;
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((tag) => String(tag || '').trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    const one = raw.trim();
    return one ? [one] : [];
  }
  return [];
}

export function getAllPosts(): PostMeta[] {
  // 디렉토리 존재 여부 먼저 확인
  if (!existsSync(POSTS_DIR)) {
    return [];
  }

  const files = readdirSync(POSTS_DIR).filter(f => f.endsWith('.mdx'));
  return files.map(file => {
    const content = readFileSync(join(POSTS_DIR, file), 'utf-8');
    const { data } = matter(content);
    return {
      slug: file.replace('.mdx', ''),
      title: data.title || '',
      tags: normalizeTags(data.tags),
      date: data.date || '',
    };
  });
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Simple word overlap similarity
  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  return overlap / Math.max(words1.size, words2.size);
}

function calculateTagOverlap(tags1: string[] | string | undefined, tags2: string[] | string | undefined): number {
  const normalizedTags1 = normalizeTags(tags1);
  const normalizedTags2 = normalizeTags(tags2);
  if (normalizedTags1.length === 0 || normalizedTags2.length === 0) return 0;

  const set1 = new Set(normalizedTags1.map(t => t.toLowerCase()));
  const set2 = new Set(normalizedTags2.map(t => t.toLowerCase()));

  let overlap = 0;
  for (const tag of set1) {
    if (set2.has(tag)) overlap++;
  }

  return overlap / Math.max(set1.size, set2.size);
}

export interface SimilarPost {
  slug: string;
  title: string;
  similarity: number;
  tagOverlap: number;
  recommendation: 'merge' | 'new' | 'update';
}

export function findSimilarPosts(newTitle: string, newTags: string[], threshold = 0.4): SimilarPost[] {
  const posts = getAllPosts();
  const results: SimilarPost[] = [];

  for (const post of posts) {
    const titleSim = calculateSimilarity(newTitle, post.title);
    const tagOverlap = calculateTagOverlap(newTags, post.tags);
    const combined = (titleSim * 0.6) + (tagOverlap * 0.4);

    if (combined >= threshold) {
      let recommendation: 'merge' | 'new' | 'update' = 'new';
      if (combined >= 0.7) recommendation = 'merge';
      else if (combined >= 0.5) recommendation = 'update';

      results.push({
        slug: post.slug,
        title: post.title,
        similarity: combined,
        tagOverlap,
        recommendation,
      });
    }
  }

  return results.sort((a, b) => b.similarity - a.similarity);
}

export function checkDuplicate(newTitle: string, newTags: string[]): SimilarPost | null {
  const similar = findSimilarPosts(newTitle, newTags, 0.7);
  return similar.length > 0 ? similar[0] : null;
}
