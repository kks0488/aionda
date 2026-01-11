/**
 * Write articles based on researched topics
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { generateContent } from './lib/gemini.js';
import { translateStructured } from './lib/structure';
import { WRITE_ARTICLE_PROMPT, GENERATE_METADATA_PROMPT } from './prompts/topics';

config({ path: '.env.local' });

const RESEARCHED_DIR = './data/researched';
const PUBLISHED_DIR = './data/published';
const POSTS_DIR = './apps/web/content/posts';

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
  const lines: string[] = [];

  for (const finding of findings) {
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
  locale: 'ko' | 'en'
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
slug: "${metadata.slug}"
date: "${new Date().toISOString().split('T')[0]}"
locale: "${locale}"
description: "${description.replace(/"/g, '\\"')}"
tags: [${metadata.tags.map(t => `"${t}"`).join(', ')}]
author: "AI온다"
sourceId: "${topic.sourceId}"
sourceUrl: "${topic.sourceUrl}"
verificationScore: ${topic.overallConfidence}
alternateLocale: "/${otherLocale}/posts/${metadata.slug}"
coverImage: "/images/posts/${metadata.slug}.jpeg"
---`;
}

function appendSources(content: string, topic: ResearchedTopic): string {
  const allSources = topic.findings.flatMap(f => f.sources);
  const uniqueSources = [...new Map(allSources.map(s => [s.url, s])).values()];

  if (uniqueSources.length === 0) return content;

  // Sort by tier
  const tierOrder: Record<string, number> = { S: 0, A: 1, B: 2, C: 3 };
  uniqueSources.sort((a, b) => (tierOrder[a.tier] || 3) - (tierOrder[b.tier] || 3));

  const sourcesSection = [
    '',
    '---',
    '',
    '## 참고 자료',
    '',
    ...uniqueSources.map(s => `- ${s.icon} [${s.title}](${s.url})`),
  ].join('\n');

  return content + sourcesSection;
}

async function main() {
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
    for (const file of readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'))) {
      const published = JSON.parse(readFileSync(join(PUBLISHED_DIR, file), 'utf-8'));
      publishedIds.add(published.topicId);
    }
  }

  // Get publishable topics
  const researchedFiles = readdirSync(RESEARCHED_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const topic = JSON.parse(readFileSync(join(RESEARCHED_DIR, f), 'utf-8')) as ResearchedTopic;
      return { file: f, topic };
    })
    .filter(({ topic }) => topic.canPublish && !publishedIds.has(topic.topicId));

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

      // Generate frontmatter
      const frontmatterKo = generateFrontmatter(metadata, topic, 'ko');
      const frontmatterEn = generateFrontmatter(metadata, topic, 'en');

      // Write files
      const koFile = join(koDir, `${metadata.slug}.mdx`);
      const enFile = join(enDir, `${metadata.slug}.mdx`);

      writeFileSync(koFile, `${frontmatterKo}\n\n${articleKo}\n`);
      writeFileSync(enFile, `${frontmatterEn}\n\n${articleEn}\n`);

      console.log(`   ✅ Created: ${metadata.slug}.mdx`);

      // Move to published
      const publishedData = {
        topicId: topic.topicId,
        sourceId: topic.sourceId,
        slug: metadata.slug,
        publishedAt: new Date().toISOString(),
      };
      writeFileSync(join(PUBLISHED_DIR, `${topic.topicId}.json`), JSON.stringify(publishedData, null, 2));

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
