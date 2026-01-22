/**
 * Replace unstable Google grounding redirect links (vertexaisearch.cloud.google.com)
 * with their canonical destination URLs.
 *
 * Usage:
 *   pnpm content:fix-redirects
 */

import fs from 'fs';
import path from 'path';
import { normalizeSourceUrl, isVertexGroundingRedirect } from './lib/url-normalize.js';

const POSTS_DIR = path.join(process.cwd(), 'apps/web/content/posts');
const URL_PATTERN =
  /https?:\/\/vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\/[^)\s]+/gi;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!full.endsWith('.mdx') && !full.endsWith('.md')) continue;
    out.push(full);
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

async function main() {
  const files = walk(POSTS_DIR);
  let filesChanged = 0;
  let linksFound = 0;
  let linksReplaced = 0;
  let linksUnresolved = 0;

  console.log(`Scanning ${files.length} post file(s)...`);

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const matches = raw.match(URL_PATTERN) || [];
    const urls = unique(matches);

    if (urls.length === 0) continue;

    linksFound += matches.length;

    const mappings = await mapWithConcurrency(urls, 6, async (url) => {
      const normalized = await normalizeSourceUrl(url);
      return { from: url, to: normalized };
    });

    let next = raw;
    let changed = false;

    for (const { from, to } of mappings) {
      if (!to || isVertexGroundingRedirect(to)) {
        linksUnresolved += 1;
        continue;
      }
      if (to === from) continue;

      next = next.split(from).join(to);
      changed = true;
      linksReplaced += (matches.filter((m) => m === from).length || 1);
    }

    if (changed && next !== raw) {
      fs.writeFileSync(file, next);
      filesChanged += 1;
      console.log(`✅ Updated: ${path.relative(process.cwd(), file)}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Files changed: ${filesChanged}`);
  console.log(`Redirect links found: ${linksFound}`);
  console.log(`Redirect links replaced: ${linksReplaced}`);
  console.log(`Redirect links unresolved: ${linksUnresolved}`);
  console.log('═'.repeat(60));
}

main().catch((error) => {
  console.error('❌ Failed to fix redirect links:', error);
  process.exit(1);
});
