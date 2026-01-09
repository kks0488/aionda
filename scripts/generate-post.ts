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
  const description = content
    .replace(/^#+\s.*$/gm, '') // Remove headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove link syntax
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 160);
  const verificationScore = post.verification?.summary?.overallScore || 0.5;

  // Extract tags from content
  const tagMatches =
    content
      .toLowerCase()
      .match(/gpt|claude|gemini|llama|openai|anthropic|xai|grok|lmarena/gi) ||
    [];
  const tags = [
    post.category?.toLowerCase(),
    structured.type,
    ...new Set(tagMatches),
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
  const content = locale === 'en' ? structured.content_en : structured.content_ko;

  return `${frontmatter}
${content}
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

  for (const file of files) {
    const postId = file.replace('.json', '');
    console.log(`Post ${postId}:`);

    const post = JSON.parse(
      readFileSync(join(VERIFIED_DIR, file), 'utf-8')
    ) as VerifiedPost;

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
  }

  console.log('Done! MDX files created in apps/web/content/posts/');
  console.log('Next step: Run `npm run dev` to preview the blog.');
}

main().catch(console.error);
