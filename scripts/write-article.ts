/**
 * Write articles based on researched topics
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { generateContent, translateToEnglish } from './lib/gemini';
import { WRITE_ARTICLE_PROMPT, GENERATE_METADATA_PROMPT } from './prompts/topics';
import { checkBeforePublish, saveAfterPublish } from './lib/memu-client';
import { classifySource, createVerifiedSource, SourceTier } from './lib/search-mode.js';
import matter from 'gray-matter';

config({ path: '.env.local' });

const RESEARCHED_DIR = './data/researched';
const PUBLISHED_DIR = './data/published';
const POSTS_DIR = './apps/web/content/posts';
const VC_DIR = './.vc';
const LAST_WRITTEN_PATH = join(VC_DIR, 'last-written.json');
const MIN_CONFIDENCE = 0.6;
const CORE_TAGS = ['agi', 'llm', 'robotics', 'hardware'] as const;
const CORE_TAG_PATTERNS: Array<{ tag: (typeof CORE_TAGS)[number]; regex: RegExp }> = [
  { tag: 'agi', regex: /agi|artificial general intelligence|superintelligence|초지능|범용.*인공지능/i },
  { tag: 'robotics', regex: /robot|로봇|humanoid|휴머노이드|boston dynamics|figure|drone|드론|자율주행/i },
  { tag: 'hardware', regex: /hardware|하드웨어|gpu|tpu|nvidia|chip|반도체|칩|blackwell|h100|b200|rubin|cuda|hbm/i },
  { tag: 'llm', regex: /llm|language model|언어.*모델|대형언어|transformer|트랜스포머|gpt|chatgpt|claude|gemini|llama/i },
];

function stripHtml(value: string): string {
  return String(value || '').replace(/<[^>]*>/g, '');
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
}

interface ArticleMetadata {
  title_ko: string;
  title_en: string;
  slug: string;
  description_ko: string;
  description_en: string;
  tags: string[];
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

async function writeArticle(topic: ResearchedTopic): Promise<string> {
  const findingsText = formatFindings(topic.findings);
  const primaryExcerpt = loadPrimarySourceExcerpt(String(topic.sourceId || ''));
  const primaryTitle = primaryExcerpt?.title || '';
  const primaryText = primaryExcerpt?.excerpt || 'N/A';

  const prompt = WRITE_ARTICLE_PROMPT
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
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse metadata response');
    }

    return JSON.parse(jsonMatch[0]);
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
        'Ensure a "## TL;DR" section exists near the top with exactly 3 bullet points summarizing existing content.',
        'Include exactly one clearly labeled hypothetical scene paragraph near the top starting with "Example:" (do not present it as real).',
        'The "Example:" paragraph must not contain any numeric digits (0-9) or specific counts.',
        'Avoid relative date words like "today/yesterday/tomorrow" outside the checklist; keep explicit dates as dates.',
        'Under "## Practical Application", include "**Checklist for Today:**" with exactly 3 bullet points (one sentence each). Merge or rewrite if needed.',
        'Do NOT introduce new factual claims, numbers, dates, names, or sources. You may add/adjust the labeled hypothetical example and checklist items.',
      ].join('\n- ')
    : [
        '문장을 너무 길게 늘이지 말고, 필요하면 쪼개서 명확하게 쓴다.',
        '근거 없는 단정/과장 표현을 제거한다.',
        '금지 표현을 피한다: "매우", "다양한", "혁신적", "획기적", "완벽", "절대".',
        '"## 세 줄 요약" 섹션을 상단에 추가하고, 기존 본문만 바탕으로 3개 불릿으로 요약한다.',
        '도입부에 가상의 장면 1개를 넣되, 반드시 "예:"로 시작하는 별도 문단으로 작성한다.',
        '"예:" 문단에는 숫자(0-9)를 쓰지 않는다. (사실처럼 보이기 때문)',
        '체크리스트를 제외하고 "오늘/어제/내일/이번 주" 같은 상대적 날짜 표현을 쓰지 말고, 본문에 있는 날짜를 그대로 쓴다.',
        '"## 실전 적용"에 "**오늘 바로 할 일:**" 체크리스트를 넣고, 정확히 3개 불릿(각 1문장)로 쓴다.',
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
  coverImagePath?: string
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

  const baseTags = (metadata.tags || []).map(normalizeTag).filter(Boolean);
  const combinedText = `${title}\n${description}\n${baseTags.join(' ')}\n${content}`.toLowerCase();

  const derivedCore = CORE_TAG_PATTERNS.filter(({ regex }) => regex.test(combinedText)).map(
    ({ tag }) => tag
  );

  const finalTags = [...new Set([...baseTags, ...(derivedCore.length ? derivedCore : ['llm'])])];

return `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
date: "${new Date().toISOString().split('T')[0]}"
locale: "${locale}"
description: "${description.replace(/"/g, '\\"')}"
tags: [${finalTags.map((t) => `"${t}"`).join(', ')}]
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
    const { data } = matter(raw);
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
    const { data } = matter(raw);
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
  const primarySource = topic.sourceUrl
    ? createVerifiedSource(topic.sourceUrl, topic.sourceName || 'Source')
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
    ...trustedSources.map(s => `- ${s.icon} [${s.title}](${s.url})`),
  ].join('\n');

  return cleaned + sourcesSection;
}

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith('--id='));
  const targetIds = idArg
    ? idArg
        .split('=')[1]
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];
  const force = args.includes('--force');

  console.log('\n' + '═'.repeat(60));
  console.log('  Article Writing Pipeline');
  console.log('  Writing articles from researched topics');
  console.log('═'.repeat(60) + '\n');

  // Ensure directories exist
  if (!existsSync(RESEARCHED_DIR)) {
    console.log('❌ No researched topics found. Run `pnpm research-topic` first.');
    process.exit(1);
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
      const published = JSON.parse(readFileSync(join(PUBLISHED_DIR, file), 'utf-8'));
      publishedIds.add(published.topicId);
    }
  }

  // Get publishable topics
  const researchedFiles = readdirSync(RESEARCHED_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._'))
    .map(f => {
      const topic = JSON.parse(readFileSync(join(RESEARCHED_DIR, f), 'utf-8')) as ResearchedTopic;
      return { file: f, topic };
    })
    .filter(({ topic }) => {
      const matchesTarget =
        targetIds.length === 0 ||
        targetIds.includes(topic.topicId) ||
        targetIds.includes(topic.sourceId);
      if (!matchesTarget) return false;
      if (!isPublishable(topic)) return false;
      if (force) return true;
      return !publishedIds.has(topic.topicId);
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
    console.log(`📋 Topic: "${topic.title}"`);
    console.log(`   Confidence: ${Math.round(topic.overallConfidence * 100)}%`);

    try {
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
      let articleKo = await writeArticle(topic);
      articleKo = await polishArticleMarkdown('ko', articleKo);
      articleKo = appendSources('ko', articleKo, topic);

      // Generate metadata
      console.log('   📰 Generating metadata...');
      const metadata = await generateMetadata(articleKo);

      // Translate to English
      console.log('   🌐 Translating to English...');
      const translated = await translateToEnglish(metadata.title_ko, articleKo);
      let articleEn = translated.content_en;
      articleEn = await polishArticleMarkdown('en', articleEn);
      articleEn = normalizeEnTldr(articleEn);
      articleEn = appendSources('en', articleEn, topic);

      const sourceId = String(topic.sourceId || '');
      const existingSlug =
        (sourceId ? findExistingSlugBySourceId(koDir, sourceId) : null) ||
        (sourceId ? findExistingSlugBySourceId(enDir, sourceId) : null);
      const slug = existingSlug || metadata.slug;
      const coverImagePath = getExistingCoverImage(slug);

      // Generate frontmatter
      const frontmatterKo = generateFrontmatter(metadata, topic, 'ko', slug, articleKo, coverImagePath || undefined);
      const frontmatterEn = generateFrontmatter(metadata, topic, 'en', slug, articleEn, coverImagePath || undefined);

      // Write files
      const koFile = join(koDir, `${slug}.mdx`);
      const enFile = join(enDir, `${slug}.mdx`);

      writeFileSync(koFile, `${frontmatterKo}\n\n${articleKo}\n`);
      writeFileSync(enFile, `${frontmatterEn}\n\n${articleEn}\n`);

      console.log(`   ✅ Created: ${slug}.mdx`);
      writtenFiles.push(koFile, enFile);

      if (sourceId) {
        removeDuplicatePostsBySourceId(enDir, sourceId, slug);
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
        files: [koFile, enFile],
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
