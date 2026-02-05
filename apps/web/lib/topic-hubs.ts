import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Locale } from '@/i18n';
import { normalizeTopicId } from '@/lib/topics';

export interface TopicHubContent {
  title?: string;
  description?: string;
  content: string;
}

const HUBS_DIR = path.join(process.cwd(), 'content', 'topics', 'hubs');

export function getTopicHubContent(locale: Locale, topicId: string): TopicHubContent | null {
  const normalized = normalizeTopicId(topicId);
  if (!normalized) return null;

  const filePath = path.join(HUBS_DIR, locale, `${normalized}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const data = (parsed.data || {}) as Record<string, unknown>;
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    const description = typeof data.description === 'string' ? data.description.trim() : '';
    const content = String(parsed.content || '').trim();
    if (!title && !description && !content) return null;
    return {
      title: title || undefined,
      description: description || undefined,
      content,
    };
  } catch {
    return null;
  }
}

