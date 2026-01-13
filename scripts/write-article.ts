/**
 * Write articles based on researched topics
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { generateContent } from './lib/gemini.js';
import { translateStructured } from './lib/structure';
import { WRITE_ARTICLE_PROMPT, GENERATE_METADATA_PROMPT } from './prompts/topics';
import { checkBeforePublish, saveAfterPublish } from './lib/memu-client';
import matter from 'gray-matter';

config({ path: '.env.local' });

const RESEARCHED_DIR = './data/researched';
const PUBLISHED_DIR = './data/published';
const POSTS_DIR = './apps/web/content/posts';
const MIN_CONFIDENCE = 0.6;

interface VerifiedSource {
  url: string;
  title: string;
  tier: string;
  domain: string;
  icon: string;
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
  const usableFindings = findings.filter((finding) => finding.sources.length > 0);
  if (usableFindings.length === 0) return '';

  const lines: string[] = [];

  for (const finding of usableFindings) {
    lines.push(`### Q: ${finding.question}`);
    lines.push(`**A:** ${finding.answer}`);
    lines.push(`**Confidence:** ${Math.round(finding.confidence * 100)}%`);

    if (finding.sources.length > 0) {
      lines.push('**Sources:**');
      for (const src of finding.sources) {
        lines.push(`- ${src.icon} [${src.title}](${src.url})`);
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
  return topic.overallConfidence >= MIN_CONFIDENCE && hasTrustedOverall;
}

async function writeArticle(topic: ResearchedTopic): Promise<string> {
  const findingsText = formatFindings(topic.findings);

  const prompt = WRITE_ARTICLE_PROMPT
    .replace('{topic}', `${topic.title}\n${topic.description}\n\nKey Insights:\n${topic.keyInsights.map(i => `- ${i}`).join('\n')}`)
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

function generateFrontmatter(
  metadata: ArticleMetadata,
  topic: ResearchedTopic,
  locale: 'ko' | 'en',
  slug: string
): string {
  const isEnglish = locale === 'en';
  const title = isEnglish ? metadata.title_en : metadata.title_ko;
  const description = isEnglish ? metadata.description_en : metadata.description_ko;
  const otherLocale = isEnglish ? 'ko' : 'en';

  // Collect all sources for citation
  const allSources = topic.findings.flatMap(f => f.sources);
  const uniqueSources = [...new Map(allSources.map(s => [s.url, s])).values()];

return `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
date: "${new Date().toISOString().split('T')[0]}"
locale: "${locale}"
description: "${description.replace(/"/g, '\\"')}"
tags: [${metadata.tags.map(t => `"${t}"`).join(', ')}]
author: "AI온다"
sourceId: "${topic.sourceId}"
sourceUrl: "${topic.sourceUrl}"
verificationScore: ${topic.overallConfidence}
alternateLocale: "/${otherLocale}/posts/${slug}"
coverImage: "/images/posts/${slug}.jpeg"
---`;
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

function appendSources(content: string, topic: ResearchedTopic): string {
  const cleaned = stripInlineReferences(content);
  const allSources = topic.findings.flatMap(f => f.sources);
  const uniqueSources = [...new Map(allSources.map(s => [s.url, s])).values()];
  const trustedSources = uniqueSources.filter((s) => s.tier === 'S' || s.tier === 'A');

  if (trustedSources.length === 0) return cleaned;

  // Sort by tier
  const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
  trustedSources.sort((a, b) => (tierOrder[a.tier] || 3) - (tierOrder[b.tier] || 3));

  const sourcesSection = [
    '',
    '---',
    '',
    '## 참고 자료',
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
    process.exit(0);
  }

  console.log(`📚 Found ${researchedFiles.length} publishable topic(s)\n`);

  let written = 0;

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
      articleKo = appendSources(articleKo, topic);

      // Generate metadata
      console.log('   📰 Generating metadata...');
      const metadata = await generateMetadata(articleKo);

      // Translate to English
      console.log('   🌐 Translating to English...');
      let articleEn = await translateStructured(articleKo);
      articleEn = appendSources(articleEn, topic);

      const sourceId = String(topic.sourceId || '');
      const existingSlug =
        (sourceId ? findExistingSlugBySourceId(koDir, sourceId) : null) ||
        (sourceId ? findExistingSlugBySourceId(enDir, sourceId) : null);
      const slug = existingSlug || metadata.slug;

      // Generate frontmatter
      const frontmatterKo = generateFrontmatter(metadata, topic, 'ko', slug);
      const frontmatterEn = generateFrontmatter(metadata, topic, 'en', slug);

      // Write files
      const koFile = join(koDir, `${slug}.mdx`);
      const enFile = join(enDir, `${slug}.mdx`);

      writeFileSync(koFile, `${frontmatterKo}\n\n${articleKo}\n`);
      writeFileSync(enFile, `${frontmatterEn}\n\n${articleEn}\n`);

      console.log(`   ✅ Created: ${slug}.mdx`);

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
}

main().catch(console.error);
