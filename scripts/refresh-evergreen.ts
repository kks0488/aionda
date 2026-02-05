/**
 * Evergreen refresh helper (manual review workflow)
 *
 * Goal:
 * - Build a safe "freshness loop" without pretending to auto-update facts.
 * - List evergreen candidates that are old/stale.
 * - After you manually review/adjust content, stamp `lastReviewedAt` so the UI/SEO reflects freshness.
 *
 * Usage:
 *   pnpm refresh-evergreen --list --older-than=120d --limit=20
 *   pnpm refresh-evergreen --set-reviewed --locale=ko --slug=some-post
 *   pnpm refresh-evergreen --set-reviewed --locale=en --slug=a,b,c --date=2026-02-04
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

const POSTS_DIR = join(process.cwd(), 'apps', 'web', 'content', 'posts');

type Locale = 'ko' | 'en';

function parseArgs(argv: string[]) {
  const get = (name: string) => argv.find((a) => a.startsWith(`${name}=`))?.split('=')[1] ?? '';
  const has = (flag: string) => argv.includes(flag);

  const localeRaw = (get('--locale') || '').trim().toLowerCase();
  const locale = (localeRaw === 'en' || localeRaw === 'ko' ? (localeRaw as Locale) : undefined);

  const slugsRaw = (get('--slug') || '').trim();
  const slugs = slugsRaw
    ? slugsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  const date = (get('--date') || '').trim();
  const olderThan = (get('--older-than') || '120d').trim().toLowerCase();
  const limit = Number.parseInt(get('--limit') || '20', 10);

  return {
    list: has('--list'),
    setReviewed: has('--set-reviewed'),
    locale,
    slugs,
    date,
    olderThan,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
  };
}

function parseRelative(value: string): number {
  const m = value.match(/^(\d+)\s*(d|h)$/);
  if (!m) return 120 * 24 * 60 * 60 * 1000;
  const amount = Number(m[1]);
  const unit = m[2];
  if (!Number.isFinite(amount) || amount <= 0) return 120 * 24 * 60 * 60 * 1000;
  return unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
}

function toMs(value: unknown): number {
  const t = new Date(String(value || '')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isEvergreen(data: Record<string, unknown>): boolean {
  const sourceId = String(data.sourceId || '').trim();
  if (sourceId.startsWith('evergreen-')) return true;
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : [];
  return tags.some((t) => ['explainer', 'deep-dive'].includes(String(t || '').trim().toLowerCase()));
}

function findPostFile(locale: Locale, slug: string): string | null {
  const dir = join(POSTS_DIR, locale);
  const candidates = [
    join(dir, `${slug}.mdx`),
    join(dir, `${slug}.md`),
  ];
  for (const file of candidates) {
    if (existsSync(file)) return file;
  }
  return null;
}

function formatYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!existsSync(POSTS_DIR)) {
    console.error(`Posts dir not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  if (!args.list && !args.setReviewed) {
    console.log('Specify one: --list or --set-reviewed');
    process.exit(1);
  }

  if (args.list) {
    const locales: Locale[] = args.locale ? [args.locale] : ['ko', 'en'];
    const thresholdMs = parseRelative(args.olderThan);
    const now = Date.now();

    const all: Array<{
      locale: Locale;
      slug: string;
      title: string;
      date: string;
      lastReviewedAt: string;
      ageDays: number;
      tags: string[];
    }> = [];

    for (const locale of locales) {
      const dir = join(POSTS_DIR, locale);
      if (!existsSync(dir)) continue;
      for (const file of readdirSync(dir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))) {
        const slug = file.replace(/\.mdx?$/, '');
        const raw = readFileSync(join(dir, file), 'utf8');
        const { data } = matter(raw);
        if (!isEvergreen(data as Record<string, unknown>)) continue;
        const title = String((data as any).title || slug);
        const date = String((data as any).date || '');
        const lastReviewedAt = String((data as any).lastReviewedAt || '');
        const freshness = lastReviewedAt || date;
        const freshnessMs = toMs(freshness);
        const ageMs = freshnessMs ? now - freshnessMs : 0;
        if (ageMs < thresholdMs) continue;
        const ageDays = freshnessMs ? Math.floor(ageMs / (1000 * 60 * 60 * 24)) : 0;
        const tags = Array.isArray((data as any).tags) ? (data as any).tags.map(String) : [];
        all.push({ locale, slug, title, date, lastReviewedAt, ageDays, tags });
      }
    }

    all.sort((a, b) => b.ageDays - a.ageDays);
    const selected = all.slice(0, args.limit);

    if (selected.length === 0) {
      console.log('✅ No evergreen candidates found for refresh.');
      return;
    }

    console.log(`\n🧠 Evergreen refresh candidates (older-than=${args.olderThan}, limit=${args.limit})`);
    console.log('—'.repeat(72));
    for (const item of selected) {
      const freshness = item.lastReviewedAt || item.date || 'unknown';
      const tagLabel = item.tags.slice(0, 6).join(', ');
      console.log(`[${item.locale}] ${item.slug}  (${item.ageDays}d)  freshness=${freshness}`);
      console.log(`  - ${item.title}`);
      if (tagLabel) console.log(`  - tags: ${tagLabel}`);
    }
    console.log('');
    return;
  }

  // set-reviewed
  const locale = args.locale;
  if (!locale) {
    console.error('Missing --locale=ko|en for --set-reviewed');
    process.exit(1);
  }
  if (args.slugs.length === 0) {
    console.error('Missing --slug=...');
    process.exit(1);
  }

  const date = args.date ? new Date(args.date) : new Date();
  const ymd = formatYmd(date);

  for (const slug of args.slugs) {
    const file = findPostFile(locale, slug);
    if (!file) {
      console.warn(`⚠️ Not found: [${locale}] ${slug}`);
      continue;
    }

    const raw = readFileSync(file, 'utf8');
    const parsed = matter(raw);
    const nextData = { ...(parsed.data as Record<string, unknown>), lastReviewedAt: ymd };
    const updated = matter.stringify(parsed.content, nextData);
    writeFileSync(file, updated, 'utf8');
    console.log(`✅ Updated lastReviewedAt: [${locale}] ${slug} -> ${ymd}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

