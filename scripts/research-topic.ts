/**
 * Research topics using Gemini + Google Search
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 *
 * Gemini Flash + Google Search로 실시간 웹 검색 기반 리서치
 *
 * Usage:
 *   pnpm research-topic --limit=1
 *   pnpm research-topic --id=topic-...            # topicId or sourceId
 *   pnpm research-topic --id=topic-... --force    # re-run even if already researched
 *
 * Default behavior:
 *   - If --since is omitted, uses TOPICS_SINCE env var (default: 14d)
 *   - Use --since=all to disable time filtering
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { searchAndVerify as geminiSearchAndVerify } from './lib/gemini';
import { searchAndVerify as openaiSearchAndVerify } from './lib/openai-search.js';
import { classifySource, SourceTier } from './lib/search-mode.js';
import { getAiTextProvider } from './lib/ai-text.js';

config({ path: '.env.local' });

const TOPICS_DIR = './data/topics';
const RESEARCHED_DIR = './data/researched';
const VC_DIR = './.vc';
const LAST_EXTRACTED_TOPICS_PATH = join(VC_DIR, 'last-extracted-topics.json');

// Minimum confidence to consider research valid
const MIN_CONFIDENCE = 0.6;
const DEFAULT_SINCE = (process.env.TOPICS_SINCE || '14d').trim();
const TIER_ORDER: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
const AI_PROVIDER = getAiTextProvider();

type EvergreenIntent = 'informational' | 'commercial' | 'troubleshooting';
type EvergreenSchema = 'howto' | 'faq';

interface ExtractedTopic {
  id: string;
  sourceId: string;
  sourceUrl: string;
  sourceDate: string;
  sourceType?: string;
  sourceTier?: string;
  sourceName?: string;
  title: string;
  description: string;
  keyInsights: string[];
  researchQuestions: string[];
  extractedAt: string;
  primaryKeyword?: string;
  intent?: EvergreenIntent;
  topic?: string;
  schema?: EvergreenSchema;
}

interface VerifiedSource {
  url: string;
  title: string;
  tier: string;
  domain: string;
  icon: string;
  snippet?: string;
}

interface ResearchFinding {
  question: string;
  answer: string;
  confidence: number;
  sources: VerifiedSource[];
  unverified: string[];
}

interface ResearchedTopic {
  topicId: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  description: string;
  keyInsights: string[];
  findings: ResearchFinding[];
  researchedAt: string;
  overallConfidence: number;
  canPublish: boolean;
  primaryKeyword?: string;
  intent?: EvergreenIntent;
  topic?: string;
  schema?: EvergreenSchema;
}

function getTierIcon(tier: string): string {
  switch (tier) {
    case 'S': return '🏛️';
    case 'A': return '🛡️';
    case 'B': return '⚠️';
    default: return '📄';
  }
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function parseTopicDate(value: string): Date | null {
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

function readLastExtractedTopicIds(): Set<string> | null {
  if (!existsSync(LAST_EXTRACTED_TOPICS_PATH)) return null;
  try {
    const raw = readFileSync(LAST_EXTRACTED_TOPICS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { topics?: Array<{ id?: string }> };
    const ids = (parsed.topics || [])
      .map((t) => String(t?.id || '').trim())
      .filter(Boolean);
    return ids.length > 0 ? new Set(ids) : new Set();
  } catch {
    return null;
  }
}

async function researchQuestion(
  question: string,
  context: string
): Promise<ResearchFinding> {
  console.log(`    🔍 Researching: "${question.substring(0, 50)}..."`);

  try {
    const result =
      AI_PROVIDER === 'openai'
        ? await openaiSearchAndVerify(question, context)
        : await geminiSearchAndVerify(question, context);

    // 실제 웹 검색 결과를 VerifiedSource 형식으로 변환
    const sources: VerifiedSource[] = result.sources.map(s => ({
      url: s.url,
      title: s.title,
      tier: s.tier || 'C',
      domain: getDomainFromUrl(s.url),
      icon: getTierIcon(s.tier || 'C'),
      snippet: s.snippet,
    }));

    const tierCounts = sources.reduce((acc, s) => {
      acc[s.tier] = (acc[s.tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(`       Confidence: ${Math.round(result.confidence * 100)}% | Sources: ${sources.length} (S:${tierCounts['S'] || 0} A:${tierCounts['A'] || 0})`);

    return {
      question,
      answer: result.answer,
      confidence: result.confidence,
      sources,
      unverified: result.unverified,
    };
  } catch (error) {
    console.error(`       ❌ Research failed:`, error);
    return {
      question,
      answer: 'Research failed',
      confidence: 0,
      sources: [],
      unverified: [question],
    };
  }
}

async function researchTopic(topic: ExtractedTopic): Promise<ResearchedTopic> {
  console.log(`\n📋 Topic: "${topic.title}"`);
  console.log(`   Description: ${topic.description}`);
  console.log(`   Questions: ${topic.researchQuestions.length}\n`);

  const findings: ResearchFinding[] = [];
  const context = `${topic.title}\n${topic.description}\n${topic.keyInsights.join('\n')}`;

  for (const question of topic.researchQuestions) {
    const finding = await researchQuestion(question, context);
    findings.push(finding);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Calculate overall confidence
  const avgConfidence = findings.length > 0
    ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
    : 0;

  // 검증된 출처 확인 (Tier S/A)
  const hasTrustedSources = findings.some(f =>
    f.sources.some(s => s.tier === 'S' || s.tier === 'A')
  );

  const primaryTier = classifySource(topic.sourceUrl || '');
  const hasTrustedPrimary = primaryTier === SourceTier.S || primaryTier === SourceTier.A;
  const hasTrustedEvidence = hasTrustedSources || hasTrustedPrimary;

  const hasVerifiedContent = avgConfidence >= MIN_CONFIDENCE && hasTrustedEvidence;

  // 전체 출처 통계
  const allSources = findings.flatMap(f => f.sources);
  const tierStats = allSources.reduce((acc, s) => {
    acc[s.tier] = (acc[s.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n   📊 Summary:`);
  console.log(`      Average Confidence: ${Math.round(avgConfidence * 100)}%`);
  console.log(`      Total Sources: ${allSources.length} (S:${tierStats['S'] || 0} A:${tierStats['A'] || 0} B:${tierStats['B'] || 0})`);
  console.log(`      Has Trusted Evidence: ${(hasTrustedEvidence) ? '✅' : '❌'}`);
  console.log(`      Can Publish: ${hasVerifiedContent ? '✅' : '❌'}`);

  return {
    topicId: topic.id,
    sourceId: topic.sourceId,
    sourceUrl: topic.sourceUrl,
    title: topic.title,
    description: topic.description,
    keyInsights: topic.keyInsights,
    findings,
    researchedAt: new Date().toISOString(),
    overallConfidence: avgConfidence,
    canPublish: hasVerifiedContent,
    primaryKeyword: topic.primaryKeyword ? String(topic.primaryKeyword).trim() : undefined,
    intent: topic.intent,
    topic: topic.topic ? String(topic.topic).trim() : undefined,
    schema: topic.schema,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const maxTopics = limitArg ? parseInt(limitArg.split('=')[1]) : 5;
  const idArg = args.find((a) => a.startsWith('--id='));
  const targetIds = idArg
    ? idArg
        .split('=')[1]
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const force = args.includes('--force');
  const fromLastExtract = args.includes('--from-last-extract');
  const sinceArg = args.find((a) => a.startsWith('--since='));
  const since = parseSinceArg(sinceArg ? sinceArg.split('=')[1] : DEFAULT_SINCE);

  console.log('\n' + '═'.repeat(60));
  const providerLabel = AI_PROVIDER === 'openai' ? 'OpenAI + web_search_preview' : 'Gemini + Google Search';
  console.log(`  Research Pipeline (${providerLabel})`);
  console.log('  Real-time web search for topic research');
  console.log('═'.repeat(60) + '\n');

  // Ensure directories exist
  if (!existsSync(TOPICS_DIR)) {
    console.log('❌ No topics found. Run `pnpm extract-topics` first.');
    process.exit(1);
  }
  if (!existsSync(RESEARCHED_DIR)) {
    mkdirSync(RESEARCHED_DIR, { recursive: true });
  }

  // Get already researched topics
  const researchedIds = new Set<string>();
  if (existsSync(RESEARCHED_DIR)) {
    for (const file of readdirSync(RESEARCHED_DIR).filter(f => f.endsWith('.json') && !f.startsWith('._'))) {
      const filePath = join(RESEARCHED_DIR, file);
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf-8')) as { topicId?: string };
        if (typeof data.topicId === 'string' && data.topicId.trim()) {
          researchedIds.add(data.topicId);
        } else {
          console.warn(`⚠️ Skipping researched file with missing topicId: ${filePath}`);
        }
      } catch (error) {
        console.warn(`⚠️ Skipping corrupted JSON file: ${filePath}`, error);
        continue;
      }
    }
  }

  // Get topics to research
  const lastExtractedIds = fromLastExtract ? readLastExtractedTopicIds() : null;
  const topicFiles = readdirSync(TOPICS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._'))
    .map(f => {
      const filePath = join(TOPICS_DIR, f);
      try {
        const topic = JSON.parse(readFileSync(filePath, 'utf-8')) as ExtractedTopic;
        return { file: f, topic };
      } catch (error) {
        console.warn(`⚠️ Skipping corrupted JSON file: ${filePath}`, error);
        return null;
      }
    })
    .filter((entry): entry is { file: string; topic: ExtractedTopic } => Boolean(entry))
    .filter(({ topic }) => {
      if (lastExtractedIds && !lastExtractedIds.has(topic.id)) return false;
      const matchesTarget =
        targetIds.length === 0 ||
        targetIds.includes(topic.id) ||
        targetIds.includes(topic.sourceId);
      if (!matchesTarget) return false;
      if (!force && researchedIds.has(topic.id)) return false;

      // Explicit IDs should not be blocked by time filtering.
      if (targetIds.length > 0) return true;

      if (!since) return true;

      const topicDate = parseTopicDate(topic.sourceDate || '');
      if (!topicDate) return false;
      return topicDate.getTime() >= since.getTime();
    })
    .sort((a, b) => {
      const tierA = TIER_ORDER[String(a.topic.sourceTier || 'C').toUpperCase()] ?? 3;
      const tierB = TIER_ORDER[String(b.topic.sourceTier || 'C').toUpperCase()] ?? 3;
      if (tierA !== tierB) return tierA - tierB;

      const dateA = parseTopicDate(a.topic.sourceDate || '')?.getTime() || 0;
      const dateB = parseTopicDate(b.topic.sourceDate || '')?.getTime() || 0;
      if (dateA !== dateB) return dateB - dateA;

      const extractedA = new Date(a.topic.extractedAt || '').getTime() || 0;
      const extractedB = new Date(b.topic.extractedAt || '').getTime() || 0;
      return extractedB - extractedA;
    })
    .slice(0, maxTopics);

  if (topicFiles.length === 0) {
    console.log('✅ No new topics to research.');
    process.exit(0);
  }

  if (since && targetIds.length === 0) {
    console.log(`⏱️  Since: ${since.toISOString()} (set --since=all to disable)`);
  } else if (targetIds.length === 0) {
    console.log('⏱️  Since: (all time)');
  }

  console.log(`📚 Found ${topicFiles.length} topic(s) to research\n`);

  let researched = 0;
  let publishable = 0;

  for (const { file, topic } of topicFiles) {
    const result = await researchTopic(topic);

    // Save result
    writeFileSync(
      join(RESEARCHED_DIR, `${topic.id}.json`),
      JSON.stringify(result, null, 2)
    );

    researched++;
    if (result.canPublish) publishable++;

    // Rate limiting between topics
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✨ Done! Researched: ${researched} | Publishable: ${publishable}`);
  console.log('Next step: Run `pnpm write-article` to generate articles.');
  console.log('═'.repeat(60));

  // Some HTTP clients can keep sockets open and prevent the process from
  // exiting naturally. This script is intended for cron/CI usage, so exit
  // explicitly once all outputs are written.
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
