/**
 * Series audit for published posts (deterministic).
 *
 * Answers:
 * - How many posts exist per editorial series?
 * - Are KO/EN pairs consistent?
 *
 * Usage:
 *   pnpm -s tsx scripts/series-audit.ts
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

type Series = 'k-ai-pulse' | 'explainer' | 'deep-dive';

const SERIES_TAGS: Series[] = ['k-ai-pulse', 'explainer', 'deep-dive'];

type PostMeta = {
  file: string;
  slug: string;
  locale: 'ko' | 'en' | 'unknown';
  date: string;
  series: Series | null;
  seriesCount: number;
};

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!full.endsWith('.mdx') && !full.endsWith('.md')) continue;
    out.push(full);
  }
  return out;
}

function normalizeTags(raw: unknown): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
}

function safeParsePost(filePath: string, repoRoot: string): PostMeta | null {
  const rel = path.relative(repoRoot, filePath);
  const locale: PostMeta['locale'] = rel.includes(`${path.sep}ko${path.sep}`)
    ? 'ko'
    : rel.includes(`${path.sep}en${path.sep}`)
      ? 'en'
      : 'unknown';

  const baseSlug = path.basename(filePath).replace(/\.mdx?$/, '');

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const data = (parsed.data || {}) as Record<string, unknown>;
    const slug = typeof data.slug === 'string' && data.slug.trim() ? data.slug.trim() : baseSlug;
    const date = typeof data.date === 'string' ? data.date : '';
    const tags = normalizeTags(data.tags);
    const seriesTags = tags.filter((t) => SERIES_TAGS.includes(t as Series));
    const series = seriesTags.length === 1 ? (seriesTags[0] as Series) : null;

    return {
      file: rel,
      slug,
      locale,
      date,
      series,
      seriesCount: seriesTags.length,
    };
  } catch {
    return null;
  }
}

function parseDate(value: string): number {
  if (!value) return 0;
  const parsed = new Date(value);
  const t = parsed.getTime();
  return Number.isNaN(t) ? 0 : t;
}

function main() {
  const repoRoot = process.cwd();
  const postsRoot = path.join(repoRoot, 'apps', 'web', 'content', 'posts');

  const files = walk(postsRoot);
  const posts = files
    .map((f) => safeParsePost(f, repoRoot))
    .filter((p): p is PostMeta => p !== null);

  const bySeriesFiles: Record<string, number> = { 'k-ai-pulse': 0, explainer: 0, 'deep-dive': 0, none: 0, multi: 0 };
  for (const p of posts) {
    if (p.series) bySeriesFiles[p.series] += 1;
    else if (p.seriesCount > 1) bySeriesFiles.multi += 1;
    else bySeriesFiles.none += 1;
  }

  // Group by slug across locales
  const bySlug = new Map<string, PostMeta[]>();
  for (const p of posts) {
    const arr = bySlug.get(p.slug) || [];
    arr.push(p);
    bySlug.set(p.slug, arr);
  }

  const bySeriesSlugs: Record<string, number> = { 'k-ai-pulse': 0, explainer: 0, 'deep-dive': 0, unknown: 0 };
  const examplesBySeries: Record<string, Array<{ slug: string; date: number }>> = {
    'k-ai-pulse': [],
    explainer: [],
    'deep-dive': [],
  };
  const mismatch: Array<{ slug: string; ko?: Series | null; en?: Series | null; files: string[] }> = [];
  const missing: Array<{ slug: string; locale: string; file: string }> = [];

  for (const [slug, entries] of bySlug.entries()) {
    const ko = entries.find((e) => e.locale === 'ko');
    const en = entries.find((e) => e.locale === 'en');

    const koSeries = ko?.series ?? null;
    const enSeries = en?.series ?? null;

    if (ko && !koSeries) missing.push({ slug, locale: 'ko', file: ko.file });
    if (en && !enSeries) missing.push({ slug, locale: 'en', file: en.file });

    if (koSeries && enSeries && koSeries !== enSeries) {
      mismatch.push({ slug, ko: koSeries, en: enSeries, files: entries.map((e) => e.file) });
      bySeriesSlugs.unknown += 1;
      continue;
    }

    const series = (koSeries || enSeries) as Series | null;
    if (!series) bySeriesSlugs.unknown += 1;
    else {
      bySeriesSlugs[series] += 1;
      const sampleEntry = entries.find((e) => e.locale === 'ko') || entries[0];
      examplesBySeries[series].push({ slug, date: parseDate(sampleEntry?.date || '') });
    }
  }

  console.log('\n' + '═'.repeat(68));
  console.log('Editorial Series Audit (published posts)');
  console.log('═'.repeat(68));
  console.log(`Files scanned: ${posts.length}`);
  console.log(`Unique slugs: ${bySlug.size}`);

  console.log('\nBy series (files):');
  console.log(`- k-ai-pulse: ${bySeriesFiles['k-ai-pulse']}`);
  console.log(`- explainer: ${bySeriesFiles.explainer}`);
  console.log(`- deep-dive: ${bySeriesFiles['deep-dive']}`);
  console.log(`- none: ${bySeriesFiles.none}`);
  console.log(`- multi: ${bySeriesFiles.multi}`);

  console.log('\nBy series (unique slugs):');
  console.log(`- k-ai-pulse: ${bySeriesSlugs['k-ai-pulse']}`);
  console.log(`- explainer: ${bySeriesSlugs.explainer}`);
  console.log(`- deep-dive: ${bySeriesSlugs['deep-dive']}`);
  console.log(`- unknown: ${bySeriesSlugs.unknown}`);

  console.log('\nExamples (unique slugs):');
  for (const key of ['k-ai-pulse', 'explainer', 'deep-dive'] as const) {
    const label = key === 'k-ai-pulse' ? 'K‑AI Pulse' : key === 'deep-dive' ? 'Deep Dive' : 'Explainer';
    const items = examplesBySeries[key]
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .slice(0, 8)
      .map((x) => x.slug);
    console.log(`- ${label}: ${items.length ? items.join(', ') : '(none)'}`);
  }

  if (mismatch.length > 0) {
    console.log('\nKO/EN mismatch (series differs):');
    for (const item of mismatch.slice(0, 20)) {
      console.log(`- ${item.slug}: ko=${item.ko} en=${item.en}`);
      for (const f of item.files) console.log(`  - ${f}`);
    }
    if (mismatch.length > 20) console.log(`- ... +${mismatch.length - 20} more`);
  }

  if (missing.length > 0) {
    console.log('\nMissing series tag:');
    for (const item of missing.slice(0, 20)) {
      console.log(`- ${item.slug} (${item.locale})  ${item.file}`);
    }
    if (missing.length > 20) console.log(`- ... +${missing.length - 20} more`);
  }

  console.log('');
}

main();
