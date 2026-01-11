import {
  readdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { structureArticle } from './lib/structure';
import type { ArticleType } from './prompts/structure';

const VERIFIED_DIR = './data/verified';
const POSTS_DIR = './apps/web/content/posts';
const ENABLE_COVER_IMAGES = process.env.ENABLE_COVER_IMAGES !== 'false';

// Quality validation constants
const MIN_CONTENT_LENGTH = 650;
const MIN_CONTENT_LENGTH_HARD = 550;
const MIN_VERIFICATION_FOR_SHORT = 0.8;
const MIN_VERIFICATION_SCORE = 0.7;
const MIN_SENTENCE_COUNT = 3;
const MIN_PARAGRAPH_COUNT = 2;
const MIN_LENGTH_SINGLE_PARAGRAPH = 1800;
const MIN_VERIFICATION_SINGLE_PARAGRAPH = 0.8;
const MIN_LENGTH_NO_URL = 1200;
const MIN_VERIFICATION_NO_URL = 0.75;
const MAX_OPINION_POSTS = parseInt(process.env.MAX_OPINION_POSTS || '1');
const GARBAGE_TITLES = ['제목 없음', '무제', 'ㅇㅇ', 'ㄱㄱ', '.', '..', '...', 'Untitled'];

// Final quality check before generating MDX
// CRITICAL: Now checks BOTH original title AND structured title
function isValidForPublishing(
  post: VerifiedPost,
  structured?: NonNullable<VerifiedPost['structured']>
): { valid: boolean; reason?: string } {
  const content = post.contentText || '';
  const originalTitle = post.title?.trim() || '';
  const verificationScore = post.verification?.summary?.overallScore || 0;

  // Check original title for garbage
  if (!originalTitle || GARBAGE_TITLES.some((gt) => originalTitle === gt)) {
    return { valid: false, reason: `garbage_original_title: "${originalTitle}"` };
  }

  // CRITICAL: Also check structured titles if available
  if (structured) {
    const structuredKo = structured.title_ko?.trim() || '';
    const structuredEn = structured.title_en?.trim() || '';

    if (GARBAGE_TITLES.some((gt) => structuredKo === gt)) {
      return { valid: false, reason: `garbage_structured_title_ko: "${structuredKo}"` };
    }
    if (GARBAGE_TITLES.some((gt) => structuredEn === gt)) {
      return { valid: false, reason: `garbage_structured_title_en: "${structuredEn}"` };
    }
    if (!structuredKo || !structuredEn) {
      return { valid: false, reason: `empty_structured_title: ko="${structuredKo}", en="${structuredEn}"` };
    }
  }

  // Check minimum content length
  if (content.length < MIN_CONTENT_LENGTH) {
    if (content.length < MIN_CONTENT_LENGTH_HARD || verificationScore < MIN_VERIFICATION_FOR_SHORT) {
      return { valid: false, reason: `too_short: ${content.length} chars (min: ${MIN_CONTENT_LENGTH})` };
    }
  }

  // Check verification score
  if (verificationScore < MIN_VERIFICATION_SCORE) {
    return {
      valid: false,
      reason: `low_verification: ${verificationScore} (min: ${MIN_VERIFICATION_SCORE})`,
    };
  }

  // Check if content has multiple sentences (not just one-liner)
  const sentences = content.split(/[.!?]\s+/).filter((s) => s.trim().length > 10);
  if (sentences.length < MIN_SENTENCE_COUNT) {
    return {
      valid: false,
      reason: `single_sentence: only ${sentences.length} valid sentence(s)`,
    };
  }

  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  if (
    paragraphs.length < MIN_PARAGRAPH_COUNT &&
    content.length < MIN_LENGTH_SINGLE_PARAGRAPH &&
    verificationScore < MIN_VERIFICATION_SINGLE_PARAGRAPH
  ) {
    return {
      valid: false,
      reason: `single_paragraph: only ${paragraphs.length} paragraph(s)`,
    };
  }

  const noiseChars = (content.match(/[ㅋㅎㅠㅜ~!?]/g) || []).length;
  if (content.length > 0) {
    const noiseRatio = noiseChars / content.length;
    if (noiseRatio > 0.15 && content.length < 2000) {
      return { valid: false, reason: `noisy_content: ${(noiseRatio * 100).toFixed(0)}% noise` };
    }
  }

  const hasExternalUrl = /https?:\/\/|www\./i.test(content);
  if (!hasExternalUrl && verificationScore < MIN_VERIFICATION_NO_URL && content.length < MIN_LENGTH_NO_URL) {
    return { valid: false, reason: 'no_external_url' };
  }

  return { valid: true };
}

interface VerifiedPost {
  id: string;
  title: string;
  contentText: string;
  url: string;
  date: string;
  category: string;
  verification?: {
    summary: {
      overallScore: number;
    };
  };
  translation?: {
    title_en: string;
    title_ko: string;
    content_en: string;
    content_ko: string;
    slug: string;
  };
  structured?: {
    type: ArticleType;
    content_ko: string;
    content_en: string;
    title_ko: string;
    title_en: string;
    description_ko?: string;
    description_en?: string;
  };
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/-$/, '')
    .replace(/^-/, '');
}

const MIN_SLUG_LENGTH = 4;

function normalizeSlugCandidate(value?: string): string {
  if (!value) return '';
  return generateSlug(value);
}

function isUsableSlug(slug: string): boolean {
  if (!slug) return false;
  if (slug.length < MIN_SLUG_LENGTH) return false;
  if (/^\d+$/.test(slug)) return false;
  return true;
}

function selectSlug(
  post: VerifiedPost,
  structured: NonNullable<VerifiedPost['structured']>
): string {
  const translatedSlug = normalizeSlugCandidate(post.translation?.slug);
  const generatedSlug = generateSlug(structured.title_en || post.title || '');

  if (isUsableSlug(translatedSlug)) return translatedSlug;
  if (isUsableSlug(generatedSlug)) return generatedSlug;

  return post.id ? String(post.id) : generatedSlug || 'post';
}

const BRAND_REPLACEMENTS: Array<{ regex: RegExp; value: string }> = [
  { regex: /chat\s*gpt|chatgpt|챗gpt|챗지피티/gi, value: 'ChatGPT' },
  { regex: /gemini|제미나이|젬나이/gi, value: 'Gemini' },
];

const PROTECTED_PATTERNS = [/```[\s\S]*?```/g, /`[^`]*`/g, /https?:\/\/\S+/g, /www\.\S+/g];

function normalizeBrandTerms(text: string): string {
  if (!text) return text;
  const protectedSegments: string[] = [];
  let normalized = text;

  for (const pattern of PROTECTED_PATTERNS) {
    normalized = normalized.replace(pattern, (match) => {
      const index = protectedSegments.push(match) - 1;
      return `__PROTECTED_${index}__`;
    });
  }

  for (const { regex, value } of BRAND_REPLACEMENTS) {
    normalized = normalized.replace(regex, value);
  }

  normalized = normalized.replace(/__PROTECTED_(\d+)__/g, (_, index) => {
    return protectedSegments[Number(index)] || '';
  });

  return normalized;
}

function generateFrontmatter(
  post: VerifiedPost,
  locale: 'en' | 'ko',
  structured: NonNullable<VerifiedPost['structured']>
): string {
  const isEnglish = locale === 'en';
  const rawTitle = isEnglish ? structured.title_en : structured.title_ko;
  const content = isEnglish ? structured.content_en : structured.content_ko;
  const title = normalizeBrandTerms(rawTitle);

  const slug = selectSlug(post, structured);

  // Use AI-generated description if available, otherwise fallback to content excerpt
  const aiDescription = isEnglish ? structured.description_en : structured.description_ko;
  const fallbackDescription = content
    .replace(/^#+\s.*$/gm, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove link syntax
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, isEnglish ? 120 : 80);
  const description = normalizeBrandTerms(aiDescription || fallbackDescription);

  const verificationScore = post.verification?.summary?.overallScore || MIN_VERIFICATION_SCORE;

  // Extract tags from content - AI models and category tags
  const contentLower = content.toLowerCase();
  const titleLower = title.toLowerCase();
  const combinedText = contentLower + ' ' + titleLower;

  // AI model tags
  const MODEL_TAG_RULES: Array<{ tag: string; regex: RegExp }> = [
    { tag: 'chatgpt', regex: /chat\s*gpt|chatgpt|챗gpt|챗지피티/i },
    { tag: 'gpt', regex: /\bgpt\b|(?<!챗)(?<!챗\s)지피티/i },
    { tag: 'claude', regex: /claude|클로드/i },
    { tag: 'gemini', regex: /gemini|제미나이|젬나이/i },
    { tag: 'llama', regex: /llama|라마/i },
    { tag: 'openai', regex: /openai|오픈ai|오픈에이아이/i },
    { tag: 'anthropic', regex: /anthropic|앤트로픽/i },
    { tag: 'xai', regex: /xai|엑스ai|엑스에이아이/i },
    { tag: 'grok', regex: /grok|그록/i },
    { tag: 'lmarena', regex: /lmarena|lm arena/i },
  ];
  const modelTags = MODEL_TAG_RULES
    .filter(({ regex }) => regex.test(combinedText))
    .map(({ tag }) => tag);

  // Category tags based on content keywords
  const categoryTags: string[] = [];

  // AGI detection
  if (/agi|artificial general intelligence|superintelligence|초지능|범용.*인공지능/i.test(combinedText)) {
    categoryTags.push('agi');
  }

  // LLM detection
  if (/llm|language model|언어.*모델|대형언어|transformer|트랜스포머/i.test(combinedText)) {
    categoryTags.push('llm');
  }

  // Robotics detection
  if (/robot|로봇|humanoid|휴머노이드|boston dynamics|figure|자율주행/i.test(combinedText)) {
    categoryTags.push('robotics');
  }

  // Hardware detection
  if (/hardware|하드웨어|gpu|tpu|nvidia|chip|반도체|칩|blackwell|h100|b200/i.test(combinedText)) {
    categoryTags.push('hardware');
  }

  const CORE_TAGS = new Set(['agi', 'llm', 'hardware', 'news', 'opinion', 'robotics']);
  const TYPE_ALIASES: Record<string, string> = {
    analysis: 'opinion',
    commentary: 'opinion',
    review: 'opinion',
    essay: 'opinion',
    report: 'news',
    announcement: 'news',
    release: 'news',
    update: 'news',
  };

  const structuredType = structured.type ? structured.type.toLowerCase() : '';
  const rawTags = [
    post.category?.toLowerCase(),
    structuredType,
    ...categoryTags,
    ...modelTags,
  ].filter(Boolean);

  const coreTags: string[] = [];
  for (const tag of rawTags) {
    const normalized = String(tag).toLowerCase();
    if (CORE_TAGS.has(normalized)) coreTags.push(normalized);
    const alias = TYPE_ALIASES[normalized];
    if (alias) coreTags.push(alias);
  }

  const tags = [...new Set([...rawTags, ...coreTags])];

  const otherLocale = isEnglish ? 'ko' : 'en';
  const coverImage = ENABLE_COVER_IMAGES ? `/images/posts/${slug}.jpeg` : '';
  const coverImageLine = coverImage ? `coverImage: "${coverImage}"\n` : '';

  return `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
date: "${post.date || new Date().toISOString().split('T')[0]}"
locale: "${locale}"
description: "${description.replace(/"/g, '\\"')}"
tags: [${[...new Set(tags)].map((t) => `"${t}"`).join(', ')}]
author: "Singularity Blog"
sourceId: "${post.id}"
sourceUrl: "${post.url}"
verificationScore: ${verificationScore}
alternateLocale: "/${otherLocale}/posts/${slug}"
${coverImageLine}---
`;
}

function generateMDX(
  post: VerifiedPost,
  locale: 'en' | 'ko',
  structured: NonNullable<VerifiedPost['structured']>
): string {
  const frontmatter = generateFrontmatter(post, locale, structured);
  let content = locale === 'en' ? structured.content_en : structured.content_ko;

  // Remove any AI-generated source lines (출처: or Source:) from content
  // Source is displayed in the page footer via frontmatter sourceUrl
  content = content.replace(/\n---\n출처:.*$/s, '');
  content = content.replace(/\n---\nSource:.*$/s, '');
  content = content.replace(/\n+---\s*$/s, ''); // Remove trailing ---
  content = normalizeBrandTerms(content);

  return `${frontmatter}
${content.trim()}
`;
}

function removeDuplicatePostsBySourceId(
  localeDir: string,
  sourceId: string,
  keepSlug: string
) {
  const files = readdirSync(localeDir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  const removed: string[] = [];

  for (const file of files) {
    const fullPath = join(localeDir, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data } = matter(raw);
    const fileSourceId = data.sourceId ? String(data.sourceId) : '';
    if (!fileSourceId || fileSourceId !== sourceId) continue;

    const fileNameSlug = file.replace(/\.mdx?$/, '');
    const fileSlug = data.slug || fileNameSlug;
    if (fileSlug === keepSlug && fileNameSlug === keepSlug) continue;

    unlinkSync(fullPath);
    removed.push(file);
  }

  if (removed.length > 0) {
    console.log(`  🧹 Removed ${removed.length} duplicate post(s) for sourceId ${sourceId}`);
  }
}

function removePostsBySourceId(localeDir: string, sourceId: string) {
  const files = readdirSync(localeDir).filter((f) => f.endsWith('.mdx') || f.endsWith('.md'));
  const removed: string[] = [];

  for (const file of files) {
    const fullPath = join(localeDir, file);
    const raw = readFileSync(fullPath, 'utf-8');
    const { data } = matter(raw);
    const fileSourceId = data.sourceId ? String(data.sourceId) : '';
    if (!fileSourceId || fileSourceId !== sourceId) continue;

    unlinkSync(fullPath);
    removed.push(file);
  }

  if (removed.length > 0) {
    console.log(`  🧹 Removed ${removed.length} post(s) for sourceId ${sourceId}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith('--id='));
  const targetId = idArg ? idArg.split('=')[1] : undefined;
  const skipStructure = args.includes('--skip-structure');

  if (!existsSync(VERIFIED_DIR)) {
    console.log('No verified posts found. Run `npm run verify` first.');
    process.exit(1);
  }

  // Ensure output directories exist
  const enDir = join(POSTS_DIR, 'en');
  const koDir = join(POSTS_DIR, 'ko');
  if (!existsSync(enDir)) mkdirSync(enDir, { recursive: true });
  if (!existsSync(koDir)) mkdirSync(koDir, { recursive: true });

  let files = readdirSync(VERIFIED_DIR).filter((f) => f.endsWith('.json'));

  if (targetId) {
    files = files.filter((f) => f.replace('.json', '') === targetId);
    if (files.length === 0) {
      console.log(`Post ${targetId} not found in verified/`);
      process.exit(1);
    }
  }

  const fileEntries = files
    .map((file) => {
      const raw = readFileSync(join(VERIFIED_DIR, file), 'utf-8');
      const post = JSON.parse(raw) as VerifiedPost;
      return {
        file,
        post,
        verificationScore: post.verification?.summary?.overallScore || 0,
        contentLength: post.contentText ? post.contentText.length : 0,
      };
    })
    .sort((a, b) => {
      const scoreDiff = b.verificationScore - a.verificationScore;
      if (Math.abs(scoreDiff) < 0.05) {
        return b.contentLength - a.contentLength;
      }
      return scoreDiff;
    });

  console.log(`\nGenerating MDX for ${fileEntries.length} post(s)...\n`);

  let generated = 0;
  let skipped = 0;
  let opinionCount = 0;

  for (const entry of fileEntries) {
    const { file, post } = entry;
    const postId = file.replace('.json', '');
    console.log(`Post ${postId}:`);

    // Pre-validation (original title and content)
    const preValidation = isValidForPublishing(post);
    if (!preValidation.valid) {
      console.log(`  ❌ SKIPPED (pre): ${preValidation.reason}`);
      const sourceId = String(post.id || '');
      if (sourceId) {
        removePostsBySourceId(enDir, sourceId);
        removePostsBySourceId(koDir, sourceId);
      }
      skipped++;
      continue;
    }

    let structured: NonNullable<VerifiedPost['structured']>;

    if (skipStructure && post.structured) {
      // Use existing structured content
      console.log('  Using cached structure...');
      structured = post.structured;
    } else {
      // Run AI structuring pipeline
      console.log('  Running AI structuring pipeline...');
      structured = await structureArticle(post.contentText, post.title);

      // Cache structured content
      post.structured = structured;
      writeFileSync(join(VERIFIED_DIR, file), JSON.stringify(post, null, 2));
      console.log('  Cached structured content.');
    }

    // Post-validation (check structured titles too)
    const postValidation = isValidForPublishing(post, structured);
    if (!postValidation.valid) {
      console.log(`  ❌ SKIPPED (post): ${postValidation.reason}`);
      const sourceId = String(post.id || '');
      if (sourceId) {
        removePostsBySourceId(enDir, sourceId);
        removePostsBySourceId(koDir, sourceId);
      }
      skipped++;
      continue;
    }

    if (structured.type === 'opinion' && opinionCount >= MAX_OPINION_POSTS) {
      console.log(`  ❌ SKIPPED (opinion limit: ${MAX_OPINION_POSTS})`);
      const sourceId = String(post.id || '');
      if (sourceId) {
        removePostsBySourceId(enDir, sourceId);
        removePostsBySourceId(koDir, sourceId);
      }
      skipped++;
      continue;
    }

    const slug = selectSlug(post, structured);
    const sourceId = String(post.id || '');
    if (sourceId) {
      removeDuplicatePostsBySourceId(enDir, sourceId, slug);
      removeDuplicatePostsBySourceId(koDir, sourceId, slug);
    }
    if (structured.type === 'opinion') {
      opinionCount += 1;
    }

    // Generate English version
    const enContent = generateMDX(post, 'en', structured);
    writeFileSync(join(enDir, `${slug}.mdx`), enContent);
    console.log(`  Created: content/posts/en/${slug}.mdx`);

    // Generate Korean version
    const koContent = generateMDX(post, 'ko', structured);
    writeFileSync(join(koDir, `${slug}.mdx`), koContent);
    console.log(`  Created: content/posts/ko/${slug}.mdx`);
    console.log('');
    generated++;
  }

  console.log(`\n✅ Done! Generated: ${generated}, Skipped (low quality): ${skipped}`);
  console.log('MDX files created in apps/web/content/posts/');
  console.log('Next step: Run `npm run dev` to preview the blog.');
}

main().catch(console.error);
