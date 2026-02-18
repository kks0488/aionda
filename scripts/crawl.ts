import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { fetchPostList, fetchPostDetail } from '../packages/crawler/src/fetcher.js';
import { run } from './lib/run';

const DATA_DIR = './data/raw';

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const pagesArg = args.find((a) => a.startsWith('--pages='));
  const categoryArg = args.find((a) => a.startsWith('--category='));

  const pages = pagesArg ? parseInt(pagesArg.split('=')[1]) : 1;
  const category = categoryArg ? categoryArg.split('=')[1] : undefined;

  console.log(`\n🔍 Crawling ${pages} page(s)${category ? ` (category: ${category})` : ''}...\n`);

  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Get existing post IDs
  const existingIds = new Set(
    readdirSync(DATA_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
  );

  console.log(`📁 Found ${existingIds.size} existing posts\n`);

  // Fetch post list
  const posts = await fetchPostList({ pages, category });
  console.log(`\n📋 Total posts found: ${posts.length}\n`);

  let newCount = 0;
  let skipCount = 0;

  for (const post of posts) {
    if (existingIds.has(post.id)) {
      skipCount++;
      continue;
    }

    console.log(`⬇️  Fetching: ${post.id} - ${post.title.substring(0, 40)}...`);

    const detail = await fetchPostDetail(post.id);
    if (!detail) {
      console.log(`   ❌ Failed to fetch`);
      continue;
    }

    const fullPost = {
      ...post,
      ...detail,
    };

    const filePath = join(DATA_DIR, `${post.id}.json`);
    writeFileSync(filePath, JSON.stringify(fullPost, null, 2), 'utf-8');
    console.log(`   ✅ Saved`);
    newCount++;
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`✨ Done!`);
  console.log(`   New posts: ${newCount}`);
  console.log(`   Skipped (existing): ${skipCount}`);
  console.log(`   Total in data/raw: ${existingIds.size + newCount}`);
}

run(main);
