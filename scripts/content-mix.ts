/**
 * Content mix snapshot (sources/tags/series) for tuning the pipeline.
 *
 * Usage:
 *   pnpm -s content:mix
 *   pnpm -s content:mix --days=7
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { classifySource, SourceTier } from './lib/search-mode.js';

type MixRow = {
  locale: string;
  slug: string;
  date: Date;
  sourceId: string;
  sourceUrl: string;
  domain: string;
  sourceTier: SourceTier;
  sourceKind: 'evergreen' | 'community' | 'trusted' | 'caution' | 'general';
  series: 'k-ai-pulse' | 'explainer' | 'deep-dive' | 'other';
  tags: string[];
};

function parseIntArg(args: string[], name: string, fallback: number): number {
  const raw = args.find((a) => a.startsWith(`${name}=`))?.split('=')[1] ?? '';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeDate(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function pickSeries(tags: string[]): MixRow['series'] {
  const set = new Set(tags.map((t) => String(t || '').toLowerCase()));
  if (set.has('k-ai-pulse')) return 'k-ai-pulse';
  if (set.has('explainer')) return 'explainer';
  if (set.has('deep-dive')) return 'deep-dive';
  return 'other';
}

function classifyKind(row: { sourceId: string; sourceUrl: string; domain: string; sourceTier: SourceTier }): MixRow['sourceKind'] {
  if (row.sourceId.startsWith('evergreen-')) return 'evergreen';
  if (/dcinside\.com$/i.test(row.domain) || /gall\.dcinside\.com$/i.test(row.domain) || /dcinside\.com/i.test(row.sourceUrl)) {
    return 'community';
  }
  if (row.sourceTier === SourceTier.S || row.sourceTier === SourceTier.A) return 'trusted';
  if (row.sourceTier === SourceTier.B) return 'caution';
  return 'general';
}

function inc(map: Map<string, number>, key: string, n = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + n);
}

function top(map: Map<string, number>, limit: number): Array<[string, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function percent(n: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

function readRows(postsDir: string): MixRow[] {
  if (!fs.existsSync(postsDir)) return [];
  const locales = fs.readdirSync(postsDir).filter((d) => fs.statSync(path.join(postsDir, d)).isDirectory());
  const rows: MixRow[] = [];

  for (const locale of locales) {
    const dir = path.join(postsDir, locale);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith('.mdx') && !file.endsWith('.md')) continue;
      const fullPath = path.join(dir, file);
      const raw = fs.readFileSync(fullPath, 'utf8');
      const { data } = matter(raw);
      const date = safeDate(data.date);
      if (!date) continue;

      const slug = String(data.slug || file.replace(/\.mdx?$/, ''));
      const sourceId = String(data.sourceId || '').trim();
      const sourceUrl = String(data.sourceUrl || '').trim();
      const domain = getDomain(sourceUrl);
      const tier = sourceUrl ? classifySource(sourceUrl) : SourceTier.C;
      const tags = Array.isArray(data.tags) ? data.tags.map((t: any) => String(t || '').trim()).filter(Boolean) : [];
      const series = pickSeries(tags);
      const sourceKind = classifyKind({ sourceId, sourceUrl, domain, sourceTier: tier });

      rows.push({
        locale,
        slug,
        date,
        sourceId,
        sourceUrl,
        domain,
        sourceTier: tier,
        sourceKind,
        series,
        tags: tags.map((t) => t.toLowerCase()),
      });
    }
  }

  return rows;
}

function main() {
  const args = process.argv.slice(2);
  const days = parseIntArg(args, '--days', 7);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const postsDir = path.join(process.cwd(), 'apps', 'web', 'content', 'posts');
  const rows = readRows(postsDir).filter((r) => r.date.getTime() >= since.getTime());
  rows.sort((a, b) => b.date.getTime() - a.date.getTime());

  const total = rows.length;
  const byLocale = new Map<string, number>();
  const bySeries = new Map<string, number>();
  const byKind = new Map<string, number>();
  const byDomain = new Map<string, number>();
  const byTag = new Map<string, number>();

  for (const r of rows) {
    inc(byLocale, r.locale);
    inc(bySeries, r.series);
    inc(byKind, r.sourceKind);
    if (r.domain) inc(byDomain, r.domain);
    for (const t of r.tags) inc(byTag, t);
  }

  console.log(`\nContent Mix (last ${days} day(s))`);
  console.log(`- Total posts: ${total}`);
  console.log(`- Locales: ${top(byLocale, 10).map(([k, v]) => `${k}=${v}`).join(', ') || '(none)'}`);
  console.log('');

  console.log('Series mix:');
  for (const [k, v] of top(bySeries, 10)) {
    console.log(`- ${k}: ${v} (${percent(v, total)})`);
  }
  console.log('');

  console.log('Source kind mix:');
  for (const [k, v] of top(byKind, 10)) {
    console.log(`- ${k}: ${v} (${percent(v, total)})`);
  }
  console.log('');

  console.log('Top source domains:');
  for (const [k, v] of top(byDomain, 15)) {
    console.log(`- ${k}: ${v}`);
  }
  console.log('');

  console.log('Top tags:');
  for (const [k, v] of top(byTag, 20)) {
    console.log(`- ${k}: ${v}`);
  }

  // Quick “latest” preview (recent 5)
  console.log('\nLatest (preview):');
  for (const r of rows.slice(0, 5)) {
    const d = r.date.toISOString().split('T')[0];
    console.log(`- ${d} [${r.locale}] ${r.slug} | ${r.series} | ${r.sourceKind} | ${r.domain || '(none)'}`);
  }
  console.log('');
}

main();

