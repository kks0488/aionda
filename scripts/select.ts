import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

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
}

async function main() {
  // Ensure directories exist
  if (!existsSync(RAW_DIR)) {
    console.log('❌ No raw posts found. Run `pnpm crawl` first.');
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

  // Load raw posts
  const rawFiles = readdirSync(RAW_DIR).filter((f) => f.endsWith('.json'));
  const posts: RawPost[] = rawFiles
    .map((f) => {
      const content = readFileSync(join(RAW_DIR, f), 'utf-8');
      return JSON.parse(content) as RawPost;
    })
    .filter((p) => !selectedIds.has(p.id))
    .sort((a, b) => b.views - a.views);

  if (posts.length === 0) {
    console.log('✅ No new posts to select. All posts have been processed.');
    process.exit(0);
  }

  console.log(`\n📋 Available posts (${posts.length} unselected):\n`);
  console.log('─'.repeat(80));
  console.log(
    'No.'.padEnd(5) +
      'ID'.padEnd(10) +
      'Category'.padEnd(12) +
      'Title'.padEnd(35) +
      'Views'.padEnd(8) +
      'Likes'
  );
  console.log('─'.repeat(80));

  posts.slice(0, 20).forEach((post, i) => {
    console.log(
      `${i + 1}`.padEnd(5) +
        post.id.padEnd(10) +
        (post.category || '-').substring(0, 10).padEnd(12) +
        post.title.substring(0, 33).padEnd(35) +
        `${post.views}`.padEnd(8) +
        `${post.likes}`
    );
  });

  console.log('─'.repeat(80));
  console.log('\nEnter post numbers to select (comma-separated), or "q" to quit:');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('> ', (answer) => {
    if (answer.toLowerCase() === 'q') {
      console.log('Bye!');
      rl.close();
      return;
    }

    const selections = answer
      .split(',')
      .map((s) => parseInt(s.trim()) - 1)
      .filter((n) => !isNaN(n) && n >= 0 && n < posts.length);

    if (selections.length === 0) {
      console.log('No valid selections.');
      rl.close();
      return;
    }

    let selected = 0;
    for (const idx of selections) {
      const post = posts[idx];
      const srcPath = join(RAW_DIR, `${post.id}.json`);
      const destPath = join(SELECTED_DIR, `${post.id}.json`);

      // Copy and add selection metadata
      const content = JSON.parse(readFileSync(srcPath, 'utf-8'));
      content.selectedAt = new Date().toISOString();
      content.selectedBy = 'manual';

      writeFileSync(destPath, JSON.stringify(content, null, 2));
      console.log(`✅ Selected: ${post.id} - ${post.title.substring(0, 40)}`);
      selected++;
    }

    console.log(`\n✨ ${selected} post(s) selected and moved to data/selected/`);
    console.log('Next step: Run `pnpm verify` to verify selected posts.');
    rl.close();
  });
}

main().catch(console.error);
