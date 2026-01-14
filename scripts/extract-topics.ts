/**
 * Extract discussable topics from raw gallery posts
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { generateContent } from './lib/gemini';
import { EXTRACT_TOPIC_PROMPT } from './prompts/topics';

config({ path: '.env.local' });

const RAW_DIR = './data/raw';
const TOPICS_DIR = './data/topics';
const PUBLISHED_DIR = './data/published';

// Minimum content length to consider
const MIN_CONTENT_LENGTH = parseInt(process.env.MIN_CONTENT_LENGTH || '300', 10);

// Maximum topics to extract per run
const MAX_TOPICS = parseInt(process.env.MAX_TOPICS || '3');

interface RawPost {
  id: string;
  title: string;
  contentText: string;
  date: string;
  views: number;
  likes: number;
  url: string;
}

interface ExtractedTopic {
  id: string;
  sourceId: string;
  sourceUrl: string;
  sourceDate: string;
  title: string;
  description: string;
  keyInsights: string[];
  researchQuestions: string[];
  extractedAt: string;
}

async function extractTopicFromPost(post: RawPost): Promise<ExtractedTopic | null> {
  const prompt = EXTRACT_TOPIC_PROMPT.replace('{content}', post.contentText.substring(0, 4000));

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      console.log('    ⚠️ Failed to parse response');
      return null;
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.worthDiscussing) {
      console.log(`    ❌ Not worth discussing: ${result.reason}`);
      return null;
    }

    const topic = result.topic;
    if (!topic || !topic.title || !topic.researchQuestions?.length) {
      console.log('    ⚠️ Invalid topic structure');
      return null;
    }

    return {
      id: `topic-${Date.now()}-${post.id}`,
      sourceId: post.id,
      sourceUrl: post.url,
      sourceDate: post.date,
      title: topic.title,
      description: topic.description || '',
      keyInsights: topic.keyInsights || [],
      researchQuestions: topic.researchQuestions,
      extractedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('    ❌ Error extracting topic:', error);
    return null;
  }
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  Topic Extraction Pipeline');
  console.log('  Reading gallery posts and extracting discussable topics');
  console.log('═'.repeat(60) + '\n');

  // Ensure directories exist
  if (!existsSync(RAW_DIR)) {
    console.log('❌ No raw posts found. Run `pnpm crawl` first.');
    process.exit(1);
  }
  if (!existsSync(TOPICS_DIR)) mkdirSync(TOPICS_DIR, { recursive: true });
  if (!existsSync(PUBLISHED_DIR)) mkdirSync(PUBLISHED_DIR, { recursive: true });

  // Get already processed source IDs
  const processedSourceIds = new Set<string>();

  // From topics
  if (existsSync(TOPICS_DIR)) {
    for (const file of readdirSync(TOPICS_DIR).filter(f => f.endsWith('.json'))) {
      const topic = JSON.parse(readFileSync(join(TOPICS_DIR, file), 'utf-8'));
      processedSourceIds.add(topic.sourceId);
    }
  }

  // From published
  if (existsSync(PUBLISHED_DIR)) {
    for (const file of readdirSync(PUBLISHED_DIR).filter(f => f.endsWith('.json'))) {
      const published = JSON.parse(readFileSync(join(PUBLISHED_DIR, file), 'utf-8'));
      processedSourceIds.add(published.sourceId);
    }
  }

  // Get raw posts sorted by date (newest first)
  const rawFiles = readdirSync(RAW_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const post = JSON.parse(readFileSync(join(RAW_DIR, f), 'utf-8')) as RawPost;
      return { file: f, post };
    })
    .filter(({ post }) => {
      // Skip already processed
      if (processedSourceIds.has(post.id)) return false;
      // Skip too short
      if ((post.contentText?.length || 0) < MIN_CONTENT_LENGTH) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort by date (newest first), then by views
      const dateA = new Date(a.post.date || '2000-01-01');
      const dateB = new Date(b.post.date || '2000-01-01');
      if (dateB.getTime() !== dateA.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return (b.post.views || 0) - (a.post.views || 0);
    });

  if (rawFiles.length === 0) {
    console.log('✅ No new posts to process.');
    process.exit(0);
  }

  console.log(`📚 Found ${rawFiles.length} unprocessed posts\n`);
  console.log(`🎯 Extracting up to ${MAX_TOPICS} topics...\n`);

  let extracted = 0;

  for (const { file, post } of rawFiles) {
    if (extracted >= MAX_TOPICS) break;

    console.log(`📋 Post ${post.id}: "${post.title?.substring(0, 40)}..."`);
    console.log(`   Views: ${post.views}, Likes: ${post.likes}`);

    const topic = await extractTopicFromPost(post);

    if (topic) {
      const topicFile = `${topic.id}.json`;
      writeFileSync(join(TOPICS_DIR, topicFile), JSON.stringify(topic, null, 2));

      console.log(`   ✅ Topic extracted: "${topic.title}"`);
      console.log(`   📝 Research questions: ${topic.researchQuestions.length}`);
      extracted++;
    }

    console.log('');

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('═'.repeat(60));
  console.log(`✨ Done! Extracted ${extracted} topic(s)`);
  console.log('Next step: Run `pnpm research-topic` to research the topics.');
  console.log('═'.repeat(60));
}

main().catch(console.error);
