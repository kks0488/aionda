/**
 * Research topics using DeepSeek Reasoner
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 *
 * Note: Gemini 제거됨. DeepSeek 지식 기반 리서치 사용.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { researchQuestion as deepseekResearch, verifyClaim } from './lib/deepseek';

config({ path: '.env.local' });

const TOPICS_DIR = './data/topics';
const RESEARCHED_DIR = './data/researched';

// Minimum confidence to consider research valid
const MIN_CONFIDENCE = 0.6;

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

async function researchQuestionWithDeepSeek(
  question: string,
  context: string
): Promise<ResearchFinding> {
  console.log(`    🔍 Researching: "${question.substring(0, 50)}..."`);

  try {
    const result = await deepseekResearch(question, context);

    // DeepSeek 지식 기반이므로 URL 출처 없음
    // keyFacts를 기반으로 가상의 소스 생성 (신뢰도 표시용)
    const sources: VerifiedSource[] = [];

    // 높은 신뢰도면 A 티어로 표시
    if (result.confidence >= 0.8) {
      sources.push({
        url: '#deepseek-knowledge',
        title: 'DeepSeek Knowledge Base',
        tier: 'A',
        domain: 'deepseek.com',
        icon: '🤖',
      });
    }

    console.log(`       Confidence: ${Math.round(result.confidence * 100)}% | Facts: ${result.keyFacts.length}`);

    return {
      question,
      answer: result.answer,
      confidence: result.confidence,
      sources,
      unverified: result.needsVerification,
    };
  } catch (error) {
    console.error(`       ❌ Research failed:`, error);
    return {
      question,
      answer: 'Research failed',
      confidence: 0,
      sources: [],
      unverified: [question],
    };
  }
}

async function researchTopic(topic: ExtractedTopic): Promise<ResearchedTopic> {
  console.log(`\n📋 Topic: "${topic.title}"`);
  console.log(`   Description: ${topic.description}`);
  console.log(`   Questions: ${topic.researchQuestions.length}\n`);

  const findings: ResearchFinding[] = [];
  const context = `${topic.title}\n${topic.description}\n${topic.keyInsights.join('\n')}`;

  for (const question of topic.researchQuestions) {
    const finding = await researchQuestionWithDeepSeek(question, context);
    findings.push(finding);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Calculate overall confidence
  const avgConfidence = findings.length > 0
    ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
    : 0;

  // 핵심 인사이트 검증
  console.log(`\n   🔬 Verifying key insights...`);
  let verifiedInsights = 0;
  for (const insight of topic.keyInsights.slice(0, 3)) {
    const verification = await verifyClaim(insight, context);
    if (verification.verified && verification.confidence >= 0.7) {
      verifiedInsights++;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const hasVerifiedContent = verifiedInsights > 0 || avgConfidence >= MIN_CONFIDENCE;

  console.log(`\n   📊 Summary:`);
  console.log(`      Average Confidence: ${Math.round(avgConfidence * 100)}%`);
  console.log(`      Verified Insights: ${verifiedInsights}/${Math.min(topic.keyInsights.length, 3)}`);
  console.log(`      Can Publish: ${hasVerifiedContent ? '✅' : '❌'}`);

  return {
    topicId: topic.id,
    sourceId: topic.sourceId,
    sourceUrl: topic.sourceUrl,
    title: topic.title,
    description: topic.description,
    keyInsights: topic.keyInsights,
    findings,
    researchedAt: new Date().toISOString(),
    overallConfidence: avgConfidence,
    canPublish: hasVerifiedContent,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const maxTopics = limitArg ? parseInt(limitArg.split('=')[1]) : 5;

  console.log('\n' + '═'.repeat(60));
  console.log('  Research Pipeline (DeepSeek Reasoner)');
  console.log('  Researching extracted topics');
  console.log('═'.repeat(60) + '\n');

  // Ensure directories exist
  if (!existsSync(TOPICS_DIR)) {
    console.log('❌ No topics found. Run `pnpm extract-topics` first.');
    process.exit(1);
  }
  if (!existsSync(RESEARCHED_DIR)) {
    mkdirSync(RESEARCHED_DIR, { recursive: true });
  }

  // Get already researched topics
  const researchedIds = new Set<string>();
  if (existsSync(RESEARCHED_DIR)) {
    for (const file of readdirSync(RESEARCHED_DIR).filter(f => f.endsWith('.json') && !f.startsWith('._'))) {
      const data = JSON.parse(readFileSync(join(RESEARCHED_DIR, file), 'utf-8'));
      researchedIds.add(data.topicId);
    }
  }

  // Get topics to research
  const topicFiles = readdirSync(TOPICS_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('._'))
    .map(f => {
      const topic = JSON.parse(readFileSync(join(TOPICS_DIR, f), 'utf-8')) as ExtractedTopic;
      return { file: f, topic };
    })
    .filter(({ topic }) => !researchedIds.has(topic.id))
    .slice(0, maxTopics);

  if (topicFiles.length === 0) {
    console.log('✅ No new topics to research.');
    process.exit(0);
  }

  console.log(`📚 Found ${topicFiles.length} topic(s) to research\n`);

  let researched = 0;
  let publishable = 0;

  for (const { file, topic } of topicFiles) {
    const result = await researchTopic(topic);

    // Save result
    writeFileSync(
      join(RESEARCHED_DIR, `${topic.id}.json`),
      JSON.stringify(result, null, 2)
    );

    researched++;
    if (result.canPublish) publishable++;

    // Rate limiting between topics
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✨ Done! Researched: ${researched} | Publishable: ${publishable}`);
  console.log('Next step: Run `pnpm write-article` to generate articles.');
  console.log('═'.repeat(60));
}

main().catch(console.error);
