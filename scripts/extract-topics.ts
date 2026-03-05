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
import { generateContent } from './lib/ai-text';
import { extractJsonObject } from './lib/json-extract.js';
import { EXTRACT_TOPIC_PROMPT, EXTRACT_TOPIC_FROM_NEWS_PROMPT } from './prompts/topics';
import { checkSimilar, checkMemuHealth } from './lib/memu-client';

config({ path: '.env.local' });

// Data directories
const RAW_DIR = './data/raw';
const OFFICIAL_DIR = './data/official';
const NEWS_DIR = './data/news';
const TOPICS_DIR = './data/topics';
const PUBLISHED_DIR = './data/published';
const VC_DIR = './.vc';
const LAST_EXTRACTED_TOPICS_PATH = join(VC_DIR, 'last-extracted-topics.json');

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
const VALID_TIERS = new Set<SourceTier>(['S', 'A', 'B', 'C']);

function validateTier(value: unknown): SourceTier {
  const normalized = String(value || '').trim().toUpperCase();
  return VALID_TIERS.has(normalized as SourceTier) ? (normalized as SourceTier) : 'C';
}

function buildSourceKey(sourceType: string, sourceId: string): string {
  return `${sourceType || 'unknown'}:${sourceId}`;
}

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
  comments?: number;
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
  aiRelevanceScore?: number;
}

const AI_RELEVANCE_PATTERN =
  /(?:\bai\b|artificial intelligence|machine learning|\bml\b|deep learning|neural|llm|language model|foundation model|transformer|gpt|chatgpt|claude|gemini|llama|mistral|mixtral|diffusion|multimodal|agent|robot|robotics|humanoid|npu|neural engine|gpu|tpu|cuda|hbm|nvidia|openai|anthropic|deepmind|hugging\s*face|vertex\s*ai|copilot|pytorch|tensorflow|jax|inference|fine[-\s]?tune|finetune|quantization|rag|retrieval|\bbci\b|brain[-\s]?computer interface|neuralink|synchron|인공지능|머신러닝|딥러닝|신경망|언어\s*모델|대형\s*언어\s*모델|로봇|휴머노이드|온디바이스\s*ai|온디바이스|추론|파인\s*튜닝|파인튜닝|검색\s*증강|반도체|gpu|tpu|npu|bci|뇌[-\s]?컴퓨터|뉴럴링크|싱크론)/i;

function isLikelyAiRelated(post: UnifiedPost): boolean {
  const text = `${post.title}\n${post.content || ''}\n${post.url || ''}`.slice(0, 5000);
  return AI_RELEVANCE_PATTERN.test(text);
}

// Avoid "consumer/how-to/buying guide" drift from general tech feeds.
// We still allow high-signal technical/policy items even if they contain some consumer keywords.
const CONSUMER_DRIFT_PATTERNS: RegExp[] = [
  /\bhow to\b/i,
  /\bbest\b/i,
  /\breview\b/i,
  /\bexpert tested\b/i,
  /\bi (?:tested|tried)\b/i,
  /\bshortcuts?\b/i,
  /\bsettings?\b/i,
  /\bfix\b/i,
  /\bminutes?\b/i,
  /\bstep\b/i,
  /\bprice\b|\bdeal\b|\bdiscount\b|\bon sale\b|\bbundle\b|\bcoupon\b/i,
  /\biphone\b|\bipad\b|\bmac\b|\bapple watch\b|\broku\b|\bfire tv\b|\bsmartwatch\b|\bearbuds?\b|\bheadphones?\b|\bsoundbar\b|\brouter\b|\blaptop\b|\btablet\b|\bpower bank\b/i,
  /\bchrome\b|\bedge\b|\bfirefox\b|\bbrowser\b|\bwindows\b|\bmacos\b|\bios\b|\bandroid\b/i,
  /\btodoist\b|\bnotion\b|\bto[-\s]?do\b|\bto do list\b|\btask management\b|\bproductivity app\b|\breminders?\b|\bcalendar\b/i,
  /캐시|단축키|설정|정리|추천|리뷰|후기|비교|테스트|할인|쿠폰|번들|구매|가격|최고의|속도|느려|방법|하는\s*법/i,
  /투두이스트|todoist|노션|notion|할\s*일\s*목록|태스크\s*관리|미리\s*알림|리마인더|캘린더|생산성\s*앱/i,
];

const HIGH_SIGNAL_PATTERNS: RegExp[] = [
  /\bbenchmark\b|\bpaper\b|\bmodel\b|\brelease\b|\blaunch\b|\bannounce(?:ment)?\b|\barchitecture\b|\bweights?\b|\bdataset\b/i,
  /\bapi\b|\bsdk\b|\bspec\b|\bstandard\b|\bregulation\b|\bpolicy\b|\bact\b|\blaw\b|\bgovernance\b|\bsafety\b|\balignment\b/i,
  /\bchip\b|\bgpu\b|\bnpu\b|\btpu\b|\bcuda\b|\brocm\b|\bhbm\b|\binference\b|\btraining\b/i,
  /\bworkplace\b|\bemployment\b|\blabor\b|\bworkforce\b|\breskilling\b|\bupskilling\b|\boecd\b|\bimf\b|\bworld bank\b|\bwef\b/i,
  /\bbci\b|brain[-\s]?computer interface|neuralink|synchron/i,
  /\bw3c\b|\bwebnn\b/i,
  /논문|벤치마크|모델|출시|발표|아키텍처|가중치|데이터셋|표준|규제|정책|법|가이드라인|칩|반도체|gpu|npu|tpu|cuda|rocm|hbm|추론|학습|정렬|안전|고용|노동|일자리|임금|재교육|직무|노사|자동화|oecd|imf|bci|뇌[-\s]?컴퓨터|뉴럴링크|싱크론/i,
];

function hasHighSignal(post: UnifiedPost): boolean {
  const sample = `${post.title}\n${post.content || ''}\n${post.url || ''}`.slice(0, 2000);
  return HIGH_SIGNAL_PATTERNS.some((re) => re.test(sample));
}

// GitHub Search items are developer-tooling oriented. They often lack explicit "paper/api/policy"
// keywords, but are still valuable "what devs are building" signals.
const GITHUB_DEV_TOOLING_PATTERNS: RegExp[] = [
  /\b(cli|command[-\s]?line|sdk|api|toolkit|framework|library|repo|repository|agentic?|orchestrat(?:ion|or)|workflow|mcp|plugin|extension|server|rag|retrieval|vector|embedding|prompt|copilot|codegen|code\s*agent|autonomous|evals?|benchmark)\b/i,
  /도구|툴킷|프레임워크|라이브러리|리포지토리|에이전트|오케스트레이션|워크플로우|플러그인|확장|서버|검색\s*증강|벡터|임베딩|프롬프트|벤치마크/i,
];

function isGitHubNewsItem(post: UnifiedPost): boolean {
  return (
    post.sourceType === 'news' &&
    post.sourceTier === 'B' &&
    String(post.id || '').startsWith('github-') &&
    /github\.com\//i.test(post.url || '') &&
    (post.sourceName || '').toLowerCase().includes('github search')
  );
}

function hasGitHubDevSignal(post: UnifiedPost): boolean {
  const sample = `${post.title}\n${post.content || ''}\n${post.url || ''}`.slice(0, 2000);
  return GITHUB_DEV_TOOLING_PATTERNS.some((re) => re.test(sample));
}

const LEGACY_MODEL_PATTERNS: RegExp[] = [
  /\bgpt[-\s]?4o\b/i,
  /\bgpt[-\s]?4\b/i,
  /\bgpt[-\s]?3(?:\.\d+)?\b/i,
  /\bgpt[-\s]?3\.5\b/i,
  /\bgemini[-\s]?2(?:\.\d+)?\b/i,
  /\bgemini[-\s]?1\.5\b/i,
  /\bgemini[-\s]?1\b/i,
  /제미나이\s*2(?:\.\d+)?/i,
  /제미나이\s*1\.5/i,
  /제미나이\s*1\b/i,
  /\bclaude\s*3(?:\.\d+)?\b/i,
  /\bclaude\s*2(?:\.\d+)?\b/i,
  /\bclaude\s*1(?:\.\d+)?\b/i,
  /클로드\s*3(?:\.\d+)?/i,
  /클로드\s*2(?:\.\d+)?/i,
  /클로드\s*1(?:\.\d+)?/i,
];

// If a story is primarily about an older model and lacks clear "new/hard" signal, it tends to be evergreen or stale.
// We keep exceptions for high-signal items and for comparisons that include modern models.
const MODERN_MODEL_PATTERNS: RegExp[] = [
  /\bgpt[-\s]?5(?:\.\d+)?\b/i,
  /\bgemini[-\s]?3(?:\.\d+)?\b/i,
  /\bclaude\s*4(?:\.\d+)?\b/i,
  /\bkimi\s*2(?:\.\d+)?\b/i,
  /\bqwen\s*2(?:\.\d+)?\b/i,
  /\bllama\s*3(?:\.\d+)?\b/i,
  /제미나이\s*3(?:\.\d+)?/i,
  /클로드\s*4(?:\.\d+)?/i,
  /키미\s*2(?:\.\d+)?/i,
  /큐웬\s*2(?:\.\d+)?/i,
  /라마\s*3(?:\.\d+)?/i,
];

function mentionsLegacyModel(post: UnifiedPost): boolean {
  const sample = `${post.title}\n${post.content || ''}\n${post.url || ''}`.slice(0, 4000);
  return LEGACY_MODEL_PATTERNS.some((re) => re.test(sample));
}

function mentionsModernModel(post: UnifiedPost): boolean {
  const sample = `${post.title}\n${post.content || ''}\n${post.url || ''}`.slice(0, 4000);
  return MODERN_MODEL_PATTERNS.some((re) => re.test(sample));
}

const LEGACY_ALLOW_CONTEXT_PATTERNS: RegExp[] = [
  /\b(end of life|eol|deprecated|deprecate|sunset|security|cve|vulnerability|outage|incident|postmortem|pricing|price|cost|api|policy|regulation|law|lawsuit|ban|migration)\b/i,
  /종료|eol|지원\s*종료|중단|폐지|보안|취약점|cve|사고|장애|사후\s*보고|가격|비용|api|정책|규제|법|소송|금지|마이그레이션/i,
];

function isLegacyAnchoredTitle(post: UnifiedPost): boolean {
  const title = (post.title || '').slice(0, 300);
  return LEGACY_MODEL_PATTERNS.some((re) => re.test(title));
}

function hasLegacyAllowContext(post: UnifiedPost): boolean {
  const sample = `${post.title}\n${post.content || ''}\n${post.url || ''}`.slice(0, 2000);
  return LEGACY_ALLOW_CONTEXT_PATTERNS.some((re) => re.test(sample));
}

function isLikelyConsumerDrift(post: UnifiedPost): boolean {
  if (post.sourceType === 'raw') return false;
  if (post.sourceTier === 'S') return false; // official sources can have legitimately useful "how-to" posts
  if (isGitHubNewsItem(post)) return false;

  if (hasHighSignal(post)) return false;
  const sample = `${post.title}\n${post.content || ''}\n${post.url || ''}`.slice(0, 2000);
  return CONSUMER_DRIFT_PATTERNS.some((re) => re.test(sample));
}

/**
 * Load DC Inside gallery posts
 */
function loadRawPosts(): UnifiedPost[] {
  if (!existsSync(RAW_DIR)) return [];

  return readdirSync(RAW_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._'))
    .map((f): UnifiedPost | null => {
      try {
        const data = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf-8'));
        return {
          id: data.id,
          sourceType: 'raw' as SourceType,
          sourceTier: 'C',
          sourceName: 'DC Inside 특이점갤러리',
          title: data.title || '',
          content: data.contentText || '',
          url: data.url || `https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=${data.id}`,
          date: data.date || '',
          views: data.views || 0,
          likes: data.likes || 0,
          comments: data.comments || 0,
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
          sourceTier: validateTier(data.sourceTier || 'S'),
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
          sourceTier: validateTier(data.sourceTier || 'A'),
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
        processed.add(buildSourceKey(topic.sourceType || 'unknown', topic.sourceId));
      } catch {}
    }
  }

  // From published
  if (existsSync(PUBLISHED_DIR)) {
    for (const file of readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json') && !f.startsWith('._'))) {
      try {
        const pub = JSON.parse(readFileSync(join(PUBLISHED_DIR, file), 'utf-8'));
        processed.add(buildSourceKey(pub.sourceType || 'unknown', pub.sourceId));
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
    const jsonText = extractJsonObject(response);

    if (!jsonText) {
      console.log('    ⚠️ Failed to parse response');
      return null;
    }

    const result = JSON.parse(jsonText);

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
      aiRelevanceScore: result.aiRelevanceScore,
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

    // When both are community posts, prioritize "hot" signals (comments/likes/views),
    // then fall back to recency.
    if (a.sourceType === 'raw' && b.sourceType === 'raw') {
      const cDiff = (b.comments || 0) - (a.comments || 0);
      if (cDiff !== 0) return cDiff;
      const lDiff = (b.likes || 0) - (a.likes || 0);
      if (lDiff !== 0) return lDiff;
      const vDiff = (b.views || 0) - (a.views || 0);
      if (vDiff !== 0) return vDiff;
    }

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
  const sourceRaw = sourceArg ? sourceArg.split('=')[1]?.trim().toLowerCase() : undefined;
  let sourceFilter: SourceType | undefined;
  if (sourceArg) {
    if (!sourceRaw || !['raw', 'official', 'news'].includes(sourceRaw)) {
      console.error(`❌ Invalid --source value: "${sourceRaw}". Allowed values: raw, official, news`);
      process.exit(1);
    }
    sourceFilter = sourceRaw as SourceType;
  }
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
  if (!existsSync(VC_DIR)) mkdirSync(VC_DIR, { recursive: true });

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
  const unprocessedPosts = allPosts.filter(p => !processedIds.has(buildSourceKey(p.sourceType, p.id)));
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
  const skipCounts = {
    consumerDrift: 0,
    notAiRelated: 0,
    lowSignal: 0,
  };
  const extractedTopics: Array<{ id: string; file: string; sourceId: string; sourceType: SourceType; sourceTier: SourceTier }> = [];

  const memuHealthy = await checkMemuHealth();
  if (memuHealthy) {
    console.log('✅ memU 연결 확인 - 중복 체크 활성화');
  } else {
    console.log('⚠️ memU 연결 불가 - 중복 체크 없이 진행');
  }

  for (const post of sortedPosts) {
    if (extracted >= maxTopics) break;

    const emoji = tierEmoji[post.sourceTier];
    console.log(`${emoji} [${post.sourceTier}] ${post.sourceName}`);
    console.log(`   📋 "${post.title.substring(0, 50)}..."`);

    const githubDevSignal = isGitHubNewsItem(post) && hasGitHubDevSignal(post);
    const highSignal = hasHighSignal(post) || githubDevSignal;

    const isNewsOrOfficial = post.sourceType !== 'raw';
    if (isNewsOrOfficial && isLikelyConsumerDrift(post)) {
      console.log('    ⏭️ Skipping: consumer/how-to/review drift');
      skipCounts.consumerDrift++;
      console.log('');
      continue;
    }
    if (isNewsOrOfficial && mentionsLegacyModel(post) && !mentionsModernModel(post) && !highSignal) {
      console.log('    ⏭️ Skipping: legacy model mention without new/hard signal');
      skipCounts.lowSignal++;
      console.log('');
      continue;
    }
    // Community posts often rehash older-model deep-dives; avoid turning them into "today's" posts unless there's a fresh operational angle.
    if (post.sourceType === 'raw' && isLegacyAnchoredTitle(post) && !mentionsModernModel(post) && !hasLegacyAllowContext(post)) {
      console.log('    ⏭️ Skipping: community post anchored to legacy model (no fresh context)');
      skipCounts.lowSignal++;
      console.log('');
      continue;
    }
    if (!isLikelyAiRelated(post)) {
      console.log('    ⏭️ Skipping: not AI-related (keyword filter)');
      skipCounts.notAiRelated++;
      console.log('');
      continue;
    }

    if (post.sourceType === 'news' && post.sourceTier !== 'S' && !highSignal) {
      console.log('    ⏭️ Skipping: low-signal news (no model/api/policy/hardware/workforce signal)');
      skipCounts.lowSignal++;
      console.log('');
      continue;
    }
    if (post.sourceType === 'raw' && !highSignal) {
      const sample = `${post.title}\n${post.content || ''}`.slice(0, 2000);
      const highEngagementRaw =
        Number(post.views || 0) >= 200 ||
        Number(post.likes || 0) >= 10 ||
        Number(post.comments || 0) >= 10;
      if (!highEngagementRaw && CONSUMER_DRIFT_PATTERNS.some((re) => re.test(sample))) {
        console.log('    ⏭️ Skipping: low-signal community tip/review drift');
        skipCounts.lowSignal++;
        console.log('');
        continue;
      }
    }

    const topic = await extractTopicFromPost(post);

    if (topic) {
      // AI 관련도 필터
      if (topic.aiRelevanceScore !== undefined && topic.aiRelevanceScore < 0.5) {
        console.log(`   ⏭️ AI 관련도 낮음: "${topic.title}" (score: ${topic.aiRelevanceScore})`);
        skipCounts.notAiRelated++;
        console.log('');
        continue;
      }

      // memU 중복 체크
      if (memuHealthy) {
        const similar = await checkSimilar({
          content: topic.title + ' ' + (topic.description || ''),
          user_id: 'aionda',
          threshold: 0.80,
        });
        if (similar && similar.is_similar) {
          console.log(`   ⏭️ [memU] 유사 토픽 존재: "${similar.similar_items?.[0]?.summary?.slice(0, 60)}" (score: ${similar.similarity_score?.toFixed(2)})`);
          console.log('');
          continue;
        }
      }

      const topicFile = `${topic.id}.json`;
      writeFileSync(join(TOPICS_DIR, topicFile), JSON.stringify(topic, null, 2));

      console.log(`   ✅ Topic: "${topic.title}"`);
      console.log(`   📝 Research questions: ${topic.researchQuestions.length}`);
      extracted++;
      extractedTopics.push({
        id: topic.id,
        file: join(TOPICS_DIR, topicFile).replace(/\\/g, '/'),
        sourceId: topic.sourceId,
        sourceType: topic.sourceType,
        sourceTier: topic.sourceTier,
      });
    }

    console.log('');

    // Rate limiting (avoid sleeping on pure skips)
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 동일 이벤트 제한: 제목 키워드가 겹치는 토픽은 상위 1편만 유지
  const beforeDedup = extractedTopics.length;
  const seen = new Map<string, typeof extractedTopics[0]>();
  for (const t of extractedTopics) {
    const topicData = JSON.parse(readFileSync(t.file, 'utf-8'));
    const title = (topicData.title || '').toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '');
    const key = title.split(/\s+/).filter(Boolean).sort().slice(0, 5).join(',');
    if (!key) { seen.set(t.id, t); continue; }
    if (!seen.has(key)) {
      seen.set(key, t);
    }
  }
  const dedupedTopics = Array.from(seen.values());
  if (beforeDedup > dedupedTopics.length) {
    console.log(`   🔄 동일 이벤트 제한: ${beforeDedup} → ${dedupedTopics.length} (${beforeDedup - dedupedTopics.length}건 중복 제거)`);
  }

  console.log('═'.repeat(60));
  console.log(`✨ Done! Extracted ${dedupedTopics.length} topic(s)`);
  console.log(
    `   Skipped: consumer=${skipCounts.consumerDrift}, not-ai=${skipCounts.notAiRelated}, low-signal=${skipCounts.lowSignal}`
  );
  writeFileSync(
    LAST_EXTRACTED_TOPICS_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        extractedCount: dedupedTopics.length,
        topics: dedupedTopics,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${LAST_EXTRACTED_TOPICS_PATH}`);
  console.log('Next step: Run `pnpm research-topic` to research the topics.');
  console.log('═'.repeat(60));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
