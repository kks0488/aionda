/**
 * RSS Feed Crawler
 *
 * Fetches articles from official AI blogs and tech news sources
 *
 * Usage:
 *   pnpm crawl-rss                    # Fetch all sources
 *   pnpm crawl-rss --source=official  # Fetch only official blogs
 *   pnpm crawl-rss --source=news      # Fetch only news
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import Parser from 'rss-parser';

config({ path: '.env.local' });

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'AIOnda/1.0 (AI News Aggregator)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
  },
});

// Keep RSS ingestion bounded (some feeds include years of history).
const DEFAULT_RSS_SINCE = (process.env.RSS_SINCE || process.env.TOPICS_SINCE || '30d').trim();
const MAX_ITEMS_PER_FEED = (() => {
  const parsed = Number.parseInt(process.env.RSS_MAX_ITEMS || '200', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 200;
})();

// Data directories
const OFFICIAL_DIR = './data/official';
const NEWS_DIR = './data/news';

// Source tier definitions
type SourceTier = 'S' | 'A' | 'B' | 'C';
type SourceType = 'official' | 'news';

interface RSSSource {
  id: string;
  name: string;
  url: string;
  tier: SourceTier;
  type: SourceType;
  enabled: boolean;
}

// RSS feed sources
// Note: Some major AI companies don't provide official RSS feeds
const RSS_SOURCES: RSSSource[] = [
  // Official AI Company Blogs (Tier S)
  // Anthropic: No official RSS - would need web scraping
  // Meta AI: No reliable RSS endpoint found
  { id: 'openai', name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', tier: 'S', type: 'official', enabled: true },
  { id: 'google-ai-blog', name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', tier: 'S', type: 'official', enabled: true },
  { id: 'nvidia', name: 'Nvidia Blog', url: 'https://blogs.nvidia.com/feed/', tier: 'S', type: 'official', enabled: true },
  { id: 'deepmind', name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml', tier: 'S', type: 'official', enabled: true },
  { id: 'microsoft-ai', name: 'Microsoft AI Blog', url: 'https://blogs.microsoft.com/ai/feed/', tier: 'S', type: 'official', enabled: true },
  { id: 'huggingface', name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', tier: 'S', type: 'official', enabled: true },
  // Cloud + Security + Enterprise (sales-friendly, still filtered downstream)
  { id: 'aws-ml', name: 'AWS Machine Learning Blog', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', tier: 'S', type: 'official', enabled: true },
  { id: 'aws-security', name: 'AWS Security Blog', url: 'https://aws.amazon.com/blogs/security/feed/', tier: 'S', type: 'official', enabled: true },
  { id: 'aws-blog', name: 'AWS Official Blog', url: 'https://aws.amazon.com/blogs/aws/feed/', tier: 'A', type: 'official', enabled: true },
  { id: 'azure-blog', name: 'Microsoft Azure Blog', url: 'https://azure.microsoft.com/en-us/blog/feed/', tier: 'A', type: 'official', enabled: true },
  { id: 'cloudflare', name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/', tier: 'A', type: 'official', enabled: true },
  { id: 'google-security', name: 'Google Online Security Blog', url: 'https://feeds.feedburner.com/GoogleOnlineSecurityBlog', tier: 'A', type: 'official', enabled: true },
  { id: 'mandiant-ti', name: 'Google Threat Intelligence (Mandiant)', url: 'https://cloudblog.withgoogle.com/topics/threat-intelligence/rss/', tier: 'A', type: 'official', enabled: true },
  { id: 'crowdstrike', name: 'CrowdStrike Blog', url: 'https://www.crowdstrike.com/en-us/blog/feed', tier: 'A', type: 'official', enabled: true },

  // Korea tech/AI blogs (Tier A)
  { id: 'naver-d2', name: 'NAVER D2', url: 'https://d2.naver.com/d2.atom', tier: 'A', type: 'official', enabled: true },
  { id: 'kakao-tech', name: 'Kakao Tech', url: 'https://tech.kakao.com/feed/', tier: 'A', type: 'official', enabled: true },
  { id: 'toss-tech', name: 'Toss Tech', url: 'https://toss.tech/rss.xml', tier: 'A', type: 'official', enabled: true },
  { id: 'woowahan-tech', name: 'Woowahan Tech Blog', url: 'https://techblog.woowahan.com/feed/', tier: 'A', type: 'official', enabled: true },
  { id: 'gccompany-tech', name: 'GCCompany Tech Blog', url: 'https://techblog.gccompany.co.kr/feed', tier: 'A', type: 'official', enabled: true },
  { id: 'coupang-engineering', name: 'Coupang Engineering (Medium)', url: 'https://medium.com/feed/coupang-engineering', tier: 'A', type: 'official', enabled: true },

  // Tech News (Tier A)
  { id: 'techcrunch-ai', name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', tier: 'A', type: 'news', enabled: true },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', tier: 'A', type: 'news', enabled: true },
  { id: 'venturebeat-ai', name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', tier: 'A', type: 'news', enabled: true },
  { id: 'mit-tech-review', name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', tier: 'A', type: 'news', enabled: true },
  { id: 'wired-ai', name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss', tier: 'A', type: 'news', enabled: true },
  { id: 'zdnet-ai', name: 'ZDNet AI', url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml', tier: 'A', type: 'news', enabled: true },
];

interface FeedItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  sourceType: SourceType;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
  fetchedAt: string;
}

function getStartOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function parseSinceArg(raw?: string): Date | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  if (value === 'all') return null;
  if (value === 'today') return getStartOfTodayLocal();

  const relative = value.match(/^(\d+)\s*(h|d)$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseItemDate(item: FeedItem): Date | null {
  if (!item.pubDate) return null;
  const parsed = new Date(item.pubDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function generateItemId(sourceId: string, link: string): string {
  // Create a unique ID from source and link
  const hash = link.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `${sourceId}-${Math.abs(hash).toString(36)}`;
}

function getExistingIds(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();

  return new Set(
    readdirSync(dir)
      .filter(f => f.endsWith('.json') && !f.startsWith('._'))
      .map(f => f.replace('.json', ''))
  );
}

async function fetchFeed(source: RSSSource): Promise<FeedItem[]> {
  try {
    console.log(`  📡 Fetching: ${source.name}...`);
    const feed = await parser.parseURL(source.url);

    const items: FeedItem[] = (feed.items || []).map(item => ({
      id: generateItemId(source.id, item.link || item.guid || ''),
      sourceId: source.id,
      sourceName: source.name,
      sourceTier: source.tier,
      sourceType: source.type,
      title: item.title || 'Untitled',
      link: item.link || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      contentSnippet: item.contentSnippet?.substring(0, 500),
      content: item.content?.substring(0, 2000),
      categories: item.categories,
      fetchedAt: new Date().toISOString(),
    }));

    const since = parseSinceArg(DEFAULT_RSS_SINCE);
    const filtered = items
      .filter((item) => Boolean(item.link))
      .filter((item) => {
        if (!since) return true;
        const dt = parseItemDate(item);
        return dt ? dt.getTime() >= since.getTime() : false;
      })
      .sort((a, b) => {
        const dateA = parseItemDate(a)?.getTime() || 0;
        const dateB = parseItemDate(b)?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, MAX_ITEMS_PER_FEED);

    const dropped = items.length - filtered.length;
    console.log(
      `     ✅ Found ${items.length} items (kept ${filtered.length}${dropped > 0 ? `, dropped ${dropped}` : ''})`
    );
    return filtered;
  } catch (error: any) {
    console.log(`     ❌ Failed: ${error.message}`);
    return [];
  }
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  RSS Feed Crawler');
  console.log('  Fetching AI news from official blogs and tech news');
  console.log('═'.repeat(60) + '\n');

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const sourceArg = args.find(a => a.startsWith('--source='));
  const sourceFilter = sourceArg ? sourceArg.split('=')[1] as SourceType : undefined;

  // Ensure directories exist
  if (!existsSync(OFFICIAL_DIR)) mkdirSync(OFFICIAL_DIR, { recursive: true });
  if (!existsSync(NEWS_DIR)) mkdirSync(NEWS_DIR, { recursive: true });

  // Get existing IDs
  const existingOfficialIds = getExistingIds(OFFICIAL_DIR);
  const existingNewsIds = getExistingIds(NEWS_DIR);

  console.log(`📁 Existing: ${existingOfficialIds.size} official, ${existingNewsIds.size} news\n`);

  // Filter sources based on argument
  const sourcesToFetch = RSS_SOURCES.filter(s => {
    if (!s.enabled) return false;
    if (sourceFilter && s.type !== sourceFilter) return false;
    return true;
  });

  console.log(`📋 Fetching ${sourcesToFetch.length} sources:\n`);

  let totalNew = 0;
  let totalSkipped = 0;

  for (const source of sourcesToFetch) {
    const items = await fetchFeed(source);

    const dir = source.type === 'official' ? OFFICIAL_DIR : NEWS_DIR;
    const existingIds = source.type === 'official' ? existingOfficialIds : existingNewsIds;

    let newCount = 0;
    let skipCount = 0;

    for (const item of items) {
      if (existingIds.has(item.id)) {
        skipCount++;
        continue;
      }

      const filePath = join(dir, `${item.id}.json`);
      writeFileSync(filePath, JSON.stringify(item, null, 2));
      existingIds.add(item.id);
      newCount++;
    }

    if (newCount > 0) {
      console.log(`     📥 New: ${newCount}, Skipped: ${skipCount}`);
    }

    totalNew += newCount;
    totalSkipped += skipCount;

    // Rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✨ Done!`);
  console.log(`   New items: ${totalNew}`);
  console.log(`   Skipped (existing): ${totalSkipped}`);
  console.log(`   Total in data/official: ${existingOfficialIds.size}`);
  console.log(`   Total in data/news: ${existingNewsIds.size}`);
  console.log('═'.repeat(60) + '\n');
}

main()
  .then(() => {
    // Some RSS libraries leave keep-alive sockets open; ensure the pipeline can continue.
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
