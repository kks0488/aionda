/**
 * Deterministic “materials roundup” post generator (no AI).
 *
 * Goal:
 * - Publish the materials we already crawl (official/news RSS) as a daily curated roundup.
 * - Keep it lightweight, link-first, and safe for strict content gate (TL;DR + References).
 *
 * Usage:
 *   pnpm generate-roundup --since=24h --limit=12
 *   pnpm generate-roundup --since=48h --limit=20
 *
 * Writes:
 *   apps/web/content/posts/ko/<slug>.mdx
 *   apps/web/content/posts/en/<slug>.mdx
 * Updates:
 *   .vc/last-written.json (so verify/gate only targets the new files)
 */

import fs from 'fs';
import path from 'path';

type SourceType = 'official' | 'news';
type SourceTier = 'S' | 'A' | 'B' | 'C';

type FeedItem = {
  id?: string;
  sourceId?: string;
  sourceName?: string;
  sourceTier?: SourceTier;
  sourceType?: SourceType;
  title?: string;
  link?: string;
  pubDate?: string;
  fetchedAt?: string;
  categories?: string[];
};

const OFFICIAL_DIR = './data/official';
const NEWS_DIR = './data/news';
const POSTS_DIR = './apps/web/content/posts';
const VC_DIR = './.vc';
const LAST_WRITTEN_PATH = path.join(VC_DIR, 'last-written.json');

function tierIcon(tier?: SourceTier): string {
  switch (tier) {
    case 'S':
      return '🏛️';
    case 'A':
      return '🛡️';
    case 'B':
      return '⚠️';
    default:
      return '';
  }
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayYmdLocal(): string {
  return formatYmd(new Date());
}

function slugForDate(ymd: string): string {
  return `ai-resources-roundup-${ymd}`;
}

function parseSince(raw?: string): Date | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === 'all') return null;

  if (value === 'today') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }

  const m = value.match(/^(\d+)\s*(h|d)$/);
  if (m) {
    const amount = Number(m[1]);
    const unit = m[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const sinceArg = args.find((a) => a.startsWith('--since='));
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const sinceRaw = sinceArg ? sinceArg.split('=')[1] : undefined;
  const limitRaw = limitArg ? limitArg.split('=')[1] : undefined;

  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : NaN;
  const limit = Number.isFinite(limitParsed) && limitParsed > 0 ? limitParsed : 12;

  return { since: parseSince(sinceRaw || '24h'), limit };
}

function safeReadJson(filePath: string): FeedItem | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as FeedItem;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function listJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('._'))
    .map((f) => path.join(dir, f));
}

function itemTimeMs(item: FeedItem): number {
  const candidates = [item.pubDate, item.fetchedAt].filter(Boolean) as string[];
  for (const raw of candidates) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

function normalizeUrl(raw?: string): string {
  const url = String(raw || '').trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) return '';
  return url;
}

function normalizeTitle(raw?: string): string {
  return String(raw || '').replace(/\s+/g, ' ').trim();
}

function pickItems(items: FeedItem[], options: { since: Date | null; limit: number; maxPerSource: number }): FeedItem[] {
  const uniqueByUrl = new Set<string>();
  const perSource = new Map<string, number>();

  const filtered = items
    .filter((item) => normalizeUrl(item.link))
    .filter((item) => normalizeTitle(item.title))
    .filter((item) => {
      if (!options.since) return true;
      const ms = itemTimeMs(item);
      return ms > 0 && ms >= options.since.getTime();
    })
    .sort((a, b) => itemTimeMs(b) - itemTimeMs(a));

  const out: FeedItem[] = [];
  for (const item of filtered) {
    const url = normalizeUrl(item.link);
    if (!url || uniqueByUrl.has(url)) continue;
    const sourceKey = String(item.sourceId || item.sourceName || 'unknown').trim() || 'unknown';
    const count = perSource.get(sourceKey) || 0;
    if (count >= options.maxPerSource) continue;

    uniqueByUrl.add(url);
    perSource.set(sourceKey, count + 1);
    out.push(item);
    if (out.length >= options.limit) break;
  }

  return out;
}

function renderKo(itemsOfficial: FeedItem[], itemsNews: FeedItem[], ymd: string, sinceLabel: string): string {
  const title = `AI 자료 모음 (${sinceLabel}) - ${ymd}`;
  const slug = slugForDate(ymd);

  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: '${title.replace(/'/g, "''")}'`);
  lines.push(`slug: ${slug}`);
  lines.push(`date: '${ymd}'`);
  lines.push('locale: ko');
  lines.push(`description: '${'지난 수집 자료(공식/뉴스) 중 중요한 링크를 모아 정리했다.'.replace(/'/g, "''")}'`);
  lines.push('tags:');
  lines.push('  - k-ai-pulse');
  lines.push('  - resources');
  lines.push('  - roundup');
  lines.push('author: AI온다');
  lines.push(`alternateLocale: /en/posts/${slug}`);
  lines.push('---');
  lines.push('');
  lines.push('## 세 줄 요약');
  lines.push('- 지난 수집 자료 중 “공식/신뢰 출처” 중심으로 링크를 추렸다.');
  lines.push('- 실무/세일즈에 바로 쓸 수 있도록 제목 기반으로 빠르게 훑을 수 있게 구성했다.');
  lines.push('- 관심 항목은 본문 링크를 열어 원문을 확인하고, 필요한 부분만 따로 메모/요약해서 활용하자.');
  lines.push('');
  lines.push(`이번 글은 최근 ${sinceLabel} 동안 수집된 자료를 기반으로 한 **링크 아카이브**다. 본문은 “요약 기사”가 아니라, 빠르게 원문으로 들어가기 위한 정리본이다.`);
  lines.push('');

  if (itemsOfficial.length > 0) {
    lines.push('## Official (공식)');
    for (const item of itemsOfficial) {
      const url = normalizeUrl(item.link);
      const t = normalizeTitle(item.title);
      const icon = tierIcon(item.sourceTier);
      const source = String(item.sourceName || item.sourceId || '').trim();
      const suffix = source ? ` — ${source}` : '';
      lines.push(`- ${icon} [${t}](${url})${suffix}`);
    }
    lines.push('');
  }

  if (itemsNews.length > 0) {
    lines.push('## News (뉴스)');
    for (const item of itemsNews) {
      const url = normalizeUrl(item.link);
      const t = normalizeTitle(item.title);
      const icon = tierIcon(item.sourceTier);
      const source = String(item.sourceName || item.sourceId || '').trim();
      const suffix = source ? ` — ${source}` : '';
      lines.push(`- ${icon} [${t}](${url})${suffix}`);
    }
    lines.push('');
  }

  lines.push('## 오늘 바로 할 일:');
  lines.push('- 우리 제품/서비스에 연결될 키워드 3개를 뽑아 내부 메모(세일즈 포인트)로 저장');
  lines.push('- 관심 링크 1~2개를 깊게 읽고, 다음 글(심층 분석) 후보로 큐에 추가');
  lines.push('- “용어/숫자/정책”은 반드시 원문에서 1차 확인 후 인용');
  lines.push('');

  lines.push('## 참고 자료');
  const all = [...itemsOfficial, ...itemsNews];
  for (const item of all) {
    const url = normalizeUrl(item.link);
    if (!url) continue;
    const t = normalizeTitle(item.title) || url;
    const icon = tierIcon(item.sourceTier);
    lines.push(`- ${icon} [${t}](${url})`);
  }
  lines.push('');

  return lines.join('\n');
}

function renderEn(itemsOfficial: FeedItem[], itemsNews: FeedItem[], ymd: string, sinceLabel: string): string {
  const title = `AI Resource Roundup (${sinceLabel}) - ${ymd}`;
  const slug = slugForDate(ymd);

  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: '${title.replace(/'/g, "''")}'`);
  lines.push(`slug: ${slug}`);
  lines.push(`date: '${ymd}'`);
  lines.push('locale: en');
  lines.push(`description: '${'A curated link roundup from recently collected official updates and tech news.'.replace(/'/g, "''")}'`);
  lines.push('tags:');
  lines.push('  - k-ai-pulse');
  lines.push('  - resources');
  lines.push('  - roundup');
  lines.push('author: AI온다');
  lines.push(`alternateLocale: /ko/posts/${slug}`);
  lines.push('---');
  lines.push('');
  lines.push('## TL;DR');
  lines.push('- Curated links from recently collected materials (official sources first).');
  lines.push('- Optimized for fast scanning: open the source and take notes for your use-case.');
  lines.push('- Treat this as an index, not a substitute for reading the original.');
  lines.push('');
  lines.push(`This post is a link archive based on materials collected over the last ${sinceLabel}. It is meant to help you jump into primary sources quickly.`);
  lines.push('');

  if (itemsOfficial.length > 0) {
    lines.push('## Official Updates');
    for (const item of itemsOfficial) {
      const url = normalizeUrl(item.link);
      const t = normalizeTitle(item.title);
      const icon = tierIcon(item.sourceTier);
      const source = String(item.sourceName || item.sourceId || '').trim();
      const suffix = source ? ` — ${source}` : '';
      lines.push(`- ${icon} [${t}](${url})${suffix}`);
    }
    lines.push('');
  }

  if (itemsNews.length > 0) {
    lines.push('## Tech News');
    for (const item of itemsNews) {
      const url = normalizeUrl(item.link);
      const t = normalizeTitle(item.title);
      const icon = tierIcon(item.sourceTier);
      const source = String(item.sourceName || item.sourceId || '').trim();
      const suffix = source ? ` — ${source}` : '';
      lines.push(`- ${icon} [${t}](${url})${suffix}`);
    }
    lines.push('');
  }

  lines.push('## Checklist for Today:');
  lines.push('- Extract 3 keywords for internal notes (sales/research hooks)');
  lines.push('- Pick 1–2 links for deep reading and queue a follow-up “analysis” post');
  lines.push('- Verify any numbers/policy claims directly from the primary source before quoting');
  lines.push('');

  lines.push('## References');
  const all = [...itemsOfficial, ...itemsNews];
  for (const item of all) {
    const url = normalizeUrl(item.link);
    if (!url) continue;
    const t = normalizeTitle(item.title) || url;
    const icon = tierIcon(item.sourceTier);
    lines.push(`- ${icon} [${t}](${url})`);
  }
  lines.push('');

  return lines.join('\n');
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeLastWritten(payload: { writtenCount: number; files: string[]; entries: any[] }) {
  ensureDir(VC_DIR);
  const now = new Date().toISOString();
  fs.writeFileSync(
    LAST_WRITTEN_PATH,
    JSON.stringify(
      {
        generatedAt: now,
        writtenCount: payload.writtenCount,
        files: payload.files,
        entries: payload.entries,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${LAST_WRITTEN_PATH}`);
}

function main() {
  const { since, limit } = parseArgs();
  const sinceLabel = since ? `${Math.round((Date.now() - since.getTime()) / (60 * 60 * 1000))}h` : 'all';
  const ymd = todayYmdLocal();
  const slug = slugForDate(ymd);

  console.log('\n' + '═'.repeat(60));
  console.log('  Materials Roundup Generator');
  console.log(`  since=${since ? since.toISOString() : 'all'} | limit=${limit}`);
  console.log('═'.repeat(60) + '\n');

  const officialFiles = listJsonFiles(OFFICIAL_DIR);
  const newsFiles = listJsonFiles(NEWS_DIR);

  const officialItems = officialFiles.map(safeReadJson).filter((x): x is FeedItem => Boolean(x));
  const newsItems = newsFiles.map(safeReadJson).filter((x): x is FeedItem => Boolean(x));

  const half = Math.max(1, Math.floor(limit / 2));
  const officialPicked = pickItems(officialItems, { since, limit: half, maxPerSource: 3 });
  const newsPicked = pickItems(newsItems, { since, limit: limit - officialPicked.length, maxPerSource: 3 });

  const total = officialPicked.length + newsPicked.length;
  if (total === 0) {
    console.log('✅ No recent materials found. Skipping roundup generation.');
    writeLastWritten({ writtenCount: 0, files: [], entries: [] });
    return;
  }

  const koDir = path.join(POSTS_DIR, 'ko');
  const enDir = path.join(POSTS_DIR, 'en');
  ensureDir(koDir);
  ensureDir(enDir);

  const koPath = path.join(koDir, `${slug}.mdx`);
  const enPath = path.join(enDir, `${slug}.mdx`);

  fs.writeFileSync(koPath, `${renderKo(officialPicked, newsPicked, ymd, sinceLabel)}\n`);
  fs.writeFileSync(enPath, `${renderEn(officialPicked, newsPicked, ymd, sinceLabel)}\n`);

  console.log(`✅ Wrote roundup post: ${slug} (official=${officialPicked.length}, news=${newsPicked.length})`);

  const entry = {
    topicId: `roundup-${ymd.replace(/-/g, '')}`,
    sourceId: '',
    slug,
    files: [koPath, enPath],
    writtenAt: new Date().toISOString(),
  };
  writeLastWritten({ writtenCount: 1, files: [koPath, enPath], entries: [entry] });
}

main();

