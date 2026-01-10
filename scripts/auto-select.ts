import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isAvailable, claimWork } from './lib/work-queue';
import { checkDuplicate } from './lib/similarity';

const RAW_DIR = './data/raw';
const SELECTED_DIR = './data/selected';

interface RawPost {
  id: string;
  title: string;
  category: string;
  author: string;
  views: number;
  likes: number;
  date: string;
  contentText?: string;
}

// Quality keywords that indicate valuable content
const QUALITY_KEYWORDS = [
  'ai', 'gpt', 'llm', 'claude', 'openai', 'anthropic', 'deepseek', 'gemini',
  '딥러닝', '머신러닝', '인공지능', '언어모델', '챗봇', 'chatgpt',
  'nvidia', 'cuda', 'transformer', '트랜스포머',
  'agi', 'asi', '특이점', 'singularity',
  'grok', 'xai', 'llama', 'mistral', 'copilot',
  '뉴럴', 'neural', '파라미터', 'parameter',
  '출시', '발표', '공개', '업데이트', 'release', 'launch',
  '벤치마크', 'benchmark', '성능', 'performance',
];

// Keywords that indicate low-quality content
const TRASH_KEYWORDS = [
  '광고', '홍보', '도배', '구독', '좋아요',
  'ㅋㅋㅋㅋㅋ', 'ㅎㅎㅎㅎ', ';;;', '....',
  '질문', '물어봄', '궁금', '어떻게', '왜?',
  '잡담', '수다', '심심', '놀아',
  '야동', '성인', '불법', '토렌트',
  '코인', '비트', '이더', '투자', '수익률',
];

function calculateQualityScore(post: RawPost): number {
  let score = 0;
  const title = post.title.toLowerCase();
  const content = (post.contentText || '').toLowerCase();
  const combined = title + ' ' + content;

  // Base score from engagement
  score += Math.min(post.views / 50, 20); // Max 20 points from views
  score += Math.min(post.likes * 2, 20); // Max 20 points from likes

  // Quality keywords boost
  for (const keyword of QUALITY_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      score += 5;
    }
  }

  // Trash keywords penalty
  for (const keyword of TRASH_KEYWORDS) {
    if (combined.includes(keyword.toLowerCase())) {
      score -= 15;
    }
  }

  // Category bonus
  if (post.category?.includes('정보') || post.category?.includes('뉴스')) {
    score += 10;
  }

  // Title length penalty (too short = probably garbage)
  if (post.title.length < 10) {
    score -= 20;
  }

  // Content length bonus
  if (post.contentText && post.contentText.length > 200) {
    score += 10;
  }

  return score;
}

async function main() {
  const minScore = parseInt(process.env.MIN_QUALITY_SCORE || '30');
  const maxPosts = parseInt(process.env.MAX_POSTS || '5');

  console.log(`🔍 Auto-selecting posts with min score: ${minScore}, max: ${maxPosts}`);

  if (!existsSync(RAW_DIR)) {
    console.log('❌ No raw posts found. Run crawl first.');
    process.exit(1);
  }

  if (!existsSync(SELECTED_DIR)) {
    mkdirSync(SELECTED_DIR, { recursive: true });
  }

  // Get existing selected IDs
  const selectedIds = new Set(
    existsSync(SELECTED_DIR)
      ? readdirSync(SELECTED_DIR)
          .filter((f) => f.endsWith('.json'))
          .map((f) => f.replace('.json', ''))
      : []
  );

  // Load and score raw posts
  const rawFiles = readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'));
  const scoredPosts = rawFiles
    .map((f) => {
      const content = readFileSync(join(RAW_DIR, f), 'utf-8');
      const post = JSON.parse(content) as RawPost;
      return {
        ...post,
        qualityScore: calculateQualityScore(post),
      };
    })
    .filter((p) => !selectedIds.has(p.id))
    .filter((p) => p.qualityScore >= minScore)
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, maxPosts);

  if (scoredPosts.length === 0) {
    console.log('✅ No quality posts found meeting criteria.');
    process.exit(0);
  }

  console.log(`\n📋 Found ${scoredPosts.length} quality posts:\n`);

  let selected = 0;
  for (const post of scoredPosts) {
    // work-queue 체크: 다른 작업자가 이미 처리 중인지 확인
    if (!isAvailable(post.id)) {
      console.log(`⏭️ [Skip] ${post.id} - 이미 작업 중이거나 완료됨`);
      continue;
    }

    // similarity 체크: 기존 포스트와 유사한지 확인
    const duplicate = checkDuplicate(post.title, []);
    if (duplicate) {
      console.log(`⏭️ [Skip] ${post.id} - 유사 포스트 존재: ${duplicate.slug} (${(duplicate.similarity * 100).toFixed(0)}%)`);
      continue;
    }

    const srcPath = join(RAW_DIR, `${post.id}.json`);
    const destPath = join(SELECTED_DIR, `${post.id}.json`);

    const content = JSON.parse(readFileSync(srcPath, 'utf-8'));
    content.selectedAt = new Date().toISOString();
    content.selectedBy = 'auto';
    content.qualityScore = post.qualityScore;

    // work-queue에 등록
    claimWork(post.id, 'crawler', 'auto-select');

    writeFileSync(destPath, JSON.stringify(content, null, 2));
    console.log(`✅ [Score: ${post.qualityScore}] ${post.id} - ${post.title.substring(0, 50)}`);
    selected++;
  }

  console.log(`\n✨ ${selected} post(s) auto-selected to data/selected/`);
}

main().catch(console.error);
