import { getPosts } from '@/lib/posts';
import type { Locale } from '@/i18n';

export type TagStat = {
  tag: string;
  count: number;
  lastUsedAt: string;
};

export function getTagStats(locale: Locale): TagStat[] {
  const posts = getPosts(locale);
  const stats = new Map<string, { count: number; lastUsedAtMs: number }>();

  for (const post of posts) {
    const postTime = new Date(post.date).getTime();
    const safeTime = Number.isNaN(postTime) ? 0 : postTime;

    for (const rawTag of post.tags) {
      const tag = String(rawTag || '').trim().toLowerCase();
      if (!tag) continue;

      const prev = stats.get(tag);
      if (!prev) {
        stats.set(tag, { count: 1, lastUsedAtMs: safeTime });
        continue;
      }

      prev.count += 1;
      if (safeTime > prev.lastUsedAtMs) prev.lastUsedAtMs = safeTime;
      stats.set(tag, prev);
    }
  }

  return Array.from(stats.entries())
    .map(([tag, value]) => ({
      tag,
      count: value.count,
      lastUsedAt: new Date(value.lastUsedAtMs || Date.now()).toISOString(),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const timeA = new Date(a.lastUsedAt).getTime();
      const timeB = new Date(b.lastUsedAt).getTime();
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeB !== timeA) return timeB - timeA;
      return a.tag.localeCompare(b.tag);
    });
}

export function getAllTags(locale: Locale): string[] {
  return getTagStats(locale).map((x) => x.tag);
}
