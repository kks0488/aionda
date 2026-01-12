/**
 * Research topics using SearchMode protocol
 *
 * Pipeline: crawl → extract-topics → research-topic → write-article
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { generateContent, searchAndVerify } from './lib/gemini.js';
import {
  formatVerificationHeader,
  getSystemMode,
  classifySource,
  getTierIcon,
  type VerifiedSource,
} from './lib/search-mode.js';
import { RESEARCH_QUESTION_PROMPT } from './prompts/topics';

config({ path: '.env.local' });

const TOPICS_DIR = './data/topics';
const RESEARCHED_DIR = './data/researched';

// Minimum confidence to consider research valid
const MIN_CONFIDENCE = 0.6;
const TRUSTED_SOURCE_HINTS =
  'site:.gov OR site:.go.kr OR site:.edu OR site:.ac.kr OR site:arxiv.org OR site:ncbi.nlm.nih.gov OR site:tsmc.com OR site:nvidia.com OR site:thekurzweillibrary.com OR site:klri.re.kr OR site:scourt.go.kr OR site:law.go.kr';

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

async function researchQuestion(question: string): Promise<ResearchFinding> {
  console.log(`    🔍 Researching: "${question.substring(0, 50)}..."`);

  try {
    // Use searchAndVerify which integrates SearchMode
    const searchResult = await searchAndVerify(question);

    const buildSources = (result: Array<{ url: string; title?: string }> = []) => {
      const sources: VerifiedSource[] = [];
      for (const src of result) {
        const tier = classifySource(src.url);
        sources.push({
          url: src.url,
          title: src.title || 'Untitled',
          tier,
          domain: new URL(src.url).hostname,
          icon: getTierIcon(tier),
        });
      }
      return sources;
    };

    let sources = buildSources(searchResult.sources || []);
    let trustedSources = sources.filter((s) => s.tier === 'S' || s.tier === 'A');
    let answer = searchResult.answer || 'No answer found';
    let confidence = searchResult.confidence || 0;
    let unverified = searchResult.unverified || [];

    if (trustedSources.length === 0) {
      console.log('       ↻ Retrying with trusted-source filters...');
      const retryResult = await searchAndVerify(`${question} ${TRUSTED_SOURCE_HINTS}`);
      const retrySources = buildSources(retryResult.sources || []);
      const retryTrusted = retrySources.filter((s) => s.tier === 'S' || s.tier === 'A');

      if (retryTrusted.length > 0) {
        sources = retrySources;
        trustedSources = retryTrusted;
        answer = retryResult.answer || answer;
        confidence = retryResult.confidence || confidence;
        unverified = retryResult.unverified || unverified;
      }
    }

    sources = trustedSources;

    // Log tier distribution
    const tierCounts = { S: 0, A: 0, B: 0, C: 0 };
    sources.forEach(s => tierCounts[s.tier]++);
    const tierInfo = Object.entries(tierCounts)
      .filter(([, count]) => count > 0)
      .map(([tier, count]) => `${tier}:${count}`)
      .join(' ');

    console.log(`       Confidence: ${Math.round(searchResult.confidence * 100)}% | Sources: ${sources.length} (${tierInfo})`);

    return {
      question,
      answer,
      confidence,
      sources,
      unverified,
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

  for (const question of topic.researchQuestions) {
    const finding = await researchQuestion(question);
    findings.push(finding);

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Calculate overall confidence
  const avgConfidence = findings.length > 0
    ? findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length
    : 0;

  // Require at least one trusted source (S/A) per question
  const hasTrustedPerQuestion = findings.length > 0 && findings.every(
    (finding) => finding.sources.some((s) => s.tier === 'S' || s.tier === 'A')
  );

  const canPublish = avgConfidence >= MIN_CONFIDENCE && hasTrustedPerQuestion;

  return {
    topicId: topic.id,
    sourceId: topic.sourceId,
    sourceUrl: topic.sourceUrl,
    title: topic.title,
    description: topic.description,
    keyInsights: topic.keyInsights,
    findings,
    researchedAt: new Date().toISOString(),
    overallConfidence: Math.round(avgConfidence * 100) / 100,
    canPublish,
  };
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

  const header = formatVerificationHeader();
  const mode = getSystemMode();

  console.log('\n' + '═'.repeat(60));
  console.log('  Topic Research Pipeline (SearchMode)');
  console.log('  Protocol: REALITY_SYNC_KERNEL_V4_GUARD');
  console.log('═'.repeat(60));
  console.log(`\n${header}\n`);

  if (mode === 'offline') {
    console.log('⚠️ System is in OFFLINE mode. Research capabilities limited.');
  }

  // Ensure directories exist
  if (!existsSync(TOPICS_DIR)) {
    console.log('❌ No topics found. Run `pnpm extract-topics` first.');
    process.exit(1);
  }
  if (!existsSync(RESEARCHED_DIR)) mkdirSync(RESEARCHED_DIR, { recursive: true });

  // Get already researched topic IDs
  const researchedIds = new Set<string>();
  if (existsSync(RESEARCHED_DIR)) {
    for (const file of readdirSync(RESEARCHED_DIR).filter(f => f.endsWith('.json'))) {
      const researched = JSON.parse(readFileSync(join(RESEARCHED_DIR, file), 'utf-8'));
      researchedIds.add(researched.topicId);
    }
  }

  // Get topics to research
  const topicFiles = readdirSync(TOPICS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const topic = JSON.parse(readFileSync(join(TOPICS_DIR, f), 'utf-8')) as ExtractedTopic;
      return { file: f, topic };
    })
    .filter(({ topic }) => {
      const matchesTarget =
        targetIds.length === 0 ||
        targetIds.includes(topic.id) ||
        targetIds.includes(topic.sourceId);
      if (!matchesTarget) return false;
      if (force) return true;
      return !researchedIds.has(topic.id);
    });

  if (topicFiles.length === 0) {
    console.log('✅ All topics have been researched.');
    process.exit(0);
  }

  console.log(`📚 Found ${topicFiles.length} topic(s) to research\n`);

  let researched = 0;
  let publishable = 0;

  for (const { file, topic } of topicFiles) {
    const result = await researchTopic(topic);

    const resultFile = `${result.topicId}.json`;
    writeFileSync(join(RESEARCHED_DIR, resultFile), JSON.stringify(result, null, 2));

    console.log('\n' + '─'.repeat(50));
    console.log(`📊 Research Complete`);
    console.log(`   Overall Confidence: ${Math.round(result.overallConfidence * 100)}%`);
    console.log(`   Findings: ${result.findings.length}`);
    console.log(`   Can Publish: ${result.canPublish ? '✅ YES' : '❌ NO'}`);
    console.log('─'.repeat(50));

    researched++;
    if (result.canPublish) publishable++;
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✨ Done! Researched: ${researched}, Publishable: ${publishable}`);
  console.log('Next step: Run `pnpm write-article` to write articles.');
  console.log('═'.repeat(60));
}

main().catch(console.error);
