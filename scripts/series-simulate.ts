/**
 * Editorial series simulation (no AI calls).
 *
 * Goal: sanity-check the heuristic distribution across recent researched topics.
 *
 * Usage:
 *   pnpm -s tsx scripts/series-simulate.ts --limit=40
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { scoreEditorialSeriesSignals, selectEditorialSeries, type EditorialSeries } from './lib/editorial-series.js';

const RESEARCHED_DIR = './data/researched';

function parseIntArg(args: string[], name: string, fallback: number): number {
  const raw = args.find((a) => a.startsWith(`${name}=`))?.split('=')[1] ?? '';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp<T>(items: T[], limit: number): T[] {
  return items.slice(0, Math.max(0, limit));
}

type TopicLike = { title?: string; description?: string; keyInsights?: string[] };

function safeParseTopic(filePath: string): TopicLike {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as any;
    return {
      title: typeof parsed.title === 'string' ? parsed.title : parsed.topic?.title,
      description: typeof parsed.description === 'string' ? parsed.description : parsed.topic?.description,
      keyInsights: Array.isArray(parsed.keyInsights)
        ? parsed.keyInsights.map(String)
        : Array.isArray(parsed.topic?.keyInsights)
          ? parsed.topic.keyInsights.map(String)
          : [],
    };
  } catch {
    return {};
  }
}

function main() {
  const args = process.argv.slice(2);
  const limit = parseIntArg(args, '--limit', 50);

  const files = readdirSync(RESEARCHED_DIR)
    .filter((f) => f.startsWith('topic-') && f.endsWith('.json'))
    .map((f) => join(RESEARCHED_DIR, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  const targets = clamp(files, limit);
  const counts: Record<EditorialSeries, number> = {
    'k-ai-pulse': 0,
    explainer: 0,
    'deep-dive': 0,
    comparison: 0,
    'practical-guide': 0,
    perspective: 0,
  };
  const examples: Record<EditorialSeries, string[]> = {
    'k-ai-pulse': [],
    explainer: [],
    'deep-dive': [],
    comparison: [],
    'practical-guide': [],
    perspective: [],
  };

  const ambiguous: Array<{ title: string; series: string; pulse: number; deep: number; explainer: number }> = [];

  for (const filePath of targets) {
    const topic = safeParseTopic(filePath);
    const title = String(topic.title || '').trim() || '(untitled)';

    const series = selectEditorialSeries(topic);
    counts[series] += 1;

    if (examples[series].length < 6) {
      examples[series].push(title);
    }

    const scored = scoreEditorialSeriesSignals(topic);
    if (scored.pulseScore > 0 && scored.deepDiveScore > 0 && ambiguous.length < 12) {
      ambiguous.push({
        title,
        series,
        pulse: scored.pulseScore,
        deep: scored.deepDiveScore,
        explainer: scored.explainerScore,
      });
    }
  }

  console.log('\n' + '═'.repeat(64));
  console.log('Editorial Series Simulation (heuristics)');
  console.log(`Targets: ${targets.length} (most recent researched topics)`);
  console.log('═'.repeat(64) + '\n');

  console.log('Distribution:');
  console.log(`- K‑AI Pulse: ${counts['k-ai-pulse']}`);
  console.log(`- Explainer: ${counts.explainer}`);
  console.log(`- Deep Dive: ${counts['deep-dive']}`);
  console.log(`- Comparison: ${counts.comparison}`);
  console.log(`- Practical Guide: ${counts['practical-guide']}`);
  console.log(`- Perspective: ${counts.perspective}`);

  console.log('\nExamples:');
  for (const key of Object.keys(examples) as EditorialSeries[]) {
    const label =
      key === 'k-ai-pulse'
        ? 'K‑AI Pulse'
        : key === 'deep-dive'
          ? 'Deep Dive'
          : key === 'comparison'
            ? 'Comparison'
            : key === 'practical-guide'
              ? 'Practical Guide'
              : key === 'perspective'
                ? 'Perspective'
                : 'Explainer';
    console.log(`\n[${label}]`);
    for (const t of examples[key]) console.log(`- ${t}`);
  }

  if (ambiguous.length > 0) {
    console.log('\nAmbiguous (both Pulse + DeepDive signals present):');
    for (const item of ambiguous) {
      console.log(`- (${item.series}) p=${item.pulse} d=${item.deep} e=${item.explainer} :: ${item.title}`);
    }
  }
}

main();
