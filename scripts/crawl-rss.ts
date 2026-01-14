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
  },
});

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
  // OpenAI: https://openai.com/news/rss.xml (often unreliable)
  // Google AI Blog: No reliable RSS
  // Meta AI: No official RSS
  { id: 'nvidia', name: 'Nvidia Blog', url: 'https://blogs.nvidia.com/feed/', tier: 'S', type: 'official', enabled: true },
  { id: 'deepmind', name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml', tier: 'S', type: 'official', enabled: true },
  { id: 'microsoft-ai', name: 'Microsoft AI Blog', url: 'https://blogs.microsoft.com/ai/feed/', tier: 'S', type: 'official', enabled: true },
  { id: 'huggingface', name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', tier: 'S', type: 'official', enabled: true },

  // Tech News (Tier A)
  { id: 'techcrunch-ai', name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', tier: 'A', type: 'news', enabled: true },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', tier: 'A', type: 'news', enabled: true },
  { id: 'venturebeat-ai', name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', tier: 'A', type: 'news', enabled: true },
  { id: 'mit-tech-review', name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/', tier: 'A', type: 'news', enabled: true },
  { id: 'wired-ai', name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss', tier: 'A', type: 'news', enabled: true },
  { id: 'zdnet-ai', name: 'ZDNet AI', url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml', tier: 'A', type: 'news', enabled: true },
  { id: 'reuters-tech', name: 'Reuters Tech', url: 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best&best-topics=tech', tier: 'A', type: 'news', enabled: true },
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

    console.log(`     ✅ Found ${items.length} items`);
    return items;
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

main().catch(console.error);
