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
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { EVERGREEN_QUEUE } from './evergreen/queue';

config({ path: '.env.local' });

const TOPICS_DIR = './data/topics';
const PUBLISHED_DIR = './data/published';
const VC_DIR = './.vc';
const LAST_EXTRACTED_TOPICS_PATH = join(VC_DIR, 'last-extracted-topics.json');

type SourceTier = 'S' | 'A' | 'B' | 'C';
type SourceType = 'raw' | 'official' | 'news';

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

  return { limit: limitRaw, targetIds };
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Evergreen Topic Queue');
  console.log('  Source: curated search-intent topics → data/topics');
  console.log('═'.repeat(60) + '\n');

  const { limit, targetIds } = parseArgs(process.argv.slice(2));

  if (!existsSync(TOPICS_DIR)) mkdirSync(TOPICS_DIR, { recursive: true });
  if (!existsSync(VC_DIR)) mkdirSync(VC_DIR, { recursive: true });

  const processed = getProcessedSourceIds();
  const now = new Date();

  const candidates = EVERGREEN_QUEUE
    .filter((seed) => {
      if (targetIds.length === 0) return true;
      return targetIds.includes(seed.id) || targetIds.includes(`evergreen-${seed.id}`);
    })
    .map((seed) => ({ seed, sourceId: `evergreen-${seed.id}` }))
    .filter(({ sourceId }) => {
      // Explicit targets should be extractable even if previously processed.
      if (targetIds.length > 0) return true;
      return !processed.has(sourceId);
    });

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
  console.log(`🎯 Extracting up to ${limit} evergreen topic(s) (selected=${selected.length})\n`);

  const written: Array<{ id: string; file: string; sourceId: string; sourceType: SourceType; sourceTier: SourceTier }> = [];

  for (const { seed, sourceId } of selected) {
    const extractedAt = new Date().toISOString();
    const topic: ExtractedTopic = {
      id: `topic-${Date.now()}-${sourceId}`,
      sourceId,
      sourceUrl: '',
      sourceDate: extractedAt,
      sourceType: 'official',
      sourceTier: 'A',
      sourceName: 'Evergreen (Search Queue)',
      title: seed.title,
      description: seed.description,
      keyInsights: seed.keyInsights,
      researchQuestions: seed.researchQuestions,
      extractedAt,
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

    console.log(`✅ ${seed.id}: ${seed.title}`);
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

