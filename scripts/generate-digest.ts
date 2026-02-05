/**
 * Weekly digest generator (no AI required)
 *
 * Why:
 * - High ROI distribution channel for 1-person ops.
 * - Generates a ready-to-send Markdown draft from the latest posts.
 *
 * Usage:
 *   pnpm generate-digest --days=7 --limit=7
 *   pnpm generate-digest --locale=ko --days=7 --limit=10
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

type Locale = 'ko' | 'en';

const POSTS_DIR = join(process.cwd(), 'apps', 'web', 'content', 'posts');
const OUT_DIR = join(process.cwd(), 'data', 'digests');
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.aionda.blog').replace(/\/$/, '');

function parseArgs(argv: string[]) {
  const get = (name: string) => argv.find((a) => a.startsWith(`${name}=`))?.split('=')[1] ?? '';

  const days = Number.parseInt(get('--days') || '7', 10);
  const limit = Number.parseInt(get('--limit') || '7', 10);
  const localeRaw = (get('--locale') || '').trim().toLowerCase();
  const locale = localeRaw === 'ko' || localeRaw === 'en' ? (localeRaw as Locale) : null;

  return {
    days: Number.isFinite(days) && days > 0 ? days : 7,
    limit: Number.isFinite(limit) && limit > 0 ? limit : 7,
    locale,
  };
}

function toMs(value: unknown): number {
  const t = new Date(String(value || '')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function clip(text: string, max = 180): string {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function buildDigest(locale: Locale, posts: Array<{ slug: string; title: string; description: string; date: string; tags: string[] }>, days: number, limit: number) {
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const recent = posts
    .filter((p) => {
      const t = toMs(p.date);
      return t >= sinceMs;
    })
    .sort((a, b) => toMs(b.date) - toMs(a.date))
    .slice(0, limit);

  const title = locale === 'ko'
    ? `AI온다 주간 요약 — ${days}일`
    : `Aionda Weekly Digest — ${days} days`;

  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## TL;DR');
  lines.push('');

  if (recent.length === 0) {
    lines.push(locale === 'ko' ? '- 이번 주에는 발행된 글이 없습니다.' : '- No posts published in this window.');
  } else {
    for (const post of recent.slice(0, 3)) {
      lines.push(`- ${post.title}`);
    }
  }

  lines.push('');
  lines.push('## Top posts');
  lines.push('');

  for (const post of recent) {
    const url = `${SITE_URL}/${locale}/posts/${post.slug}`;
    const tagLine = post.tags?.length ? ` (${post.tags.slice(0, 4).join(', ')})` : '';
    lines.push(`- [${post.title}](${url})${tagLine} — ${clip(post.description, 160)}`);
  }

  lines.push('');
  lines.push('## Notes');
  lines.push('');
  lines.push(locale === 'ko'
    ? '- (운영자 노트) 이번 주의 핵심 변화/의미를 한 문단으로 추가하세요.'
    : '- (Editor note) Add one paragraph on the key shifts and why they matter.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(locale === 'ko'
    ? `구독: ${SITE_URL}/${locale}/feed.xml`
    : `Subscribe: ${SITE_URL}/${locale}/feed.xml`);
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const locales: Locale[] = args.locale ? [args.locale] : ['ko', 'en'];

  if (!existsSync(POSTS_DIR)) {
    console.error(`Posts dir not found: ${POSTS_DIR}`);
    process.exit(1);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  for (const locale of locales) {
    const dir = join(POSTS_DIR, locale);
    if (!existsSync(dir)) continue;

    const posts = readdirSync(dir)
      .filter((f) => (f.endsWith('.mdx') || f.endsWith('.md')) && !f.startsWith('._'))
      .map((file) => {
        const slug = file.replace(/\.mdx?$/, '');
        const raw = readFileSync(join(dir, file), 'utf8');
        const { data } = matter(raw);
        return {
          slug,
          title: String((data as any).title || slug),
          description: String((data as any).description || (data as any).excerpt || ''),
          date: String((data as any).date || ''),
          tags: Array.isArray((data as any).tags) ? (data as any).tags.map(String) : [],
        };
      });

    const digest = buildDigest(locale, posts, args.days, args.limit);
    const out = join(OUT_DIR, `${formatYmd(new Date())}-${locale}.md`);
    writeFileSync(out, digest, 'utf8');
    console.log(`✅ Wrote ${out}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

