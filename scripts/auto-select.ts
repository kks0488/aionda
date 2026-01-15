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
  content?: string;
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
  'arxiv', 'paper', '논문', 'github', '공식', 'documentation', 'whitepaper',
];

// Keywords that indicate low-quality content
const TRASH_KEYWORDS = [
  '광고', '홍보', '도배', '구독', '좋아요',
  'ㅋㅋㅋㅋㅋ', 'ㅋㅋ', 'ㅎㅎㅎㅎ', 'ㅎㅎ', 'ㅠㅠ', 'ㅜㅜ', ';;;', '....',
  'ㄷㄷ', 'ㅇㅇ', 'ㅁㄴㅇ',
  '질문', '물어봄', '궁금', '어떻게', '왜?',
  '잡담', '수다', '심심', '놀아',
  '야동', '성인', '불법', '토렌트',
  '코인', '비트', '이더', '투자', '수익률',
];

// Minimum content length to be considered a valid article (not chat message)
const MIN_CONTENT_LENGTH = 750;
const MIN_TITLE_LENGTH = 8;
const MIN_SUBSTANCE_CHARS = 250;
const MIN_LENGTH_WITHOUT_URL = 1000;
const MIN_QUALITY_KEYWORD_HITS = 2;
const HIGH_ENGAGEMENT_VIEWS = 200;
const HIGH_ENGAGEMENT_LIKES = 10;
const EXTERNAL_URL_PATTERN = /(https?:\/\/|www\.)\S+/gi;
const LOW_SIGNAL_TITLE_PATTERN = /^[\sㅋㅎㅠㅜㄷㄱ!?~.]+$/;
const CHATTER_PATTERN = /(ㅋㅋ|ㅎㅎ|ㅠㅠ|ㅜㅜ|;;+|~{2,}|\.{3,}|\?{3,}|!{3,}|ㅇㅇ|ㄷㄷ)/;

// Titles that indicate garbage posts
const GARBAGE_TITLES = [
  '제목 없음',
  '무제',
  'ㅇㅇ',
  'ㄱㄱ',
  '.',
  '..',
  '...',
];

const MAX_AGE_DAYS = 14;

// Check if content is a meaningful article, not just a chat message
function isValidArticle(post: RawPost): { valid: boolean; reason?: string } {
  const content = post.contentText || '';
  const rawContent = post.content || '';
  const title = post.title?.trim() || '';
  const combined = `${title} ${content}`.toLowerCase();

  // Freshness check
  if (post.date) {
    try {
      const postDate = new Date(post.date.replace(/\./g, '-'));
      const now = new Date();
      const ageInDays = (now.getTime() - postDate.getTime()) / (1000 * 3600 * 24);
      
      if (ageInDays > MAX_AGE_DAYS) {
        return { valid: false, reason: `stale_content: ${Math.round(ageInDays)} days old (max: ${MAX_AGE_DAYS})` };
      }
    } catch (e) {
      console.warn(`⚠️ Failed to parse date: ${post.date}`);
    }
  }

  // Check for garbage title
  if (!title || GARBAGE_TITLES.some((gt) => title === gt)) {
    return { valid: false, reason: `garbage_title: "${title}"` };
  }

  if (title.length < MIN_TITLE_LENGTH) {
    return { valid: false, reason: `short_title: "${title}"` };
  }

  if (LOW_SIGNAL_TITLE_PATTERN.test(title)) {
    return { valid: false, reason: `low_signal_title: "${title}"` };
  }

  // Check minimum content length (long-form minimum for an article)
  if (content.length < MIN_CONTENT_LENGTH) {
    return { valid: false, reason: `too_short: ${content.length} chars (min: ${MIN_CONTENT_LENGTH})` };
  }

  // Check if content has multiple sentences/paragraphs (not just one-liner)
  const sentences = content.split(/[.!?]\s+/).filter((s) => s.trim().length > 10);
  if (sentences.length < 2) {
    return { valid: false, reason: `single_sentence: only ${sentences.length} valid sentence(s)` };
  }

  // Check if content has substance (not just emoticons/symbols)
  const textOnly = content.replace(/[ㅋㅎㄷㄱㅠㅜ\s\.\!\?\~\;\:\(\)\[\]]/g, '');
  if (textOnly.length < MIN_SUBSTANCE_CHARS) {
    return { valid: false, reason: `no_substance: only ${textOnly.length} meaningful chars` };
  }

  const noiseChars = (content.match(/[ㅋㅎㅠㅜ~!?]/g) || []).length;
  if (content.length > 0) {
    const noiseRatio = noiseChars / content.length;
    if (noiseRatio > 0.18 && content.length < 1500) {
      return { valid: false, reason: `noisy_content: ${(noiseRatio * 100).toFixed(0)}% noise` };
    }
  }

  if (CHATTER_PATTERN.test(title) && content.length < MIN_LENGTH_WITHOUT_URL) {
    return { valid: false, reason: `chatter_title: "${title}"` };
  }

  const externalUrlCount = countExternalUrls(`${rawContent}\n${content}`);
  if (externalUrlCount === 0) {
    const keywordHits = countKeywordHits(combined);
    const highEngagement = post.views >= HIGH_ENGAGEMENT_VIEWS || post.likes >= HIGH_ENGAGEMENT_LIKES;
    const longForm = content.length >= MIN_LENGTH_WITHOUT_URL;
    if (!highEngagement && !(longForm && keywordHits >= MIN_QUALITY_KEYWORD_HITS)) {
      return { valid: false, reason: 'no_external_url' };
    }
  }

  return { valid: true };
}

function countExternalUrls(text: string): number {
  return (text.match(EXTERNAL_URL_PATTERN) || []).length;
}

function countKeywordHits(text: string): number {
  return QUALITY_KEYWORDS.reduce((acc, keyword) => (
    text.includes(keyword.toLowerCase()) ? acc + 1 : acc
  ), 0);
}

function calculateQualityScore(post: RawPost): number {
  let score = 0;
  const title = post.title.toLowerCase();
  const content = (post.contentText || '').toLowerCase();
  const combined = title + ' ' + content;
  const externalUrlCount = countExternalUrls(`${post.content || ''}\n${post.contentText || ''}`);

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

  // External URL bonus
  score += externalUrlCount > 0 ? 10 : -10;

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
const minScore = parseInt(process.env.MIN_QUALITY_SCORE || '45');
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
  const allPosts = rawFiles.map((f) => {
    const content = readFileSync(join(RAW_DIR, f), 'utf-8');
    const post = JSON.parse(content) as RawPost;
    return {
      ...post,
      qualityScore: calculateQualityScore(post),
      validation: isValidArticle(post),
    };
  });

  // Filter out invalid articles first, then apply other filters
  const scoredPosts = allPosts
    .filter((p) => {
      if (!p.validation.valid) {
        console.log(`🚫 [Invalid] ${p.id} - ${p.validation.reason}`);
        return false;
      }
      return true;
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
