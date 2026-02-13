/**
 * Write articles based on researched topics
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { generateContent, translateToEnglish } from './lib/ai-text';
import { selectEditorialSeries, formatSeriesForPrompt, type EditorialSeries } from './lib/editorial-series.js';
import { WRITE_ARTICLE_PROMPT, GENERATE_METADATA_PROMPT } from './prompts/topics';
import { checkBeforePublish, saveAfterPublish } from './lib/memu-client';
import { classifySource, createVerifiedSource, SourceTier } from './lib/search-mode.js';
import { canonicalizeTags } from './lib/tags.js';
import { extractJsonObject } from './lib/json-extract.js';
import matter from 'gray-matter';

config({ path: '.env.local' });

const RESEARCHED_DIR = './data/researched';
const PUBLISHED_DIR = './data/published';
const POSTS_DIR = './apps/web/content/posts';
const VC_DIR = './.vc';
const LAST_WRITTEN_PATH = join(VC_DIR, 'last-written.json');
const LAST_EXTRACTED_TOPICS_PATH = join(VC_DIR, 'last-extracted-topics.json');
const MIN_CONFIDENCE = 0.6;
const CORE_TAGS = ['agi', 'llm', 'robotics', 'hardware'] as const;
const SERIES_TAGS = ['k-ai-pulse', 'explainer', 'deep-dive'] as const;
type EvergreenIntent = 'informational' | 'commercial' | 'troubleshooting';
type EvergreenSchema = 'howto' | 'faq';
type Locale = 'ko' | 'en';
const CORE_TAG_PATTERNS: Array<{ tag: (typeof CORE_TAGS)[number]; regex: RegExp }> = [
  { tag: 'agi', regex: /agi|artificial general intelligence|superintelligence|초지능|범용.*인공지능/i },
  { tag: 'robotics', regex: /robot|로봇|humanoid|휴머노이드|boston dynamics|figure|drone|드론|자율주행/i },
  { tag: 'hardware', regex: /hardware|하드웨어|gpu|tpu|nvidia|chip|반도체|칩|blackwell|h100|b200|rubin|cuda|hbm/i },
  { tag: 'llm', regex: /llm|language model|언어.*모델|대형언어|transformer|트랜스포머|gpt|chatgpt|claude|gemini|llama/i },
];

function stripHtml(value: string): string {
  return String(value || '').replace(/<[^>]*>/g, '');
}

function normalizeTopicId(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function decodeHtmlEntities(value: string): string {
  return String(value || '')
    .replace(/&#8230;/g, '…')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEnTldr(markdown: string): string {
  const lines = String(markdown || '').split('\n');
  const legacyHeading = /^##\s*Three[- ]Line Summary\s*$/i;
  const tldrHeading = /^##\s*TL;DR\s*$/i;

  for (let i = 0; i < lines.length; i++) {
    if (legacyHeading.test(lines[i])) lines[i] = '## TL;DR';
  }

  const headingIndex = lines.findIndex((line) => tldrHeading.test(line));
  if (headingIndex === -1) return lines.join('\n');

  let endIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  const fixed: string[] = [];
  fixed.push(...lines.slice(0, headingIndex + 1));

  for (let i = headingIndex + 1; i < endIndex; i++) {
    const line = lines[i];
    if (/^\s*-\s+/.test(line) || line.trim() === '') {
      fixed.push(line);
      continue;
    }

    const lastIndex = fixed.length - 1;
    if (lastIndex >= 0 && /^\s*-\s+/.test(fixed[lastIndex])) {
      fixed[lastIndex] = `${fixed[lastIndex].trimEnd()} ${line.trim()}`;
    } else {
      fixed.push(line);
    }
  }

  fixed.push(...lines.slice(endIndex));
  return fixed.join('\n');
}

function loadPrimarySourceExcerpt(sourceId: string): { title: string; excerpt: string; url?: string } | null {
  if (!sourceId) return null;
  const candidates = [
    join(process.cwd(), 'data', 'news', `${sourceId}.json`),
    join(process.cwd(), 'data', 'official', `${sourceId}.json`),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(raw) as {
        title?: string;
        link?: string;
        contentSnippet?: string;
        content?: string;
      };
      const title = String(parsed.title || '').trim();
      const excerptRaw = parsed.contentSnippet || parsed.content || '';
      const excerpt = decodeHtmlEntities(stripHtml(String(excerptRaw))).slice(0, 1400);
      if (!title && !excerpt) return null;
      return { title, excerpt, url: parsed.link };
    } catch {
      continue;
    }
  }

  return null;
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

interface ArticleMetadata {
  title_ko: string;
  title_en: string;
  slug: string;
  description_ko: string;
  description_en: string;
  tags: string[];
}

function readLastExtractedTopicIds(): Set<string> | null {
  if (!existsSync(LAST_EXTRACTED_TOPICS_PATH)) return null;
  try {
    const raw = readFileSync(LAST_EXTRACTED_TOPICS_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as { topics?: Array<{ id?: string }> };
    const ids = (parsed.topics || [])
      .map((t) => String(t?.id || '').trim())
      .filter(Boolean);
    return new Set(ids);
  } catch {
    return null;
  }
}

function formatFindings(findings: ResearchFinding[]): string {
  const usableFindings = findings
    .map((finding) => ({
      ...finding,
      sources: (finding.sources || []).filter((source) => source.tier === 'S' || source.tier === 'A'),
    }))
    .filter((finding) => finding.sources.length > 0);
  if (usableFindings.length === 0) return '';

  const lines: string[] = [];

  for (const finding of usableFindings) {
    lines.push(`### Q: ${finding.question}`);
    lines.push(`**A:** ${finding.answer}`);

    if (finding.sources.length > 0) {
      lines.push('**Sources:**');
      for (const src of finding.sources) {
        const snippet = String(src.snippet || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 220);
        const suffix = snippet ? ` — ${snippet}` : '';
        lines.push(`- ${src.icon} [${src.title}](${src.url})${suffix}`);
      }
    }

    if (finding.unverified.length > 0) {
      lines.push(`**Unverified:** ${finding.unverified.join(', ')}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}

function isPublishable(topic: ResearchedTopic): boolean {
  const hasTrustedOverall = topic.findings.some((finding) =>
    finding.sources.some((source) => source.tier === 'S' || source.tier === 'A')
  );
  const primaryTier = classifySource(topic.sourceUrl || '');
  const hasTrustedPrimary = primaryTier === SourceTier.S || primaryTier === SourceTier.A;
  return topic.overallConfidence >= MIN_CONFIDENCE && (hasTrustedOverall || hasTrustedPrimary);
}

async function writeArticle(topic: ResearchedTopic, series: EditorialSeries): Promise<string> {
  const findingsText = formatFindings(topic.findings);
  const primaryExcerpt = loadPrimarySourceExcerpt(String(topic.sourceId || ''));
  const primaryTitle = primaryExcerpt?.title || '';
  const primaryText = primaryExcerpt?.excerpt || 'N/A';
  const articlePromptTemplate = `${WRITE_ARTICLE_PROMPT}

## 참고 자료 포맷 규칙 (중요):
- 참고 자료를 작성해야 할 때는 모든 항목을 반드시 "- [글 제목 - 출처명](URL)" 형식으로 작성한다.`;

  const prompt = articlePromptTemplate
    .replace('{series}', formatSeriesForPrompt(series))
    .replace('{topic}', `${topic.title}\n${topic.description}\n\nKey Insights:\n${topic.keyInsights.map(i => `- ${i}`).join('\n')}`)
    .replace('{sourceTitle}', primaryTitle)
    .replace('{sourceUrl}', String(topic.sourceUrl || primaryExcerpt?.url || ''))
    .replace('{sourceExcerpt}', primaryText)
    .replace('{findings}', findingsText);

  try {
    const response = await generateContent(prompt);

    // Clean up markdown wrapper
    let article = response
      .replace(/^```markdown\n?/i, '')
      .replace(/^```md\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    return article;
  } catch (error) {
    console.error('Error writing article:', error);
    throw error;
  }
}

async function generateMetadata(content: string): Promise<ArticleMetadata> {
  const prompt = GENERATE_METADATA_PROMPT.replace('{content}', content.substring(0, 2000));

  try {
    const response = await generateContent(prompt);
    const jsonText = extractJsonObject(response);

    if (!jsonText) {
      throw new Error('Failed to parse metadata response');
    }

    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Error generating metadata:', error);
    throw error;
  }
}

async function polishArticleMarkdown(locale: 'ko' | 'en', markdown: string): Promise<string> {
  const rules = locale === 'en'
    ? [
        'Ensure every sentence is ≤ 20 words (split aggressively if needed).',
        'Do not use absolute or overconfident language (avoid: proven, guarantee, always, never, must).',
        'Replace "must" with "should" or "can" where possible.',
        'Avoid hype words (e.g., revolutionary, groundbreaking, massive).',
        'Ensure the first sentence of the introduction starts with a concrete situation, event, or metric.',
        'Ensure the body includes at least 3 verifiable concrete numeric details (benchmark score, date, ratio, token count, etc.) from existing evidence.',
        'Do not fill the status/analysis sections with number-free claims only.',
        'Ensure a "## TL;DR" section exists near the top with exactly 3 bullet points summarizing existing content.',
        'Ensure TL;DR bullets answer: (1) what changed / what this is, (2) why it matters, (3) what the reader should do next.',
        'Include exactly one clearly labeled hypothetical scene paragraph near the top starting with "Example:" (do not present it as real).',
        'The "Example:" paragraph must not contain any numeric digits (0-9) or specific counts.',
        'Avoid relative date words like "today/yesterday/tomorrow" outside the checklist; keep explicit dates as dates.',
        'Under "## Practical Application", include "**Checklist for Today:**" with exactly 3 bullet points (one sentence each). Merge or rewrite if needed.',
        'If a "## References"/"## 참고 자료" section exists, each entry must follow: "- [Article Title - Source Name](URL)". Do not use bare domains.',
        'Avoid starting the first narrative sentence after TL;DR with "X announced/released/updated". Start with the user-visible change or implication instead.',
        'Do NOT introduce new factual claims, numbers, dates, names, or sources. You may add/adjust the labeled hypothetical example and checklist items.',
      ].join('\n- ')
    : [
        '문장을 너무 길게 늘이지 말고, 필요하면 쪼개서 명확하게 쓴다.',
        '근거 없는 단정/과장 표현을 제거한다.',
        '금지 표현을 피한다: "매우", "다양한", "혁신적", "획기적", "완벽", "절대".',
        '도입부 첫 문장은 반드시 구체적인 상황/사건/수치로 시작한다.',
        '검증 가능한 구체적 수치(벤치마크 점수, 날짜, 비율, 토큰 수 등)를 본문에 최소 3개 포함한다.',
        '현황/분석 섹션을 수치 없는 주장만으로 채우지 않는다.',
        '"## 세 줄 요약" 섹션을 상단에 추가하고, 기존 본문만 바탕으로 3개 불릿으로 요약한다.',
        '세 줄 요약 3개 불릿은 (1) 무슨 변화/핵심이슈인가, (2) 왜 중요한가, (3) 독자는 뭘 하면 되나 순서로 쓴다.',
        '도입부에 가상의 장면 1개를 넣되, 반드시 "예:"로 시작하는 별도 문단으로 작성한다.',
        '"예:" 문단에는 숫자(0-9)를 쓰지 않는다. (사실처럼 보이기 때문)',
        '체크리스트를 제외하고 "오늘/어제/내일/이번 주" 같은 상대적 날짜 표현을 쓰지 말고, 본문에 있는 날짜를 그대로 쓴다.',
        '"## 실전 적용"에 "**오늘 바로 할 일:**" 체크리스트를 넣고, 정확히 3개 불릿(각 1문장)로 쓴다.',
        '"## 참고 자료" 섹션이 있다면 각 항목을 반드시 "- [글 제목 - 출처명](URL)" 형식으로 맞추고, 도메인만 쓰지 않는다.',
        '"## 현황"의 첫 문장을 "~가 발표했다"로 시작하지 말고, 변화/영향을 먼저 말한다.',
        '새로운 사실 주장(수치/날짜/출처/고유명사)을 절대 추가하지 않는다. 다만 예시/체크리스트는 일반론으로만 보완할 수 있다.',
      ].join('\n- ');

  const prompt = `You are a careful technical editor.

Rewrite the following Markdown for clarity and intellectual honesty.

Rules:
- Preserve meaning and overall structure (headings, lists).
- ${rules}

Output:
- Return ONLY the revised Markdown body.

Markdown:
${markdown.substring(0, 9000)}`;

  try {
    const response = await generateContent(prompt);
    return response
      .replace(/^```markdown\n?/i, '')
      .replace(/^```md\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
  } catch {
    return markdown;
  }
}

function generateFrontmatter(
  metadata: ArticleMetadata,
  topic: ResearchedTopic,
  locale: 'ko' | 'en',
  slug: string,
  content: string,
  coverImagePath: string | undefined,
  series: EditorialSeries
): string {
  const isEnglish = locale === 'en';
  const title = isEnglish ? metadata.title_en : metadata.title_ko;
  const description = isEnglish ? metadata.description_en : metadata.description_ko;
  const otherLocale = isEnglish ? 'ko' : 'en';

  // Collect all sources for citation
  const allSources = topic.findings.flatMap(f => f.sources);
  const uniqueSources = [...new Map(allSources.map(s => [s.url, s])).values()];

  const normalizeTag = (value: string) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const seriesSet = new Set(SERIES_TAGS);
  const baseTags = (metadata.tags || [])
    .map(normalizeTag)
    .filter(Boolean)
    .filter((t) => !seriesSet.has(t as any));
  const combinedText = `${title}\n${description}\n${baseTags.join(' ')}\n${content}`.toLowerCase();

  const derivedCore = CORE_TAG_PATTERNS.filter(({ regex }) => regex.test(combinedText)).map(
    ({ tag }) => tag
  );

  const topicTag = topic.topic ? normalizeTag(topic.topic) : '';
  const finalTagsRaw = [
    ...new Set([
      series,
      ...baseTags,
      ...(topicTag ? [topicTag] : []),
      ...(derivedCore.length ? derivedCore : ['llm']),
    ]),
  ];
  const finalTags = canonicalizeTags(finalTagsRaw, { maxTags: 8 });

  const primaryKeyword = topic.primaryKeyword ? String(topic.primaryKeyword).trim() : '';
  const intent = topic.intent ? String(topic.intent).trim() : '';
  const topicId = topic.topic ? String(topic.topic).trim() : '';
  const schema = topic.schema ? String(topic.schema).trim() : '';
  const evergreenLines = [
    primaryKeyword ? `primaryKeyword: "${primaryKeyword.replace(/"/g, '\\"')}"` : '',
    intent ? `intent: "${intent.replace(/"/g, '\\"')}"` : '',
    topicId ? `topic: "${topicId.replace(/"/g, '\\"')}"` : '',
    schema ? `schema: "${schema.replace(/"/g, '\\"')}"` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const evergreenBlock = evergreenLines ? `${evergreenLines}\n` : '';

  return `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
date: "${new Date().toISOString().split('T')[0]}"
lastReviewedAt: "${new Date().toISOString().split('T')[0]}"
locale: "${locale}"
description: "${description.replace(/"/g, '\\"')}"
${evergreenBlock}tags: [${finalTags.map((t) => `"${t}"`).join(', ')}]
author: "AI온다"
sourceId: "${topic.sourceId}"
sourceUrl: "${topic.sourceUrl}"
verificationScore: ${topic.overallConfidence}
alternateLocale: "/${otherLocale}/posts/${slug}"
coverImage: "${coverImagePath || `/images/posts/${slug}.png`}"
---`;
}

function getExistingCoverImage(slug: string): string | null {
  const direct = [
    `/images/posts/${slug}.png`,
    `/images/posts/${slug}.jpeg`,
    `/images/posts/${slug}.jpg`,
  ];
  for (const coverImage of direct) {
    const imagePathRel = coverImage.startsWith('/') ? coverImage.slice(1) : coverImage;
    const absolutePath = join(process.cwd(), 'apps/web/public', imagePathRel);
    if (existsSync(absolutePath)) return coverImage;
  }

  const candidates = [
    join(POSTS_DIR, 'en', `${slug}.mdx`),
    join(POSTS_DIR, 'en', `${slug}.md`),
    join(POSTS_DIR, 'ko', `${slug}.mdx`),
    join(POSTS_DIR, 'ko', `${slug}.md`),
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue;
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const { data } = matter(raw);
      const coverImage = data.coverImage ? String(data.coverImage) : '';
      if (!coverImage) continue;
      const imagePathRel = coverImage.startsWith('/') ? coverImage.slice(1) : coverImage;
      const absolutePath = join(process.cwd(), 'apps/web/public', imagePathRel);
      if (existsSync(absolutePath)) return coverImage;
    } catch {
      continue;
    }
  }
  return null;
}

function findExistingSlugBySourceId(localeDir: string, sourceId: string): string | null {
  if (!existsSync(localeDir)) return null;

  const files = readdirSync(localeDir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  let selectedSlug: string | null = null;
  let selectedMtime = Number.POSITIVE_INFINITY;

  for (const file of files) {
    const raw = readFileSync(join(localeDir, file), 'utf-8');
    let data: Record<string, unknown>;
    try {
      data = matter(raw).data as Record<string, unknown>;
    } catch {
      continue;
    }
    const fileSourceId = data.sourceId ? String(data.sourceId) : '';
    if (fileSourceId !== sourceId) continue;

    const fileSlug = data.slug || file.replace(/\.mdx?$/, '');
    const mtime = statSync(join(localeDir, file)).mtimeMs;
    if (mtime < selectedMtime) {
      selectedMtime = mtime;
      selectedSlug = String(fileSlug);
    }
  }

  return selectedSlug;
}

function removeDuplicatePostsBySourceId(localeDir: string, sourceId: string, keepSlug: string) {
  if (!existsSync(localeDir)) return;
  const files = readdirSync(localeDir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  const removed: string[] = [];

  for (const file of files) {
    const fullPath = join(localeDir, file);
    const raw = readFileSync(fullPath, 'utf-8');
    let data: Record<string, unknown>;
    try {
      data = matter(raw).data as Record<string, unknown>;
    } catch {
      continue;
    }
    const fileSourceId = data.sourceId ? String(data.sourceId) : '';
    if (fileSourceId !== sourceId) continue;

    const fileSlug = data.slug || file.replace(/\.mdx?$/, '');
    if (String(fileSlug) === keepSlug) continue;

    unlinkSync(fullPath);
    removed.push(file);
  }

  if (removed.length > 0) {
    console.log(`   🧹 Removed ${removed.length} duplicate post(s) for sourceId ${sourceId}`);
  }
}

interface IndexedPost {
  slug: string;
  title: string;
  date: string;
  lastReviewedAt?: string;
  tags: string[];
  topic?: string;
  intent?: string;
  schema?: string;
  primaryKeyword?: string;
  description?: string;
}

const postsIndexCache: Partial<Record<Locale, IndexedPost[]>> = {};
const topicTitlesCache: Partial<Record<Locale, Map<string, string>>> = {};

function getTopicTitle(locale: Locale, topicId: string): string | null {
  const normalized = normalizeTopicId(topicId);
  if (!normalized) return null;

  const cached = topicTitlesCache[locale];
  if (cached && cached.has(normalized)) return cached.get(normalized) || null;

  const map = cached || new Map<string, string>();
  if (!cached) topicTitlesCache[locale] = map;

  const filePath = join(process.cwd(), 'apps', 'web', 'content', 'topics', `${locale}.json`);
  if (!existsSync(filePath)) {
    map.set(normalized, normalized);
    return normalized;
  }

  try {
    const raw = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Array<{ id?: unknown; title?: unknown }>;
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const id = normalizeTopicId(String(item?.id || ''));
        const title = String(item?.title || '').trim();
        if (!id || !title) continue;
        map.set(id, title);
      }
    }
  } catch {
    // ignore
  }

  if (!map.has(normalized)) map.set(normalized, normalized);
  return map.get(normalized) || null;
}

function normalizeTagList(raw: unknown): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((t) => String(t || '').trim().toLowerCase())
    .filter(Boolean);
}

function loadPostsIndex(locale: Locale): IndexedPost[] {
  const cached = postsIndexCache[locale];
  if (cached) return cached;

  const dir = join(process.cwd(), POSTS_DIR, locale);
  if (!existsSync(dir)) {
    postsIndexCache[locale] = [];
    return [];
  }

  const out: IndexedPost[] = [];
  for (const file of readdirSync(dir).filter((f) => (f.endsWith('.mdx') || f.endsWith('.md')) && !f.startsWith('._'))) {
    const fullPath = join(dir, file);
    try {
      const raw = readFileSync(fullPath, 'utf8');
      const { data, content } = matter(raw);
      const slug = String(data.slug || file.replace(/\.mdx?$/, '')).trim();
      if (!slug) continue;
      const title = String(data.title || slug).trim();
      const date = String(data.date || '').trim();
      const lastReviewedAt = String(data.lastReviewedAt || '').trim();
      const topic = typeof data.topic === 'string' ? data.topic.trim() : '';
      const intent = typeof data.intent === 'string' ? data.intent.trim().toLowerCase() : '';
      const schema = typeof data.schema === 'string' ? data.schema.trim().toLowerCase() : '';
      const primaryKeyword = typeof data.primaryKeyword === 'string' ? data.primaryKeyword.trim() : '';
      const description =
        typeof data.description === 'string'
          ? data.description.trim()
          : typeof data.excerpt === 'string'
            ? data.excerpt.trim()
            : String(content || '').trim().slice(0, 200);
      const tags = normalizeTagList((data as any).tags);

      out.push({
        slug,
        title,
        date,
        lastReviewedAt: lastReviewedAt || undefined,
        tags,
        topic: topic || undefined,
        intent: intent || undefined,
        schema: schema || undefined,
        primaryKeyword: primaryKeyword || undefined,
        description: description || undefined,
      });
    } catch {
      continue;
    }
  }

  postsIndexCache[locale] = out;
  return out;
}

function toFreshnessMs(post: { date: string; lastReviewedAt?: string }): number {
  const raw = post.lastReviewedAt || post.date;
  const t = new Date(String(raw || '')).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function buildInternalLinksSection(locale: Locale, input: {
  currentSlug: string;
  topicId?: string;
  intent?: string;
  minLinks?: number;
}): string {
  const posts = loadPostsIndex(locale).filter((p) => p.slug !== input.currentSlug);
  if (posts.length === 0) return '';

  const topicNormalized = input.topicId ? normalizeTopicId(input.topicId) : '';
  const intentNormalized = String(input.intent || '').trim().toLowerCase();
  const minLinks = typeof input.minLinks === 'number' && input.minLinks > 0 ? input.minLinks : 4;

  const seen = new Set<string>();
  const picked: Array<{ href: string; text: string }> = [];
  const add = (href: string, text: string) => {
    const normalizedHref = String(href || '').trim();
    const normalizedText = String(text || '').trim();
    if (!normalizedHref || !normalizedText) return;
    if (seen.has(normalizedHref)) return;
    seen.add(normalizedHref);
    picked.push({ href: normalizedHref, text: normalizedText });
  };

  if (topicNormalized) {
    const title = getTopicTitle(locale, topicNormalized) || topicNormalized;
    const label = locale === 'ko' ? `${title} 토픽에서 더 보기` : `Explore the ${title} topic`;
    add(`/${locale}/topics/${encodeURIComponent(topicNormalized)}`, label);
  }

  if (topicNormalized) {
    const sameTopic = posts
      .filter((p) => {
        const postTopic = p.topic ? normalizeTopicId(p.topic) : '';
        if (postTopic && postTopic === topicNormalized) return true;
        if (p.tags.includes(topicNormalized)) return true;
        return false;
      })
      .sort((a, b) => toFreshnessMs(b) - toFreshnessMs(a))
      .slice(0, 6);

    for (const p of sameTopic) {
      if (picked.length >= 3) break;
      add(`/${locale}/posts/${encodeURIComponent(p.slug)}`, p.title);
    }
  }

  if (intentNormalized) {
    const sameIntent = posts
      .filter((p) => String(p.intent || '').toLowerCase() === intentNormalized)
      .sort((a, b) => toFreshnessMs(b) - toFreshnessMs(a))
      .slice(0, 6);
    for (const p of sameIntent) {
      if (picked.length >= 5) break;
      add(`/${locale}/posts/${encodeURIComponent(p.slug)}`, p.title);
    }
  }

  if (picked.length < minLinks) {
    const recent = posts
      .slice()
      .sort((a, b) => toFreshnessMs(b) - toFreshnessMs(a));
    for (const p of recent) {
      if (picked.length >= minLinks) break;
      add(`/${locale}/posts/${encodeURIComponent(p.slug)}`, p.title);
    }
  }

  if (picked.length < 2) return '';

  const heading = locale === 'ko' ? '## 다음으로 읽기' : '## Further Reading';
  const lines = [
    '',
    heading,
    ...picked.slice(0, Math.max(minLinks, 4)).map((l) => `- [${l.text}](${l.href})`),
    '',
  ];
  return lines.join('\n').trim();
}

function insertInternalLinks(locale: Locale, markdown: string, input: { slug: string; topicId?: string; intent?: string }): string {
  const headingRe = locale === 'ko' ? /^##\s*다음으로\s*읽기\s*$/im : /^##\s*Further\s+Reading\s*$/im;
  if (headingRe.test(markdown)) return markdown;

  const cleaned = stripInlineReferences(markdown);
  const section = buildInternalLinksSection(locale, {
    currentSlug: input.slug,
    topicId: input.topicId,
    intent: input.intent,
    minLinks: 5,
  });
  if (!section) return cleaned;
  return `${cleaned}\n\n${section}\n`.trim();
}

function ensureTroubleshootingTldr(locale: Locale, markdown: string): string {
  const tldrHeading = locale === 'ko'
    ? /^##\s*(TL;DR|세\s*줄\s*요약|세줄\s*요약|간단\s*요약)\s*$/i
    : /^##\s*TL;DR\s*$/i;
  const lines = String(markdown || '').split('\n');
  const headingIndex = lines.findIndex((line) => tldrHeading.test(line.trim()));
  if (headingIndex === -1) return markdown;

  let endIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  const bulletIndices: number[] = [];
  for (let i = headingIndex + 1; i < endIndex; i++) {
    if (/^\s*-\s+/.test(lines[i])) bulletIndices.push(i);
  }
  if (bulletIndices.length < 3) return markdown;

  const already =
    locale === 'ko'
      ? /(장애|계정|네트워크|클라이언트)/.test(lines.slice(headingIndex, endIndex).join('\n'))
      : /\b(outage|account|network|client)\b/i.test(lines.slice(headingIndex, endIndex).join('\n'));
  if (already) return markdown;

  const thirdIdx = bulletIndices[2];
  const suffix = locale === 'ko'
    ? ' — 장애/계정/네트워크/클라이언트로 먼저 분리해 확인하세요.'
    : ' — Start by splitting it into outage/account/network/client.';
  lines[thirdIdx] = `${lines[thirdIdx].trimEnd()}${suffix}`;
  return lines.join('\n');
}

function stripInlineReferences(content: string): string {
  const markers = [
    /^##\s*참고\s*자료\s*$/m,
    /^\*\*참고\s*자료\*\*\s*$/m,
    /^##\s*References\s*$/mi,
    /^##\s*Sources\s*$/mi,
  ];

  let cutIndex = -1;
  for (const marker of markers) {
    const match = marker.exec(content);
    if (match) {
      if (cutIndex === -1 || match.index < cutIndex) {
        cutIndex = match.index;
      }
    }
  }

  if (cutIndex === -1) return content;

  const hrIndex = content.lastIndexOf('\n---', cutIndex);
  const start = hrIndex >= 0 ? hrIndex : cutIndex;
  return content.slice(0, start).trim();
}

function appendSources(locale: 'ko' | 'en', content: string, topic: ResearchedTopic): string {
  const cleaned = stripInlineReferences(content);
  const allSources = topic.findings.flatMap(f => f.sources);
  const primarySourceTitle = (() => {
    try {
      return new URL(topic.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return 'Source';
    }
  })();
  const primarySource = topic.sourceUrl
    ? createVerifiedSource(topic.sourceUrl, primarySourceTitle)
    : null;
  const uniqueSources = [
    ...new Map(
      [
        ...allSources,
        ...(primarySource ? [primarySource] : []),
      ].map((s) => [s.url, s])
    ).values(),
  ];
  const trustedSources = uniqueSources.filter((s) => s.tier === 'S' || s.tier === 'A');

  if (trustedSources.length === 0) return cleaned;

  // Sort by tier
  const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
  trustedSources.sort((a, b) => (tierOrder[a.tier] || 3) - (tierOrder[b.tier] || 3));

  const sourcesSection = [
    '',
    '---',
    '',
    locale === 'en' ? '## References' : '## 참고 자료',
    '',
    ...trustedSources.map((s) => {
      const title = String(s.title || s.url).replace(/\s+/g, ' ').trim();
      const sourceName = String(s.domain || '')
        .replace(/^www\./, '')
        .trim() || 'Source';
      return `- [${title} - ${sourceName}](${s.url})`;
    }),
  ].join('\n');

  return cleaned + sourcesSection;
}

function normalizeEvidenceToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s\-_–—.]/g, '')
    .replace(/[’'"]/g, '');
}

function sanitizeModelMentions(locale: 'ko' | 'en', markdown: string, evidenceText: string): string {
  const evidence = normalizeEvidenceToken(evidenceText);
  if (!evidence) return markdown;

  const replacements = {
    gpt: locale === 'ko' ? 'GPT 계열' : 'GPT-family model',
    gemini: locale === 'ko' ? 'Gemini 계열' : 'Gemini-family model',
    claude: locale === 'ko' ? 'Claude 계열' : 'Claude-family model',
    llama: locale === 'ko' ? 'Llama 계열' : 'Llama-family model',
    qwen: locale === 'ko' ? 'Qwen 계열' : 'Qwen-family model',
    kimi: locale === 'ko' ? 'Kimi 계열' : 'Kimi-family model',
    deepseek: locale === 'ko' ? 'DeepSeek 계열' : 'DeepSeek-family model',
  } as const;

  const rules: Array<{ family: keyof typeof replacements; re: RegExp }> = [
    { family: 'gpt', re: /\bGPT[-\s]?(?:\d[0-9a-z.\-]*|4o[0-9a-z.\-]*|o\d[0-9a-z.\-]*)\b/gi },
    { family: 'gemini', re: /\bGemini[-\s]?\d(?:\.\d+)?\b/gi },
    { family: 'claude', re: /\bClaude[-\s]?\d(?:\.\d+)?\b/gi },
    { family: 'llama', re: /\bLlama[-\s]?\d(?:\.\d+)?\b/gi },
    { family: 'qwen', re: /\bQwen[-\s]?\d(?:\.\d+)?\b/gi },
    { family: 'kimi', re: /\bKimi[-\s]?\d(?:\.\d+)?\b/gi },
    { family: 'deepseek', re: /\bDeepSeek[-\s]?\d(?:\.\d+)?\b/gi },
  ];

  const koRules: Array<{ family: keyof typeof replacements; re: RegExp }> = [
    { family: 'gpt', re: /\bGPT\s*[-‑–—]?\s*\d[0-9a-z.\-]*\b/gi },
    { family: 'gemini', re: /제미나이\s*\d(?:\.\d+)?/gi },
    { family: 'claude', re: /클로드\s*\d(?:\.\d+)?/gi },
    { family: 'llama', re: /라마\s*\d(?:\.\d+)?/gi },
    { family: 'qwen', re: /큐웬\s*\d(?:\.\d+)?/gi },
    { family: 'kimi', re: /키미\s*\d(?:\.\d+)?/gi },
    { family: 'deepseek', re: /딥시크\s*\d(?:\.\d+)?/gi },
  ];

  // Avoid touching code fences (can contain literal model identifiers).
  const lines = String(markdown || '').split('\n');
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const applyRule = (family: keyof typeof replacements, re: RegExp) => {
      lines[i] = lines[i].replace(re, (match) => {
        const token = normalizeEvidenceToken(match);
        if (token && evidence.includes(token)) return match;
        return replacements[family];
      });
    };

    for (const rule of rules) applyRule(rule.family, rule.re);
    for (const rule of koRules) applyRule(rule.family, rule.re);
  }

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const limitFromCli = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const limitFromEnv = process.env.WRITE_ARTICLE_LIMIT ? parseInt(process.env.WRITE_ARTICLE_LIMIT, 10) : undefined;
  const maxArticlesRaw = Number.isFinite(limitFromCli)
    ? (limitFromCli as number)
    : Number.isFinite(limitFromEnv)
      ? (limitFromEnv as number)
      : undefined;
  const maxArticles = Number.isFinite(maxArticlesRaw) && (maxArticlesRaw as number) > 0 ? (maxArticlesRaw as number) : undefined;
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

  console.log('\n' + '═'.repeat(60));
  console.log('  Article Writing Pipeline');
  console.log('  Writing articles from researched topics');
  console.log('═'.repeat(60) + '\n');

  // Ensure directories exist
  if (!existsSync(RESEARCHED_DIR)) {
    console.log('❌ No researched topics found. Run `pnpm research-topic` first.');
    process.exit(1);
  }

  if (maxArticles) {
    console.log(`📌 Write limit: ${maxArticles} article(s)\n`);
  }

  const enDir = join(POSTS_DIR, 'en');
  const koDir = join(POSTS_DIR, 'ko');
  if (!existsSync(enDir)) mkdirSync(enDir, { recursive: true });
  if (!existsSync(koDir)) mkdirSync(koDir, { recursive: true });
  if (!existsSync(PUBLISHED_DIR)) mkdirSync(PUBLISHED_DIR, { recursive: true });
  if (!existsSync(VC_DIR)) mkdirSync(VC_DIR, { recursive: true });

  // Get already published topic IDs
  const publishedIds = new Set<string>();
  if (existsSync(PUBLISHED_DIR)) {
    for (const file of readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json') && !f.startsWith('._'))) {
      const filePath = join(PUBLISHED_DIR, file);
      try {
        const published = JSON.parse(readFileSync(filePath, 'utf-8')) as { topicId?: string };
        if (typeof published.topicId === 'string' && published.topicId.trim()) {
          publishedIds.add(published.topicId);
        } else {
          console.warn(`⚠️ Skipping published file with missing topicId: ${filePath}`);
        }
      } catch (error) {
        console.warn(`⚠️ Skipping corrupted JSON file: ${filePath}`, error);
        continue;
      }
    }
  }

  const lastExtractedIds = fromLastExtract ? readLastExtractedTopicIds() : null;
  if (fromLastExtract) {
    if (!lastExtractedIds || lastExtractedIds.size === 0) {
      console.log('✅ No last extracted topics found. Nothing to write (use without --from-last-extract to process backlog).');
      writeFileSync(
        LAST_WRITTEN_PATH,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            writtenCount: 0,
            files: [],
            entries: [],
          },
          null,
          2
        )
      );
      console.log(`Wrote ${LAST_WRITTEN_PATH}`);
      process.exit(0);
    }
    console.log(`🎯 From last extract: ${lastExtractedIds.size} topic(s)\n`);
  }

  // Get publishable topics
  const researchedFiles = readdirSync(RESEARCHED_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._'))
    .map(f => {
      const filePath = join(RESEARCHED_DIR, f);
      try {
        const topic = JSON.parse(readFileSync(filePath, 'utf-8')) as ResearchedTopic;
        return { file: f, topic };
      } catch (error) {
        console.warn(`⚠️ Skipping corrupted JSON file: ${filePath}`, error);
        return null;
      }
    })
    .filter((entry): entry is { file: string; topic: ResearchedTopic } => Boolean(entry))
    .filter(({ topic }) => {
      if (lastExtractedIds && !lastExtractedIds.has(String(topic.topicId || ''))) return false;
      const matchesTarget =
        targetIds.length === 0 ||
        targetIds.includes(topic.topicId) ||
        targetIds.includes(topic.sourceId);
      if (!matchesTarget) return false;
      if (!isPublishable(topic)) return false;
      if (force) return true;
      return !publishedIds.has(topic.topicId);
    })
    .sort((a, b) => {
      const at = new Date(a.topic.researchedAt || '').getTime() || 0;
      const bt = new Date(b.topic.researchedAt || '').getTime() || 0;
      if (at !== bt) return bt - at;
      const ac = Number(a.topic.overallConfidence || 0);
      const bc = Number(b.topic.overallConfidence || 0);
      return bc - ac;
    });

  if (researchedFiles.length === 0) {
    console.log('✅ No publishable topics to write.');
    if (!existsSync(VC_DIR)) mkdirSync(VC_DIR, { recursive: true });
    writeFileSync(
      LAST_WRITTEN_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          writtenCount: 0,
          files: [],
          entries: [],
        },
        null,
        2
      )
    );
    console.log(`Wrote ${LAST_WRITTEN_PATH}`);
    process.exit(0);
  }

  console.log(`📚 Found ${researchedFiles.length} publishable topic(s)\n`);

  let written = 0;
  const writtenFiles: string[] = [];
  const writtenEntries: Array<{
    topicId: string;
    sourceId: string;
    slug: string;
    files: string[];
    writtenAt: string;
  }> = [];

  for (const { file, topic } of researchedFiles) {
    if (maxArticles && written >= maxArticles) break;

    console.log(`📋 Topic: "${topic.title}"`);
    console.log(`   Confidence: ${Math.round(topic.overallConfidence * 100)}%`);

    try {
      const series = selectEditorialSeries(topic);
      console.log(`   🧭 Series: ${series}`);

      // memU 중복 체크
      console.log('   🔍 Checking for duplicates (memU)...');
      const duplicateCheck = await checkBeforePublish(
        topic.title,
        topic.description + '\n' + topic.keyInsights.join('\n')
      );

      if (duplicateCheck.isDuplicate && !force) {
        console.log(`   ⚠️ Similar content found (score: ${duplicateCheck.similarItems[0]?.score?.toFixed(2)})`);
        console.log(`   ⏭️ Skipping to avoid duplicate. Use --force to override.`);
        continue;
      }

      // Write Korean article
      console.log('   📝 Writing Korean article...');
      let articleKo = await writeArticle(topic, series);
      articleKo = await polishArticleMarkdown('ko', articleKo);
      const primaryExcerptKo = loadPrimarySourceExcerpt(String(topic.sourceId || ''));
      const evidenceTextKo = [
        primaryExcerptKo?.title,
        primaryExcerptKo?.excerpt,
        ...topic.findings.flatMap((f) => (f.sources || []).map((s) => `${s.title}\n${s.snippet || ''}`)),
      ]
        .filter(Boolean)
        .join('\n');
      articleKo = sanitizeModelMentions('ko', articleKo, evidenceTextKo);
      if (topic.intent === 'troubleshooting' || topic.schema === 'howto') {
        articleKo = ensureTroubleshootingTldr('ko', articleKo);
      }

      // Generate metadata
      console.log('   📰 Generating metadata...');
      const metadata = await generateMetadata(articleKo);
      metadata.tags = Array.from(new Set([...(metadata.tags || []), series]));

      const sourceId = String(topic.sourceId || '');
      const existingSlug =
        (sourceId ? findExistingSlugBySourceId(koDir, sourceId) : null) ||
        (sourceId ? findExistingSlugBySourceId(enDir, sourceId) : null);
      let slug = existingSlug || metadata.slug;
      if (!existingSlug) {
        const existingKoFile = join(koDir, `${slug}.mdx`);
        if (existsSync(existingKoFile)) {
          try {
            const existingRaw = readFileSync(existingKoFile, 'utf-8');
            const existingData = matter(existingRaw).data;
            const existingSourceId = existingData.sourceId ? String(existingData.sourceId) : '';
            if (existingSourceId && existingSourceId !== sourceId) {
              const suffix = Date.now().toString(36).slice(-4);
              slug = `${slug}-${suffix}`;
              console.warn(`   Slug collision detected (existing: ${existingSourceId}), using: ${slug}`);
            }
          } catch {}
        }
      }
      const coverImagePath = getExistingCoverImage(slug);

      // Translate to English
      console.log('   🌐 Translating to English...');
      const translated = await translateToEnglish(metadata.title_ko, articleKo, {
        extraRules: [
          '한국어 원문의 모든 벤치마크 수치, 데이터 포인트, 분석 근거를 빠짐없이 영문에 포함할 것. 요약하지 말고 동등한 깊이로 번역할 것.',
        ],
      });
      const translationFailed = Boolean(translated.translationFailed);
      let articleEn = String(translated.content_en || '');
      if (!translationFailed) {
        articleEn = await polishArticleMarkdown('en', articleEn);
        articleEn = normalizeEnTldr(articleEn);
        const primaryExcerptEn = loadPrimarySourceExcerpt(String(topic.sourceId || ''));
        const evidenceTextEn = [
          primaryExcerptEn?.title,
          primaryExcerptEn?.excerpt,
          ...topic.findings.flatMap((f) => (f.sources || []).map((s) => `${s.title}\n${s.snippet || ''}`)),
        ]
          .filter(Boolean)
          .join('\n');
        articleEn = sanitizeModelMentions('en', articleEn, evidenceTextEn);
        if (topic.intent === 'troubleshooting' || topic.schema === 'howto') {
          articleEn = ensureTroubleshootingTldr('en', articleEn);
        }
      } else {
        console.warn('Translation failed - skipping EN post');
      }

      // Insert internal links (locale-correct), then append sources as the last section.
      articleKo = insertInternalLinks('ko', articleKo, {
        slug,
        topicId: topic.topic ? String(topic.topic) : undefined,
        intent: topic.intent ? String(topic.intent) : undefined,
      });
      if (!translationFailed) {
        articleEn = insertInternalLinks('en', articleEn, {
          slug,
          topicId: topic.topic ? String(topic.topic) : undefined,
          intent: topic.intent ? String(topic.intent) : undefined,
        });
      }

      articleKo = appendSources('ko', articleKo, topic);
      if (!translationFailed) {
        articleEn = appendSources('en', articleEn, topic);
      }

      // Generate frontmatter
      const frontmatterKo = generateFrontmatter(metadata, topic, 'ko', slug, articleKo, coverImagePath || undefined, series);

      // Write files
      const koFile = join(koDir, `${slug}.mdx`);
      const enFile = join(enDir, `${slug}.mdx`);
      const createdFiles = [koFile];

      writeFileSync(koFile, `${frontmatterKo}\n\n${articleKo}\n`);
      if (!translationFailed) {
        const frontmatterEn = generateFrontmatter(metadata, topic, 'en', slug, articleEn, coverImagePath || undefined, series);
        writeFileSync(enFile, `${frontmatterEn}\n\n${articleEn}\n`);
        createdFiles.push(enFile);
      }

      console.log(`   ✅ Created: ${slug}.mdx`);
      writtenFiles.push(...createdFiles);

      if (sourceId) {
        if (!translationFailed) {
          removeDuplicatePostsBySourceId(enDir, sourceId, slug);
        }
        removeDuplicatePostsBySourceId(koDir, sourceId, slug);
      }

      // Move to published
      const publishedData = {
        topicId: topic.topicId,
        sourceId: topic.sourceId,
        slug,
        publishedAt: new Date().toISOString(),
      };
      writeFileSync(join(PUBLISHED_DIR, `${topic.topicId}.json`), JSON.stringify(publishedData, null, 2));

      // memU에 저장 (중복 방지용)
      console.log('   💾 Saving to memU...');
      const saved = await saveAfterPublish(metadata.title_ko, articleKo, slug);
      if (saved) {
        console.log('   ✅ Saved to memU for future duplicate detection');
      }

      written++;
      writtenEntries.push({
        topicId: String(topic.topicId || ''),
        sourceId: sourceId,
        slug,
        files: createdFiles,
        writtenAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error(`   ❌ Error writing article:`, error);
    }

    console.log('');

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('═'.repeat(60));
  console.log(`✨ Done! Written: ${written} article(s)`);
  console.log('Next step: Run `pnpm generate-image` to create cover images.');
  console.log('═'.repeat(60));

  // SSOT for downstream gates (verify only newly written files).
  writeFileSync(
    LAST_WRITTEN_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        writtenCount: written,
        files: writtenFiles,
        entries: writtenEntries,
      },
      null,
      2
    )
  );
  console.log(`Wrote ${LAST_WRITTEN_PATH}`);
}

main().catch(console.error);
