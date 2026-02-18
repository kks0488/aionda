import topicsEn from '@/content/topics/en.json';
import topicsKo from '@/content/topics/ko.json';
import type { Locale } from '@/i18n';
import type { Post } from '@/lib/posts';
import { normalizeTopicId as normalizeTopicIdFromUtils } from '@singularity-blog/content-utils';

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

type TopicStatAggregate = {
  count: number;
  lastMs: number;
};

type TopicStatResult = {
  topic: TopicConfig;
  count: number;
  lastUsedAt: string;
};

type CachedTopicStats = {
  topicsRef: TopicConfig[];
  postsRef: Array<Pick<Post, 'date' | 'tags' | 'topic'>>;
  stats: TopicStatResult[];
};

const topicStatsCacheByLocale = new Map<Locale, CachedTopicStats>();

export const normalizeTopicId = normalizeTopicIdFromUtils;

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

function resolveLocaleFromTopics(topics: TopicConfig[]): Locale | null {
  const localeKeys = Object.keys(TOPICS_BY_LOCALE) as Locale[];
  for (const locale of localeKeys) {
    if (TOPICS_BY_LOCALE[locale] === topics) return locale;
  }
  return null;
}

function addTopicIndex(index: Map<string, Set<string>>, key: string, topicId: string) {
  if (!key) return;
  const existing = index.get(key);
  if (existing) {
    existing.add(topicId);
    return;
  }
  index.set(key, new Set([topicId]));
}

export function buildTopicStats(
  topics: TopicConfig[],
  posts: Array<Pick<Post, 'date' | 'tags' | 'topic'>>
) {
  const locale = resolveLocaleFromTopics(topics);
  if (locale) {
    const cached = topicStatsCacheByLocale.get(locale);
    if (cached && cached.topicsRef === topics && cached.postsRef === posts) {
      return cached.stats;
    }
  }

  const topicTagIndex = new Map<string, Set<string>>();
  const topicIds = new Set<string>();

  for (const topic of topics) {
    const normalizedTopicId = normalizeTopicId(topic.id);
    if (!normalizedTopicId) continue;

    topicIds.add(normalizedTopicId);
    addTopicIndex(topicTagIndex, normalizedTopicId, normalizedTopicId);

    for (const tag of topic.tags || []) {
      const normalizedTag = String(tag || '').trim().toLowerCase();
      addTopicIndex(topicTagIndex, normalizedTag, normalizedTopicId);
    }
  }

  const aggregates = new Map<string, TopicStatAggregate>();

  for (const post of posts) {
    const matchedTopicIds = new Set<string>();

    const postTopic = post.topic ? normalizeTopicId(post.topic) : '';
    if (postTopic && topicIds.has(postTopic)) {
      matchedTopicIds.add(postTopic);
    }

    for (const tag of post.tags || []) {
      const normalizedTag = String(tag || '').trim().toLowerCase();
      if (!normalizedTag) continue;

      const matchedTopics = topicTagIndex.get(normalizedTag);
      if (!matchedTopics) continue;
      matchedTopics.forEach((topicId) => {
        matchedTopicIds.add(topicId);
      });
    }

    if (matchedTopicIds.size === 0) continue;

    const postTime = new Date(post.date).getTime();
    const postMs = Number.isNaN(postTime) ? 0 : postTime;

    matchedTopicIds.forEach((topicId) => {
      const existing = aggregates.get(topicId);
      if (existing) {
        existing.count += 1;
        if (postMs > existing.lastMs) existing.lastMs = postMs;
      } else {
        aggregates.set(topicId, { count: 1, lastMs: postMs });
      }
    });
  }

  const stats = topics
    .map((topic) => {
      const normalizedTopicId = normalizeTopicId(topic.id);
      const aggregate = normalizedTopicId ? aggregates.get(normalizedTopicId) : undefined;
      const count = aggregate?.count || 0;
      const lastUsedAtMs = aggregate?.lastMs || 0;
      return {
        topic,
        count,
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

  if (locale) {
    topicStatsCacheByLocale.set(locale, { topicsRef: topics, postsRef: posts, stats });
  }

  return stats;
}
