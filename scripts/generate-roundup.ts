/**
 * Materials roundup post generator.
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
import { config } from 'dotenv';
import { generateContent } from './lib/ai-text';

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
  contentSnippet?: string;
  content?: string;
};

const OFFICIAL_DIR = './data/official';
const NEWS_DIR = './data/news';
const POSTS_DIR = './apps/web/content/posts';
const VC_DIR = './.vc';
const LAST_WRITTEN_PATH = path.join(VC_DIR, 'last-written.json');
const MIN_LINKS_TO_PUBLISH = 8;
const AI_TECH_KEYWORD_PATTERNS: RegExp[] = [
  /\bai\b/i,
  /\bmachine learning\b/i,
  /\bllm\b/i,
  /\bmodels?\b/i,
  /\bneural\b/i,
  /\bgpu\b/i,
  /\binference\b/i,
  /\btraining\b/i,
  /\bagent(?:ic)?s?\b/i,
  /\bautomation\b/i,
  /\brobotics?\b/i,
  /\bquantum\b/i,
  /\bdeep learning\b/i,
  /\btransformers?\b/i,
  /\bdiffusion\b/i,
  /\bfine[-\s]?tuning\b/i,
  /\brag\b/i,
  /\bembeddings?\b/i,
  /\bvectors?\b/i,
  /\bchatbots?\b/i,
  /\bcopilot\b/i,
  /\bgemini\b/i,
  /\bclaude\b/i,
  /\bgpt\b/i,
  /\bopenai\b/i,
  /\banthropic\b/i,
  /\bnvidia\b/i,
  /\bmeta\s*ai\b/i,
];

type LocaleRoundupInsights = {
  tldr: string[];
  actions: string[];
  comments: Record<string, string>;
};

type RoundupInsights = {
  ko: LocaleRoundupInsights;
  en: LocaleRoundupInsights;
};

config({ path: '.env.local' });

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
  const since = parseSince(sinceArg ? sinceRaw : '24h');
  if (sinceArg && since === null && sinceRaw?.trim().toLowerCase() !== 'all') {
    console.error(`❌ Invalid --since value: "${sinceRaw}". Examples: today, 24h, 7d, 2026-02-12, all`);
    process.exit(1);
  }

  return { since, limit };
}

function safeReadJson(filePath: string): FeedItem | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as FeedItem;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn(`⚠️ Skipping corrupted JSON file: ${filePath}`, error);
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

function normalizeOneLine(raw: string): string {
  return String(raw || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\-\*\d.\s]+/, '')
    .trim();
}

function aiKeywordText(item: FeedItem): string {
  return [
    normalizeTitle(item.title),
    String(item.sourceName || ''),
    String(item.sourceId || ''),
    Array.isArray(item.categories) ? item.categories.join(' ') : '',
    String(item.contentSnippet || ''),
    String(item.content || ''),
  ]
    .join(' ')
    .toLowerCase();
}

function isAiTechRelevant(item: FeedItem): boolean {
  const haystack = aiKeywordText(item);
  if (!haystack) return false;
  return AI_TECH_KEYWORD_PATTERNS.some((pattern) => pattern.test(haystack));
}

function fallbackComment(item: FeedItem, locale: 'ko' | 'en'): string {
  const title = normalizeTitle(item.title).toLowerCase();
  if (locale === 'ko') {
    if (/(benchmark|latency|throughput|performance|inference|training)/i.test(title)) {
      return '성능/비용 판단에 바로 쓸 수 있는 기준점을 제공한다.';
    }
    if (/(release|launch|preview|update|announce|roadmap)/i.test(title)) {
      return '로드맵과 제품 방향 변화 신호를 빠르게 파악할 수 있다.';
    }
    if (/(security|safety|policy|regulation|compliance)/i.test(title)) {
      return '도입 시 리스크와 정책 대응 포인트를 점검하는 데 유용하다.';
    }
    return '실무 의사결정에 참고할 핵심 변화와 맥락을 확인할 수 있다.';
  }

  if (/(benchmark|latency|throughput|performance|inference|training)/i.test(title)) {
    return 'Useful for concrete performance and cost decisions.';
  }
  if (/(release|launch|preview|update|announce|roadmap)/i.test(title)) {
    return 'Shows near-term product direction and roadmap signals.';
  }
  if (/(security|safety|policy|regulation|compliance)/i.test(title)) {
    return 'Helps assess rollout risks and policy/compliance impact.';
  }
  return 'Provides practical context for current product and strategy decisions.';
}

function fallbackInsights(items: FeedItem[], ymd: string, sinceLabel: string): RoundupInsights {
  const urls = items.map((item) => normalizeUrl(item.link)).filter(Boolean);
  const sourceSet = new Set(
    items
      .map((item) => String(item.sourceName || item.sourceId || '').trim())
      .filter(Boolean)
  );
  const topSource = Array.from(sourceSet).slice(0, 2).join(', ') || '주요 소스';

  const koComments: Record<string, string> = {};
  const enComments: Record<string, string> = {};
  for (const item of items) {
    const url = normalizeUrl(item.link);
    if (!url) continue;
    koComments[url] = fallbackComment(item, 'ko');
    enComments[url] = fallbackComment(item, 'en');
  }

  return {
    ko: {
      tldr: [
        `${ymd} 기준 최근 ${sinceLabel} 자료에서 AI/기술 링크 ${urls.length}개를 선별했다.`,
        `공식 업데이트와 기술 뉴스를 함께 묶어 제품/시장 변화를 한 번에 파악할 수 있게 정리했다.`,
        `${topSource}를 포함한 핵심 소스 중심으로 후속 분석 후보를 빠르게 고를 수 있다.`,
      ],
      actions: [
        '오늘 링크 중 우리 서비스와 직접 연결되는 항목 2개를 골라 팀 공유 메모로 남긴다.',
        '벤치마크/정책 수치가 나온 링크 1개를 선정해 원문 근거를 캡처해 둔다.',
        '내일 심층 분석할 주제 1개를 선택하고 근거 링크 2개를 함께 큐에 등록한다.',
      ],
      comments: koComments,
    },
    en: {
      tldr: [
        `As of ${ymd}, this roundup selects ${urls.length} AI/tech links from the last ${sinceLabel}.`,
        'Official updates and tech-news signals are combined so you can scan product and market shifts quickly.',
        `The set is source-prioritized (${topSource}) to help pick strong follow-up analysis topics.`,
      ],
      actions: [
        'Pick 2 links that directly affect your roadmap and post a short team note today.',
        'Choose 1 link with metrics/policy details and capture exact primary-source evidence.',
        'Queue 1 deep-dive topic for tomorrow with at least 2 supporting links from this batch.',
      ],
      comments: enComments,
    },
  };
}

function parseInsightsResponse(
  response: string,
  fallback: RoundupInsights,
  urls: string[]
): RoundupInsights {
  const jsonMatch = String(response || '').match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as any;
    const normalizeLocale = (locale: 'ko' | 'en'): LocaleRoundupInsights => {
      const source = parsed?.[locale] || {};
      const fallbackLocale = fallback[locale];
      const tldr = Array.isArray(source?.tldr)
        ? source.tldr.map((x: unknown) => normalizeOneLine(String(x || ''))).filter(Boolean).slice(0, 3)
        : [];
      const actions = Array.isArray(source?.actions)
        ? source.actions.map((x: unknown) => normalizeOneLine(String(x || ''))).filter(Boolean).slice(0, 3)
        : [];
      const commentsRaw = source?.comments && typeof source.comments === 'object' ? source.comments : {};
      const comments: Record<string, string> = {};
      for (const url of urls) {
        const v = normalizeOneLine(String(commentsRaw[url] || ''));
        comments[url] = v || fallbackLocale.comments[url] || '';
      }
      return {
        tldr: tldr.length === 3 ? tldr : fallbackLocale.tldr,
        actions: actions.length === 3 ? actions : fallbackLocale.actions,
        comments,
      };
    };

    return {
      ko: normalizeLocale('ko'),
      en: normalizeLocale('en'),
    };
  } catch {
    return fallback;
  }
}

async function generateRoundupInsights(
  itemsOfficial: FeedItem[],
  itemsNews: FeedItem[],
  ymd: string,
  sinceLabel: string
): Promise<RoundupInsights> {
  const all = [...itemsOfficial, ...itemsNews];
  const fallback = fallbackInsights(all, ymd, sinceLabel);
  if (all.length === 0) return fallback;

  const links = all
    .map((item) => ({
      url: normalizeUrl(item.link),
      title: normalizeTitle(item.title),
      source: String(item.sourceName || item.sourceId || '').trim(),
      tier: String(item.sourceTier || ''),
      type: String(item.sourceType || ''),
    }))
    .filter((item) => item.url && item.title);

  const linkLines = links
    .map((item, idx) => `${idx + 1}. [${item.type}/${item.tier}] ${item.title} | ${item.source} | ${item.url}`)
    .join('\n');

  const prompt = [
    '<task>Generate daily AI roundup copy from provided links only.</task>',
    `<date>${ymd}</date>`,
    `<window>${sinceLabel}</window>`,
    '<rules>',
    '- Use ONLY given title/source/url signals. Do not invent facts, numbers, releases, or policies.',
    '- Keep each bullet/action/comment to one concise sentence.',
    '- Return valid JSON only.',
    '- For each URL, include one comment explaining why it is worth reading.',
    '</rules>',
    '<output_schema>',
    '{',
    '  "ko": {"tldr": ["", "", ""], "actions": ["", "", ""], "comments": {"<url>": ""}},',
    '  "en": {"tldr": ["", "", ""], "actions": ["", "", ""], "comments": {"<url>": ""}}',
    '}',
    '</output_schema>',
    '<links>',
    linkLines,
    '</links>',
  ].join('\n');

  try {
    const response = await generateContent(prompt);
    return parseInsightsResponse(response, fallback, links.map((l) => l.url));
  } catch (error: any) {
    console.log(`⚠️ AI roundup synthesis failed. Falling back to deterministic copy. (${error?.message || 'unknown error'})`);
    return fallback;
  }
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

function dedupePickedByUrl(items: Array<{ source: SourceType; item: FeedItem }>): Array<{ source: SourceType; item: FeedItem }> {
  const seen = new Set<string>();
  const deduped: Array<{ source: SourceType; item: FeedItem }> = [];
  for (const entry of items) {
    const url = normalizeUrl(entry.item.link);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    deduped.push(entry);
  }
  return deduped;
}

function renderKo(
  itemsOfficial: FeedItem[],
  itemsNews: FeedItem[],
  ymd: string,
  sinceLabel: string,
  insights: LocaleRoundupInsights
): string {
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
  for (const bullet of insights.tldr) {
    lines.push(`- ${bullet}`);
  }
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
      lines.push(`  - 왜 읽어야 하는가: ${insights.comments[url] || fallbackComment(item, 'ko')}`);
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
      lines.push(`  - 왜 읽어야 하는가: ${insights.comments[url] || fallbackComment(item, 'ko')}`);
    }
    lines.push('');
  }

  lines.push('## 실전 적용');
  lines.push('**오늘 바로 할 일:**');
  for (const action of insights.actions) {
    lines.push(`- ${action}`);
  }
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

function renderEn(
  itemsOfficial: FeedItem[],
  itemsNews: FeedItem[],
  ymd: string,
  sinceLabel: string,
  insights: LocaleRoundupInsights
): string {
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
  for (const bullet of insights.tldr) {
    lines.push(`- ${bullet}`);
  }
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
      lines.push(`  - Why it matters: ${insights.comments[url] || fallbackComment(item, 'en')}`);
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
      lines.push(`  - Why it matters: ${insights.comments[url] || fallbackComment(item, 'en')}`);
    }
    lines.push('');
  }

  lines.push('## Practical Application');
  lines.push('**Checklist for Today:**');
  for (const action of insights.actions) {
    lines.push(`- ${action}`);
  }
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

function renderJa(itemsOfficial: FeedItem[], itemsNews: FeedItem[], ymd: string, sinceLabel: string): string {
  const title = `AI リソースまとめ (${sinceLabel}) - ${ymd}`;
  const slug = slugForDate(ymd);

  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: '${title.replace(/'/g, "''")}'`);
  lines.push(`slug: ${slug}`);
  lines.push(`date: '${ymd}'`);
  lines.push('locale: ja');
  lines.push(`description: '${'最近収集した公式アップデートと技術ニュースのリンクをまとめた。'.replace(/'/g, "''")}'`);
  lines.push('tags:');
  lines.push('  - k-ai-pulse');
  lines.push('  - resources');
  lines.push('  - roundup');
  lines.push('author: AI온다');
  lines.push(`alternateLocale: /en/posts/${slug}`);
  lines.push('---');
  lines.push('');
  lines.push('## TL;DR');
  lines.push('- 最近収集した資料から、公式/信頼できる出典を優先してリンクを整理。');
  lines.push('- まずはタイトルでスキャンし、必要なものだけ原文に当たる。');
  lines.push('- これは要約記事ではなく、一次情報へ素早く飛ぶための索引。');
  lines.push('');
  lines.push(`この投稿は直近 ${sinceLabel} の収集データを元にしたリンクアーカイブです。気になる項目は必ず原文を確認してください。`);
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
  lines.push('- 社内メモ用にキーワードを3つ抽出（セールス/調査のフック）');
  lines.push('- 1〜2件を深掘りして、次の分析記事候補としてキューに追加');
  lines.push('- 数字/ポリシーは必ず一次情報で確認してから引用');
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

function renderEs(itemsOfficial: FeedItem[], itemsNews: FeedItem[], ymd: string, sinceLabel: string): string {
  const title = `Resumen de recursos de IA (${sinceLabel}) - ${ymd}`;
  const slug = slugForDate(ymd);

  const lines: string[] = [];
  lines.push('---');
  lines.push(`title: '${title.replace(/'/g, "''")}'`);
  lines.push(`slug: ${slug}`);
  lines.push(`date: '${ymd}'`);
  lines.push('locale: es');
  lines.push(`description: '${'Un índice de enlaces con actualizaciones oficiales y noticias técnicas recopiladas recientemente.'.replace(/'/g, "''")}'`);
  lines.push('tags:');
  lines.push('  - k-ai-pulse');
  lines.push('  - resources');
  lines.push('  - roundup');
  lines.push('author: AI온다');
  lines.push(`alternateLocale: /en/posts/${slug}`);
  lines.push('---');
  lines.push('');
  lines.push('## TL;DR');
  lines.push('- Enlaces seleccionados de materiales recientes (priorizando fuentes oficiales).');
  lines.push('- Diseñado para escanear rápido: abre la fuente y toma notas para tu caso de uso.');
  lines.push('- Es un índice, no un reemplazo de la lectura del original.');
  lines.push('');
  lines.push(`Este post es un archivo de enlaces basado en materiales recopilados en las últimas ${sinceLabel}. Úsalo para llegar rápido a las fuentes primarias.`);
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
  lines.push('- Extrae 3 palabras clave para notas internas (ventas/investigación)');
  lines.push('- Elige 1–2 enlaces para lectura profunda y cola un post de análisis');
  lines.push('- Verifica cifras/políticas directamente en la fuente antes de citar');
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

async function main() {
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
  const officialRelevant = officialItems.filter(isAiTechRelevant);
  const newsRelevant = newsItems.filter(isAiTechRelevant);
  const filteredOut = officialItems.length + newsItems.length - (officialRelevant.length + newsRelevant.length);

  console.log(
    `🧹 AI/Tech keyword filter: kept ${officialRelevant.length + newsRelevant.length} / ${officialItems.length + newsItems.length} (excluded ${filteredOut})`
  );

  const half = Math.max(1, Math.floor(limit / 2));
  let officialPicked = pickItems(officialRelevant, { since, limit: half, maxPerSource: 3 });
  let newsPicked = pickItems(newsRelevant, { since, limit: half, maxPerSource: 3 });
  const remaining = limit - officialPicked.length - newsPicked.length;
  if (remaining > 0) {
    if (officialPicked.length < half) {
      newsPicked = pickItems(newsRelevant, { since, limit: half + remaining, maxPerSource: 4 });
    } else {
      officialPicked = pickItems(officialRelevant, { since, limit: half + remaining, maxPerSource: 4 });
    }
  }
  const globallyDeduped = dedupePickedByUrl([
    ...officialPicked.map((item) => ({ source: 'official' as SourceType, item })),
    ...newsPicked.map((item) => ({ source: 'news' as SourceType, item })),
  ]);
  const officialPickedFinal = globallyDeduped.filter((entry) => entry.source === 'official').map((entry) => entry.item);
  const newsPickedFinal = globallyDeduped.filter((entry) => entry.source === 'news').map((entry) => entry.item);

  const total = officialPickedFinal.length + newsPickedFinal.length;
  if (total === 0) {
    console.log('✅ No recent materials found. Skipping roundup generation.');
    writeLastWritten({ writtenCount: 0, files: [], entries: [] });
    return;
  }
  if (total < MIN_LINKS_TO_PUBLISH) {
    console.log(
      `⚠️ Roundup publish skipped: picked ${total} link(s), below minimum ${MIN_LINKS_TO_PUBLISH}. Increase window or wait for more items.`
    );
    writeLastWritten({ writtenCount: 0, files: [], entries: [] });
    return;
  }

  const insights = await generateRoundupInsights(officialPickedFinal, newsPickedFinal, ymd, sinceLabel);

  const koDir = path.join(POSTS_DIR, 'ko');
  const enDir = path.join(POSTS_DIR, 'en');
  ensureDir(koDir);
  ensureDir(enDir);

  const koPath = path.join(koDir, `${slug}.mdx`);
  const enPath = path.join(enDir, `${slug}.mdx`);

  fs.writeFileSync(koPath, `${renderKo(officialPickedFinal, newsPickedFinal, ymd, sinceLabel, insights.ko)}\n`);
  fs.writeFileSync(enPath, `${renderEn(officialPickedFinal, newsPickedFinal, ymd, sinceLabel, insights.en)}\n`);

  console.log(`✅ Wrote roundup post: ${slug} (official=${officialPickedFinal.length}, news=${newsPickedFinal.length})`);

  const entry = {
    topicId: `roundup-${ymd.replace(/-/g, '')}`,
    sourceId: '',
    slug,
    files: [koPath, enPath],
    writtenAt: new Date().toISOString(),
  };
  writeLastWritten({ writtenCount: 1, files: [koPath, enPath], entries: [entry] });
}

main().catch((error) => {
  console.error(`❌ Roundup generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
