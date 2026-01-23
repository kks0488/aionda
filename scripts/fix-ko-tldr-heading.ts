/**
 * Bulk-migrate Korean post heading:
 *   "## TL;DR" -> "## 세 줄 요약" (if 3 bullets) else "## 간단 요약"
 *
 * Deterministic and repo-local.
 *
 * Options:
 * - --dry-run   Print summary without writing
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const KO_POSTS_DIR = path.join(process.cwd(), 'apps', 'web', 'content', 'posts', 'ko');

function isPostFile(file: string): boolean {
  return file.endsWith('.mdx') || file.endsWith('.md');
}

function countBulletsAfterHeading(lines: string[], headingLineIndex: number): number {
  let bullets = 0;
  for (let i = headingLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#{1,6}\s+/.test(line)) break;
    if (line.trim() === '') break;
    if (/^\s*[-*]\s+/.test(line)) bullets += 1;
  }
  return bullets;
}

function rewriteKoTldrHeading(body: string): { next: string; changed: boolean; from?: string; to?: string } {
  // Avoid touching code blocks by splitting and stitching.
  const parts = body.split(/```[\s\S]*?```/g);
  const codeBlocks = body.match(/```[\s\S]*?```/g) || [];

  let changed = false;
  let from: string | undefined;
  let to: string | undefined;

  const processed = parts.map((part) => {
    const lines = part.split('\n');
    const out: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/^##\s*TL;DR\s*$/i.test(line.trim())) {
        out.push(line);
        continue;
      }

      const bullets = countBulletsAfterHeading(lines, i);
      const replacement = bullets === 3 ? '## 세 줄 요약' : '## 간단 요약';

      changed = true;
      from = '## TL;DR';
      to = replacement;
      out.push(replacement);
    }

    return out.join('\n');
  });

  let rebuilt = '';
  for (let i = 0; i < processed.length; i++) {
    rebuilt += processed[i];
    if (i < codeBlocks.length) rebuilt += codeBlocks[i];
  }

  return { next: rebuilt, changed: changed && rebuilt !== body, from, to };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (!fs.existsSync(KO_POSTS_DIR)) {
    console.log('✅ No ko posts directory. Skipping.');
    process.exit(0);
  }

  const files = fs
    .readdirSync(KO_POSTS_DIR)
    .filter(isPostFile)
    .filter((f) => !f.startsWith('._'))
    .map((f) => path.join(KO_POSTS_DIR, f));

  let touched = 0;

  for (const fullPath of files) {
    const raw = fs.readFileSync(fullPath, 'utf8');
    let parsed: { data: any; content: string };
    try {
      parsed = matter(raw);
    } catch {
      continue;
    }

    const { next, changed } = rewriteKoTldrHeading(parsed.content || '');
    if (!changed) continue;

    touched += 1;
    if (!dryRun) {
      const rebuilt = matter.stringify(next, parsed.data);
      fs.writeFileSync(fullPath, rebuilt);
    }
  }

  console.log(`✅ KO TL;DR heading migration: ${touched} file(s) ${dryRun ? '(dry-run)' : 'updated'}.`);
}

main();

