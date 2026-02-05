/**
 * Evergreen topic extractor (search-intent queue)
 *
 * Why:
 * - Keeps the site current even when real-time sources are quiet
 * - Produces SEO-friendly “Explainer/Pillar” topics with clear research questions
 *
 * Writes ExtractedTopic JSON files into data/topics and updates
 * .vc/last-extracted-topics.json to integrate with the existing pipeline:
 * crawl → extract-topics → research-topic → write-article
 *
 * Usage:
 *   pnpm extract-evergreen --limit=2
 *   pnpm extract-evergreen --id=mcp-intro
 *   pnpm extract-evergreen --queue=keywords-ko --limit=3
 *   pnpm extract-evergreen --queue=keywords-ko --topic=openai --intent=troubleshooting --limit=5
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { EVERGREEN_QUEUE } from './evergreen/queue';

config({ path: '.env.local' });

const TOPICS_DIR = './data/topics';
const PUBLISHED_DIR = './data/published';
const KEYWORDS_KO_PATH = './data/evergreen/keywords.ko.json';
const VC_DIR = './.vc';
const LAST_EXTRACTED_TOPICS_PATH = join(VC_DIR, 'last-extracted-topics.json');

type SourceTier = 'S' | 'A' | 'B' | 'C';
type SourceType = 'raw' | 'official' | 'news';
type EvergreenQueueName = 'seeds' | 'keywords-ko';
type EvergreenIntent = 'informational' | 'commercial' | 'troubleshooting';
type EvergreenSchema = 'howto' | 'faq';

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
  primaryKeyword?: string;
  intent?: EvergreenIntent;
  topic?: string;
  schema?: EvergreenSchema;
}

interface KeywordQueueItem {
  id: string;
  primaryKeyword: string;
  intent: EvergreenIntent;
  topic?: string;
  priority?: string;
  updateCadenceDays?: number;
  schema?: EvergreenSchema;
  notes?: string;
}

function getProcessedSourceIds(): Set<string> {
  const processed = new Set<string>();

  if (existsSync(TOPICS_DIR)) {
    for (const file of readdirSync(TOPICS_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('._'))) {
      try {
        const raw = readFileSync(join(TOPICS_DIR, file), 'utf-8');
        const topic = JSON.parse(raw) as { sourceId?: string };
        const id = String(topic.sourceId || '').trim();
        if (id) processed.add(id);
      } catch {
        // ignore
      }
    }
  }

  if (existsSync(PUBLISHED_DIR)) {
    for (const file of readdirSync(PUBLISHED_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('._'))) {
      try {
        const raw = readFileSync(join(PUBLISHED_DIR, file), 'utf-8');
        const pub = JSON.parse(raw) as { sourceId?: string };
        const id = String(pub.sourceId || '').trim();
        if (id) processed.add(id);
      } catch {
        // ignore
      }
    }
  }

  return processed;
}

function parseArgs(args: string[]) {
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const idArg = args.find((a) => a.startsWith('--id='));
  const queueArg = args.find((a) => a.startsWith('--queue='));
  const topicArg = args.find((a) => a.startsWith('--topic='));
  const intentArg = args.find((a) => a.startsWith('--intent='));
  const schemaArg = args.find((a) => a.startsWith('--schema='));
  const priorityArg = args.find((a) => a.startsWith('--priority='));
  const shuffle = args.includes('--shuffle');
  const seedArg = args.find((a) => a.startsWith('--seed='));

  const limitFromCli = limitArg ? Number.parseInt(limitArg.split('=')[1] || '', 10) : undefined;
  const limitFromEnv = process.env.EVERGREEN_EXTRACT_LIMIT
    ? Number.parseInt(process.env.EVERGREEN_EXTRACT_LIMIT, 10)
    : undefined;
  const limitRaw =
    Number.isFinite(limitFromCli) && (limitFromCli as number) > 0
      ? (limitFromCli as number)
      : Number.isFinite(limitFromEnv) && (limitFromEnv as number) > 0
        ? (limitFromEnv as number)
        : 3;

  const targetIds = idArg
    ? idArg
        .split('=')[1]
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  const queueRaw = (queueArg ? queueArg.split('=')[1] : '').trim().toLowerCase();
  const queue: EvergreenQueueName =
    queueRaw === 'keywords-ko' || queueRaw === 'keywords' || queueRaw === 'kw-ko'
      ? 'keywords-ko'
      : 'seeds';

  const topics = (topicArg ? topicArg.split('=')[1] : '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

  const intentRaw = (intentArg ? intentArg.split('=')[1] : '').trim().toLowerCase();
  const intent =
    intentRaw === 'informational' || intentRaw === 'commercial' || intentRaw === 'troubleshooting'
      ? (intentRaw as EvergreenIntent)
      : undefined;

  const schemaRaw = (schemaArg ? schemaArg.split('=')[1] : '').trim().toLowerCase();
  const schema =
    schemaRaw === 'faq' || schemaRaw === 'howto'
      ? (schemaRaw as EvergreenSchema)
      : undefined;

  const priority = (priorityArg ? priorityArg.split('=')[1] : '').trim().toUpperCase();
  const seed = seedArg ? Number.parseInt(seedArg.split('=')[1] || '', 10) : undefined;

  return { limit: limitRaw, targetIds, queue, topics, intent, schema, priority, shuffle, seed };
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace<T>(arr: T[], seed: number) {
  const rnd = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function readKeywordQueue(path: string): KeywordQueueItem[] {
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KeywordQueueItem[]) : [];
  } catch {
    return [];
  }
}

function buildTitleFromKeyword(item: KeywordQueueItem): string {
  const kw = String(item.primaryKeyword || '').trim();
  if (!kw) return item.id;

  if (item.schema === 'faq' || item.intent === 'commercial') {
    if (/\b(차이|비교|가격|요금|플랜)\b/i.test(kw)) return kw;
    return `${kw} FAQ`;
  }

  if (item.schema === 'howto' || item.intent === 'troubleshooting') {
    if (/(해결|방법|가이드|설치|취소|해지)/i.test(kw)) return kw;
    if (/(안됨|오류|error|failed|quota|쿼터|rate\s*limit|429|401|403|500)/i.test(kw)) {
      return `${kw}: 원인과 해결`;
    }
    return `${kw} 하는 법`;
  }

  return kw;
}

function buildDescriptionFromKeyword(item: KeywordQueueItem): string {
  const notes = String(item.notes || '').trim();
  if (notes) return notes;
  const kw = String(item.primaryKeyword || item.id || '').trim();
  return `검색 의도("${kw}")를 기준으로 핵심 개념/오해/실전 적용을 근거 기반으로 정리한다.`;
}

function buildKeyInsightsFromKeyword(item: KeywordQueueItem): string[] {
  const notes = String(item.notes || '').trim();
  const base: string[] = [];

  if (item.intent === 'troubleshooting' || item.schema === 'howto') {
    base.push('증상을 “장애/계정/네트워크/클라이언트”로 분리해 진단하면 해결 속도가 빨라진다.');
    base.push('공식 문서/상태 페이지의 권장 절차를 우선 적용하고, 환경별 예외를 체크리스트로 관리한다.');
  } else if (item.intent === 'commercial' || item.schema === 'faq') {
    base.push('비교는 기능표보다 “업무 요구(관리/보안/한도)”를 기준으로 해야 실전에서 흔들리지 않는다.');
    base.push('가격/정책은 자주 바뀌므로, “as-of(기준일)”와 공식 근거를 함께 제시해야 한다.');
  } else {
    base.push('정의/배경/오해를 분리해서 설명하면 검색 유입 독자가 길을 잃지 않는다.');
    base.push('실전 도입 체크리스트(보안/비용/운영)를 함께 제공해야 글이 오래 남는다.');
  }

  if (notes) base.unshift(notes);
  return base.slice(0, 3);
}

function buildResearchQuestionsFromKeyword(item: KeywordQueueItem): string[] {
  const kw = String(item.primaryKeyword || item.id || '').trim();

  if (item.intent === 'troubleshooting' || item.schema === 'howto') {
    return [
      `${kw} 증상이 발생하는 대표 원인(계정 상태/네트워크/클라이언트/정책)은 무엇인가?`,
      `공식 도움말/문서/상태 페이지에서 권장하는 해결 절차는 무엇인가?`,
      `재발을 줄이기 위한 예방/모니터링/운영 체크리스트는 무엇인가?`,
    ];
  }

  if (item.intent === 'commercial' || item.schema === 'faq') {
    return [
      `공식 가격/플랜 문서 기준으로 "${kw}"에 해당하는 기능/제한 차이는 무엇인가?`,
      `업무용(보안/관리/데이터 정책) 관점에서 선택 기준은 무엇인가?`,
      `비용/사용량(레이트리밋/좌석/추가 요금) 관점에서 흔한 오해는 무엇인가?`,
    ];
  }

  return [
    `공식 문서/표준/대표 구현에서 "${kw}"를 어떻게 정의하고 어떤 문제를 해결하는가?`,
    `도입 시 요구되는 최소 구성요소(데이터/권한/도구/관측성)는 무엇인가?`,
    `초보자가 자주 하는 오해/실수와 이를 피하는 체크리스트는 무엇인가?`,
  ];
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Evergreen Topic Queue');
  console.log('  Source: curated search-intent topics → data/topics');
  console.log('═'.repeat(60) + '\n');

  const { limit, targetIds, queue, topics, intent, schema, priority, shuffle, seed } = parseArgs(
    process.argv.slice(2)
  );

  if (!existsSync(TOPICS_DIR)) mkdirSync(TOPICS_DIR, { recursive: true });
  if (!existsSync(VC_DIR)) mkdirSync(VC_DIR, { recursive: true });

  const processed = getProcessedSourceIds();
  const now = new Date();

  const candidates: Array<
    | { mode: 'seeds'; sourceId: string; id: string; title: string; description: string; keyInsights: string[]; researchQuestions: string[] }
    | { mode: 'keywords-ko'; sourceId: string; item: KeywordQueueItem; title: string; description: string; keyInsights: string[]; researchQuestions: string[] }
  > = [];

  if (queue === 'keywords-ko') {
    const items = readKeywordQueue(KEYWORDS_KO_PATH);
    for (const item of items) {
      const itemId = String(item?.id || '').trim();
      const primaryKeyword = String(item?.primaryKeyword || '').trim();
      if (!itemId || !primaryKeyword) continue;

      const itemTopic = String(item?.topic || '').trim().toLowerCase();
      if (topics.length > 0 && (!itemTopic || !topics.includes(itemTopic))) continue;
      if (intent && item.intent !== intent) continue;
      if (schema && item.schema !== schema) continue;
      if (priority && String(item.priority || '').trim().toUpperCase() !== priority) continue;

      const sourceId = `evergreen-kw-ko-${itemId}`;
      const matchesTarget = targetIds.length === 0 || targetIds.includes(itemId) || targetIds.includes(sourceId);
      if (!matchesTarget) continue;

      // Explicit targets should be extractable even if previously processed.
      if (targetIds.length === 0 && processed.has(sourceId)) continue;

      candidates.push({
        mode: 'keywords-ko',
        sourceId,
        item: {
          ...item,
          id: itemId,
          primaryKeyword,
        },
        title: buildTitleFromKeyword(item),
        description: buildDescriptionFromKeyword(item),
        keyInsights: buildKeyInsightsFromKeyword(item),
        researchQuestions: buildResearchQuestionsFromKeyword(item),
      });
    }

    const priorityOrder = (value: string) => {
      const p = String(value || '').trim().toUpperCase();
      if (p === 'P0') return 0;
      if (p === 'P1') return 1;
      if (p === 'P2') return 2;
      return 3;
    };

    if (shuffle) {
      const ymd = Number(new Date().toISOString().slice(0, 10).replace(/-/g, '')) || 0;
      shuffleInPlace(candidates, Number.isFinite(seed as number) ? (seed as number) : ymd);
    } else {
      candidates.sort((a, b) => {
        if (a.mode !== 'keywords-ko' || b.mode !== 'keywords-ko') return 0;
        const pa = priorityOrder(a.item.priority || '');
        const pb = priorityOrder(b.item.priority || '');
        if (pa !== pb) return pa - pb;
        const ta = String(a.item.topic || '').trim().toLowerCase();
        const tb = String(b.item.topic || '').trim().toLowerCase();
        if (ta !== tb) return ta.localeCompare(tb);
        return String(a.item.id || '').localeCompare(String(b.item.id || ''));
      });
    }
  } else {
    for (const seed of EVERGREEN_QUEUE) {
      const sourceId = `evergreen-${seed.id}`;
      const matchesTarget =
        targetIds.length === 0 || targetIds.includes(seed.id) || targetIds.includes(sourceId);
      if (!matchesTarget) continue;

      // Explicit targets should be extractable even if previously processed.
      if (targetIds.length === 0 && processed.has(sourceId)) continue;

      candidates.push({
        mode: 'seeds',
        sourceId,
        id: seed.id,
        title: seed.title,
        description: seed.description,
        keyInsights: seed.keyInsights,
        researchQuestions: seed.researchQuestions,
      });
    }
  }

  if (candidates.length === 0) {
    console.log('✅ No evergreen topics available (all processed or id not found).');
    writeFileSync(
      LAST_EXTRACTED_TOPICS_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          extractedCount: 0,
          topics: [],
        },
        null,
        2
      )
    );
    console.log(`Wrote ${LAST_EXTRACTED_TOPICS_PATH}`);
    process.exit(0);
  }

  const selected = candidates.slice(0, limit);
  console.log(`📁 Already processed sourceIds: ${processed.size}`);
  console.log(`🧭 Queue: ${queue}`);
  if (queue === 'keywords-ko') {
    const filters = [
      topics.length > 0 ? `topic=${topics.join(',')}` : '',
      intent ? `intent=${intent}` : '',
      schema ? `schema=${schema}` : '',
      priority ? `priority=${priority}` : '',
      shuffle ? `shuffle=true` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (filters) console.log(`🔎 Filters: ${filters}`);
  }
  console.log(`🎯 Extracting up to ${limit} evergreen topic(s) (selected=${selected.length})\n`);

  const written: Array<{ id: string; file: string; sourceId: string; sourceType: SourceType; sourceTier: SourceTier }> = [];

  for (const entry of selected) {
    const extractedAt = new Date().toISOString();
    const sourceId = entry.sourceId;
    const topicBase: Omit<ExtractedTopic, 'id' | 'sourceId' | 'title' | 'description' | 'keyInsights' | 'researchQuestions'> = {
      sourceUrl: '',
      sourceDate: extractedAt,
      sourceType: 'official',
      sourceTier: 'A',
      sourceName: queue === 'keywords-ko' ? 'Evergreen (Keywords KO)' : 'Evergreen (Seed Queue)',
      extractedAt,
    };
    const topic: ExtractedTopic =
      entry.mode === 'keywords-ko'
        ? {
            ...topicBase,
            id: `topic-${Date.now()}-${sourceId}`,
            sourceId,
            title: entry.title,
            description: entry.description,
            keyInsights: entry.keyInsights,
            researchQuestions: entry.researchQuestions,
            primaryKeyword: entry.item.primaryKeyword,
            intent: entry.item.intent,
            topic: entry.item.topic ? String(entry.item.topic).trim() : undefined,
            schema: entry.item.schema,
          }
        : {
            ...topicBase,
            id: `topic-${Date.now()}-${sourceId}`,
            sourceId,
            title: entry.title,
            description: entry.description,
            keyInsights: entry.keyInsights,
            researchQuestions: entry.researchQuestions,
          };

    const topicFile = `${topic.id}.json`;
    const topicPath = join(TOPICS_DIR, topicFile);
    writeFileSync(topicPath, JSON.stringify(topic, null, 2));
    written.push({
      id: topic.id,
      file: topicPath.replace(/\\/g, '/'),
      sourceId: topic.sourceId,
      sourceType: topic.sourceType,
      sourceTier: topic.sourceTier,
    });

    const label = entry.mode === 'keywords-ko' ? entry.item.id : entry.id;
    console.log(`✅ ${label}: ${topic.title}`);
  }

  writeFileSync(
    LAST_EXTRACTED_TOPICS_PATH,
    JSON.stringify(
      {
        generatedAt: now.toISOString(),
        extractedCount: written.length,
        topics: written,
      },
      null,
      2
    )
  );
  console.log(`\nWrote ${LAST_EXTRACTED_TOPICS_PATH}`);
  console.log('Next step: Run `pnpm research-topic --from-last-extract`');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
