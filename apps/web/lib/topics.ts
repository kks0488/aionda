import topicsEn from '@/content/topics/en.json';
import topicsKo from '@/content/topics/ko.json';
import type { Locale } from '@/i18n';
import type { Post } from '@/lib/posts';

export interface TopicConfig {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

const TOPICS_BY_LOCALE: Record<Locale, TopicConfig[]> = {
  en: topicsEn as TopicConfig[],
  ko: topicsKo as TopicConfig[],
};

export function normalizeTopicId(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getTopics(locale: Locale): TopicConfig[] {
  return TOPICS_BY_LOCALE[locale] || TOPICS_BY_LOCALE.ko;
}

export function getTopicConfig(locale: Locale, topicId: string): TopicConfig | null {
  const normalized = normalizeTopicId(topicId);
  const topics = getTopics(locale);
  return topics.find((t) => normalizeTopicId(t.id) === normalized) || null;
}

export function postMatchesTopic(post: Pick<Post, 'tags' | 'topic'>, topic: TopicConfig): boolean {
  const tagSet = new Set((post.tags || []).map((t) => String(t || '').trim().toLowerCase()));
  const normalizedTopicId = normalizeTopicId(topic.id);

  const postTopic = post.topic ? normalizeTopicId(post.topic) : '';
  if (postTopic && postTopic === normalizedTopicId) return true;

  if (tagSet.has(normalizedTopicId)) return true;
  for (const tag of topic.tags || []) {
    const normalizedTag = String(tag || '').trim().toLowerCase();
    if (!normalizedTag) continue;
    if (tagSet.has(normalizedTag)) return true;
  }
  return false;
}

export function buildTopicStats(
  topics: TopicConfig[],
  posts: Array<Pick<Post, 'date' | 'tags' | 'topic'>>
) {
  return topics
    .map((topic) => {
      const matched = posts.filter((post) => postMatchesTopic(post, topic));
      const lastUsedAtMs = matched.reduce((max, post) => {
        const t = new Date(post.date).getTime();
        return Number.isNaN(t) ? max : Math.max(max, t);
      }, 0);
      return {
        topic,
        count: matched.length,
        lastUsedAt: lastUsedAtMs ? new Date(lastUsedAtMs).toISOString() : '',
      };
    })
    .filter((stat) => stat.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const timeA = new Date(a.lastUsedAt).getTime();
      const timeB = new Date(b.lastUsedAt).getTime();
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB) && timeB !== timeA) return timeB - timeA;
      return a.topic.id.localeCompare(b.topic.id);
    });
}
