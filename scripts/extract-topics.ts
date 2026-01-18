/**
 * Unified Topic Extraction Pipeline
 *
 * Extracts discussable topics from multiple sources:
 * - DC Inside gallery posts (data/raw/)
 * - Official AI company blogs (data/official/)
 * - Tech news RSS feeds (data/news/)
 *
 * Priority: Official (Tier S) > News (Tier A) > Community (Tier C)
 *
 * Usage:
 *   pnpm extract-topics              # All sources
 *   pnpm extract-topics --source=raw      # DC Inside only
 *   pnpm extract-topics --source=official # Official blogs only
 *   pnpm extract-topics --source=news     # News only
 *   pnpm extract-topics --limit=1         # Process only 1 topic
 *   pnpm extract-topics --since=today     # Only items published since local midnight
 *   pnpm extract-topics --since=24h       # Only items from last 24 hours
 *
 * Default behavior:
 *   - If --since is omitted, uses TOPICS_SINCE env var (default: 14d)
 *   - Use --since=all to disable time filtering
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { generateContent } from './lib/gemini';
import { EXTRACT_TOPIC_PROMPT, EXTRACT_TOPIC_FROM_NEWS_PROMPT } from './prompts/topics';

config({ path: '.env.local' });

// Data directories
const RAW_DIR = './data/raw';
const OFFICIAL_DIR = './data/official';
const NEWS_DIR = './data/news';
const TOPICS_DIR = './data/topics';
const PUBLISHED_DIR = './data/published';

// Configuration
const MIN_CONTENT_LENGTH = parseInt(process.env.MIN_CONTENT_LENGTH || '100', 10);
const MAX_TOPICS = parseInt(process.env.MAX_TOPICS || '5');
const DEFAULT_SINCE = (process.env.TOPICS_SINCE || '14d').trim();

function parseUnifiedPostDate(value: string): Date | null {
  if (!value) return null;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  // DC Inside format: "YYYY.MM.DD HH:MM:SS"
  const match = value.match(/^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;

  const [, y, m, d, hh, mm, ss] = match;
  const parsed = new Date(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss)
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getStartOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function parseSinceArg(raw?: string): Date | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  if (value === 'all') return null;
  if (value === 'today') return getStartOfTodayLocal();

  const relative = value.match(/^(\d+)\s*(h|d)$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms);
  }

  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Source types
type SourceType = 'raw' | 'official' | 'news';
type SourceTier = 'S' | 'A' | 'B' | 'C';

interface UnifiedPost {
  id: string;
  sourceType: SourceType;
  sourceTier: SourceTier;
  sourceName: string;
  title: string;
  content: string;
  url: string;
  date: string;
  // DC Inside specific
  views?: number;
  likes?: number;
}

interface ExtractedTopic {
  id: string;
  sourceId: string;
  sourceUrl: string;
  sourceDate: string;
  sourceType: SourceType;
  sourceTier: SourceTier;
  sourceName: string;
  title: string;
  description: string;
  keyInsights: string[];
  researchQuestions: string[];
  extractedAt: string;
}

/**
 * Load DC Inside gallery posts
 */
function loadRawPosts(): UnifiedPost[] {
  if (!existsSync(RAW_DIR)) return [];

  return readdirSync(RAW_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._'))
    .map(f => {
      try {
        const data = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf-8'));
        return {
          id: data.id,
          sourceType: 'raw' as SourceType,
          sourceTier: 'C' as SourceTier,
          sourceName: 'DC Inside 특이점갤러리',
          title: data.title || '',
          content: data.contentText || '',
          url: data.url || `https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=${data.id}`,
          date: data.date || '',
          views: data.views || 0,
          likes: data.likes || 0,
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is UnifiedPost => p !== null && p.content.length >= MIN_CONTENT_LENGTH);
}

/**
 * Load official blog posts from RSS
 */
function loadOfficialPosts(): UnifiedPost[] {
  if (!existsSync(OFFICIAL_DIR)) return [];

  return readdirSync(OFFICIAL_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._') && !f.includes('-meta'))
    .map(f => {
      try {
        const data = JSON.parse(readFileSync(join(OFFICIAL_DIR, f), 'utf-8'));
        return {
          id: data.id,
          sourceType: 'official' as SourceType,
          sourceTier: (data.sourceTier || 'S') as SourceTier,
          sourceName: data.sourceName || 'Official Blog',
          title: data.title || '',
          content: data.contentSnippet || data.content || '',
          url: data.link || '',
          date: data.pubDate || '',
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is UnifiedPost => p !== null && p.title.length > 5);
}

/**
 * Load news posts from RSS
 */
function loadNewsPosts(): UnifiedPost[] {
  if (!existsSync(NEWS_DIR)) return [];

  return readdirSync(NEWS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._'))
    .map(f => {
      try {
        const data = JSON.parse(readFileSync(join(NEWS_DIR, f), 'utf-8'));
        return {
          id: data.id,
          sourceType: 'news' as SourceType,
          sourceTier: (data.sourceTier || 'A') as SourceTier,
          sourceName: data.sourceName || 'Tech News',
          title: data.title || '',
          content: data.contentSnippet || data.content || '',
          url: data.link || '',
          date: data.pubDate || '',
        };
      } catch {
        return null;
      }
    })
    .filter((p): p is UnifiedPost => p !== null && p.title.length > 5);
}

/**
 * Get already processed source IDs
 */
function getProcessedIds(): Set<string> {
  const processed = new Set<string>();

  // From topics
  if (existsSync(TOPICS_DIR)) {
    for (const file of readdirSync(TOPICS_DIR).filter(f => f.endsWith('.json') && !f.startsWith('._'))) {
      try {
        const topic = JSON.parse(readFileSync(join(TOPICS_DIR, file), 'utf-8'));
        processed.add(topic.sourceId);
      } catch {}
    }
  }

  // From published
  if (existsSync(PUBLISHED_DIR)) {
    for (const file of readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json') && !f.startsWith('._'))) {
      try {
        const pub = JSON.parse(readFileSync(join(PUBLISHED_DIR, file), 'utf-8'));
        processed.add(pub.sourceId);
      } catch {}
    }
  }

  return processed;
}

/**
 * Extract topic from a post using Gemini
 */
async function extractTopicFromPost(post: UnifiedPost): Promise<ExtractedTopic | null> {
  // Use different prompt for news/official vs community posts
  const isNewsOrOfficial = post.sourceType !== 'raw';
  const promptTemplate = isNewsOrOfficial ? EXTRACT_TOPIC_FROM_NEWS_PROMPT : EXTRACT_TOPIC_PROMPT;

  const contentToAnalyze = isNewsOrOfficial
    ? `제목: ${post.title}\n\n내용: ${post.content.substring(0, 2000)}`
    : post.content.substring(0, 4000);

  const prompt = promptTemplate.replace('{content}', contentToAnalyze);

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.log('    ⚠️ Failed to parse response');
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.worthDiscussing) {
      console.log(`    ❌ Not worth discussing: ${result.reason}`);
      return null;
    }

    const topic = result.topic;
    if (!topic || !topic.title || !topic.researchQuestions?.length) {
      console.log('    ⚠️ Invalid topic structure');
      return null;
    }

    return {
      id: `topic-${Date.now()}-${post.id}`,
      sourceId: post.id,
      sourceUrl: post.url,
      sourceDate: post.date,
      sourceType: post.sourceType,
      sourceTier: post.sourceTier,
      sourceName: post.sourceName,
      title: topic.title,
      description: topic.description || '',
      keyInsights: topic.keyInsights || [],
      researchQuestions: topic.researchQuestions,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('    ❌ Error extracting topic:', error);
    return null;
  }
}

/**
 * Sort posts by priority: Official > News > Raw, then by date
 */
function sortByPriority(posts: UnifiedPost[]): UnifiedPost[] {
  const tierOrder: Record<SourceTier, number> = { S: 0, A: 1, B: 2, C: 3 };

  return posts.sort((a, b) => {
    // First by tier
    const tierDiff = tierOrder[a.sourceTier] - tierOrder[b.sourceTier];
    if (tierDiff !== 0) return tierDiff;

    // Then by date (newest first)
    const dateA = parseUnifiedPostDate(a.date || '') || new Date('2000-01-01');
    const dateB = parseUnifiedPostDate(b.date || '') || new Date('2000-01-01');
    return dateB.getTime() - dateA.getTime();
  });
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Unified Topic Extraction Pipeline');
  console.log('  Sources: Official Blogs + News + DC Inside');
  console.log('═'.repeat(60) + '\n');

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const sourceArg = args.find(a => a.startsWith('--source='));
  const sourceFilter = sourceArg ? sourceArg.split('=')[1] as SourceType : undefined;
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limitOverride = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const maxTopics = Number.isFinite(limitOverride) && (limitOverride as number) > 0
    ? (limitOverride as number)
    : MAX_TOPICS;

  const sinceArg = args.find(a => a.startsWith('--since='));
  const since = parseSinceArg(sinceArg ? sinceArg.split('=')[1] : DEFAULT_SINCE);

  // Ensure directories exist
  if (!existsSync(TOPICS_DIR)) mkdirSync(TOPICS_DIR, { recursive: true });
  if (!existsSync(PUBLISHED_DIR)) mkdirSync(PUBLISHED_DIR, { recursive: true });

  // Get already processed IDs
  const processedIds = getProcessedIds();
  console.log(`📁 Already processed: ${processedIds.size} posts\n`);

  // Load posts from all sources
  let allPosts: UnifiedPost[] = [];

  if (!sourceFilter || sourceFilter === 'official') {
    const officialPosts = loadOfficialPosts();
    console.log(`📰 Official blogs: ${officialPosts.length} posts`);
    allPosts.push(...officialPosts);
  }

  if (!sourceFilter || sourceFilter === 'news') {
    const newsPosts = loadNewsPosts();
    console.log(`📰 News feeds: ${newsPosts.length} posts`);
    allPosts.push(...newsPosts);
  }

  if (!sourceFilter || sourceFilter === 'raw') {
    const rawPosts = loadRawPosts();
    console.log(`📰 DC Inside: ${rawPosts.length} posts`);
    allPosts.push(...rawPosts);
  }

  // Filter out already processed
  const unprocessedPosts = allPosts.filter(p => !processedIds.has(p.id));
  console.log(`\n📋 Unprocessed: ${unprocessedPosts.length} posts`);

  const filteredPosts = since
    ? unprocessedPosts.filter((p) => {
        const parsed = parseUnifiedPostDate(p.date || '');
        return parsed ? parsed.getTime() >= since.getTime() : false;
      })
    : unprocessedPosts;

  if (since) {
    console.log(`⏱️  Since: ${since.toISOString()} | Remaining: ${filteredPosts.length} posts`);
  } else {
    console.log(`⏱️  Since: (all time) | Remaining: ${filteredPosts.length} posts`);
  }

  if (filteredPosts.length === 0) {
    console.log('\n✅ No new posts to process.');
    process.exit(0);
  }

  // Sort by priority and limit
  const sortedPosts = sortByPriority(filteredPosts);
  console.log(`🎯 Processing up to ${maxTopics} topics (Priority: S > A > B > C)\n`);

  let extracted = 0;
  const tierEmoji: Record<SourceTier, string> = { S: '🏛️', A: '🛡️', B: '📝', C: '💬' };

  for (const post of sortedPosts) {
    if (extracted >= maxTopics) break;

    const emoji = tierEmoji[post.sourceTier];
    console.log(`${emoji} [${post.sourceTier}] ${post.sourceName}`);
    console.log(`   📋 "${post.title.substring(0, 50)}..."`);

    const topic = await extractTopicFromPost(post);

    if (topic) {
      const topicFile = `${topic.id}.json`;
      writeFileSync(join(TOPICS_DIR, topicFile), JSON.stringify(topic, null, 2));

      console.log(`   ✅ Topic: "${topic.title}"`);
      console.log(`   📝 Research questions: ${topic.researchQuestions.length}`);
      extracted++;
    }

    console.log('');

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('═'.repeat(60));
  console.log(`✨ Done! Extracted ${extracted} topic(s)`);
  console.log('Next step: Run `pnpm research-topic` to research the topics.');
  console.log('═'.repeat(60));
}

main().catch(console.error);
