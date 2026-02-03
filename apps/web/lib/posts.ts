import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { locales, type Locale } from '@/i18n';

export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string;
  locale: Locale;
  verificationScore?: number;
  readingTime?: number;
  author?: string;
  byline?: string;
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
  'hugging face': 'huggingface',
  'huggingface': 'huggingface',
  '젬나이': 'gemini',
  '제미나이': 'gemini',
  '인공지능': 'ai',
  'ai': 'ai',
  '엔비디아': 'nvidia',
  '오픈ai': 'openai',
  '오픈에이아이': 'openai',
  '앤스로픽': 'anthropic',
  '클로드': 'claude',
};

function normalizeTagValue(value: string): string {
  const compact = value.trim().toLowerCase().replace(/\s+/g, ' ');
  const aliased = TAG_ALIASES[compact] || compact;

  // Collapse model/version tags into family tags (avoid long-tail tag explosion)
  if (/^gpt(?:[-\s]?\d|[-\s]?(?:4o|o1)\b)/.test(aliased)) return 'gpt';
  if (/^gemini(?:[-\s]?\d|\b)/.test(aliased)) return 'gemini';
  if (/^claude(?:[-\s]?\d|\b)/.test(aliased)) return 'claude';
  if (/^llama(?:[-\s]?\d|\b)/.test(aliased)) return 'llama';
  if (/^qwen(?:[-\s]?\d|\b)/.test(aliased)) return 'qwen';
  if (/^kimi(?:[-\s]?\d|\b)/.test(aliased)) return 'kimi';

  return aliased;
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

const CORE_TAG_PATTERNS: Array<{ tag: string; regex: RegExp }> = [
  { tag: 'agi', regex: /agi|artificial general intelligence|superintelligence|초지능|범용.*인공지능/i },
  { tag: 'robotics', regex: /robot|로봇|humanoid|휴머노이드|boston dynamics|figure|drone|드론|자율주행/i },
  { tag: 'hardware', regex: /hardware|하드웨어|gpu|tpu|nvidia|chip|반도체|칩|blackwell|h100|b200|rubin|cuda|hbm/i },
  { tag: 'llm', regex: /llm|language model|언어.*모델|대형언어|transformer|트랜스포머|gpt|chatgpt|claude|gemini|llama/i },
];

function deriveCoreTags(title: string, content: string, tags: string[]): string[] {
  const combined = `${title}\n${tags.join(' ')}\n${content}`.toLowerCase();
  const derived = CORE_TAG_PATTERNS.filter(({ regex }) => regex.test(combined)).map(({ tag }) => tag);
  return derived.length > 0 ? derived : ['llm'];
}

function mergeTags(base: string[], extra: string[]): string[] {
  if (extra.length === 0) return base;
  const seen = new Set(base);
  const merged = [...base];

  for (const tag of extra) {
    const normalized = normalizeTagValue(tag);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    merged.push(normalized);
  }

  return merged;
}

function deriveSourceId(rawSourceId: unknown, tags: string[]): string | undefined {
  const sourceId = typeof rawSourceId === 'string' ? rawSourceId.trim() : '';
  if (sourceId) return sourceId;
  if (tags.some((t) => t === 'roundup')) return 'roundup';
  return undefined;
}

const postsDirectory = path.join(process.cwd(), 'content/posts');
let cachedPostPaths: Set<string> | null = null;
const publicDirectory = path.join(process.cwd(), 'public');
const ENABLE_COVER_IMAGES = process.env.ENABLE_COVER_IMAGES !== 'false';
const COVER_IMAGE_EXTENSIONS = ['jpeg', 'jpg', 'png', 'webp', 'avif'];

function findCoverImageBySlug(slug: string): string | undefined {
  if (!slug) return undefined;

  for (const ext of COVER_IMAGE_EXTENSIONS) {
    const relativePath = path.join('images', 'posts', `${slug}.${ext}`);
    const fullPath = path.join(publicDirectory, relativePath);
    if (fs.existsSync(fullPath)) {
      return `/${relativePath.replace(/\\/g, '/')}`;
    }
  }

  return undefined;
}

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

function normalizeCoverImage(rawCoverImage: unknown, slug?: string): string | undefined {
  if (!ENABLE_COVER_IMAGES) return undefined;
  if (!rawCoverImage || typeof rawCoverImage !== 'string') {
    return slug ? findCoverImageBySlug(slug) : undefined;
  }
  const value = rawCoverImage.trim();
  if (!value) return slug ? findCoverImageBySlug(slug) : undefined;

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  const relativePath = normalized.startsWith('/') ? normalized.slice(1) : normalized;
  const fullPath = path.join(publicDirectory, relativePath);

  if (fs.existsSync(fullPath)) {
    return normalized;
  }

  return slug ? findCoverImageBySlug(slug) : undefined;
}

function parsePostFile(
  fullPath: string,
  slug: string,
  locale: Locale,
  existingPaths?: Set<string>
): Post {
  const fileContents = fs.readFileSync(fullPath, 'utf8');
  const { data, content } = matter(fileContents);
  const normalizedTags = normalizeTags(data.tags);
  const coreTags = deriveCoreTags(String(data.title || slug), content, normalizedTags);
  const tags = mergeTags(normalizedTags, coreTags);
  const author = typeof data.author === 'string' ? data.author.trim() : '';
  const byline = typeof data.byline === 'string' ? data.byline.trim() : '';

  const estimateReadingTime = (raw: string): number => {
    const stripped = String(raw || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!stripped) return 1;

    if (locale === 'ko') {
      const chars = stripped.replace(/\s/g, '').length;
      return Math.max(1, Math.round(chars / 800));
    }

    const words = stripped.split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  };

  return {
    slug,
    title: data.title || slug,
    description: data.description || data.excerpt || content.slice(0, 160),
    date: parseDate(data.date),
    tags,
    content,
    locale,
    verificationScore: data.verificationScore,
    readingTime: estimateReadingTime(content),
    author: author || undefined,
    byline: byline || undefined,
    sourceUrl: data.sourceUrl,
    sourceId: deriveSourceId(data.sourceId, tags),
    alternateLocale: normalizeAlternateLocale(data.alternateLocale, existingPaths),
    coverImage: normalizeCoverImage(data.coverImage, slug),
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

export function getAvailableLocalesForSlug(slug: string): Locale[] {
  if (!slug) return [];

  const available: Locale[] = [];
  const extensions = ['.mdx', '.md'];

  for (const locale of locales) {
    const localeDir = path.join(postsDirectory, locale);
    if (!fs.existsSync(localeDir)) continue;

    for (const ext of extensions) {
      const fullPath = path.join(localeDir, `${slug}${ext}`);
      if (fs.existsSync(fullPath)) {
        available.push(locale as Locale);
        break;
      }
    }
  }

  return available;
}

export function getAllSlugs(): { locale: Locale; slug: string }[] {
  const slugs: { locale: Locale; slug: string }[] = [];

  for (const locale of locales) {
    const posts = getPosts(locale);
    for (const post of posts) {
      slugs.push({ locale, slug: post.slug });
    }
  }

  return slugs;
}
