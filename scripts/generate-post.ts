import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'fs';
import { join } from 'path';
import { structureArticle } from './lib/structure';
import type { ArticleType } from './prompts/structure';

const VERIFIED_DIR = './data/verified';
const POSTS_DIR = './apps/web/content/posts';

// Quality validation constants
const MIN_CONTENT_LENGTH = 500;
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
    return { valid: false, reason: `too_short: ${content.length} chars (min: ${MIN_CONTENT_LENGTH})` };
  }

  // Check verification score (min 0.5)
  if (verificationScore < 0.5) {
    return { valid: false, reason: `low_verification: ${verificationScore} (min: 0.5)` };
  }

  // Check if content has multiple sentences (not just one-liner)
  const sentences = content.split(/[.!?]\s+/).filter((s) => s.trim().length > 10);
  if (sentences.length < 2) {
    return { valid: false, reason: `single_sentence: only ${sentences.length} valid sentence(s)` };
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

function generateFrontmatter(
  post: VerifiedPost,
  locale: 'en' | 'ko',
  structured: NonNullable<VerifiedPost['structured']>
): string {
  const isEnglish = locale === 'en';
  const title = isEnglish ? structured.title_en : structured.title_ko;
  const content = isEnglish ? structured.content_en : structured.content_ko;

  const slug =
    post.translation?.slug || generateSlug(structured.title_en || post.title);

  // Use AI-generated description if available, otherwise fallback to content excerpt
  const aiDescription = isEnglish ? structured.description_en : structured.description_ko;
  const fallbackDescription = content
    .replace(/^#+\s.*$/gm, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove link syntax
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, isEnglish ? 120 : 80);
  const description = aiDescription || fallbackDescription;

  const verificationScore = post.verification?.summary?.overallScore || 0.5;

  // Extract tags from content - AI models and category tags
  const contentLower = content.toLowerCase();
  const titleLower = title.toLowerCase();
  const combinedText = contentLower + ' ' + titleLower;

  // AI model tags
  const modelMatches =
    combinedText.match(/gpt|claude|gemini|llama|openai|anthropic|xai|grok|lmarena/gi) || [];

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

  const tags = [
    post.category?.toLowerCase(),
    structured.type,
    ...categoryTags,
    ...new Set(modelMatches.map(m => m.toLowerCase())),
  ].filter(Boolean);

  const otherLocale = isEnglish ? 'ko' : 'en';
  const coverImage = `/images/posts/${slug}.jpeg`;

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
coverImage: "${coverImage}"
---
`;
}

function generateMDX(
  post: VerifiedPost,
  locale: 'en' | 'ko',
  structured: NonNullable<VerifiedPost['structured']>
): string {
  const frontmatter = generateFrontmatter(post, locale, structured);
  let content = locale === 'en' ? structured.content_en : structured.content_ko;

  // Remove any AI-generated source lines (출처: or Source:)
  content = content.replace(/\n---\n출처:.*$/s, '');
  content = content.replace(/\n---\nSource:.*$/s, '');

  // Add source from verified post data
  const sourceLabel = locale === 'en' ? 'Source' : '출처';
  const sourceUrl = post.url;

  return `${frontmatter}
${content.trim()}

---
${sourceLabel}: ${sourceUrl}
`;
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

  console.log(`\nGenerating MDX for ${files.length} post(s)...\n`);

  let generated = 0;
  let skipped = 0;

  for (const file of files) {
    const postId = file.replace('.json', '');
    console.log(`Post ${postId}:`);

    const post = JSON.parse(
      readFileSync(join(VERIFIED_DIR, file), 'utf-8')
    ) as VerifiedPost;

    // Pre-validation (original title and content)
    const preValidation = isValidForPublishing(post);
    if (!preValidation.valid) {
      console.log(`  ❌ SKIPPED (pre): ${preValidation.reason}`);
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
      skipped++;
      continue;
    }

    const slug =
      post.translation?.slug || generateSlug(structured.title_en || post.title);

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
