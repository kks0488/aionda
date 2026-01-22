/**
 * Frontmatter normalization:
 * - Ensure legacy posts include `slug` and `locale`
 * - Ensure `alternateLocale` only exists when the paired file exists
 *
 * Designed to minimize diffs by editing only the frontmatter block.
 */

import fs from 'fs';
import path from 'path';

const POSTS_DIR = path.join(process.cwd(), 'apps/web/content/posts');

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

function getLocaleFromPath(filePath: string): 'en' | 'ko' | null {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/posts/en/')) return 'en';
  if (normalized.includes('/posts/ko/')) return 'ko';
  return null;
}

function getSlugFromFilename(filePath: string): string {
  return path.basename(filePath).replace(/\.mdx?$/, '');
}

function hasKey(lines: string[], key: string): boolean {
  const prefix = `${key}:`;
  return lines.some((line) => line.trimStart().startsWith(prefix));
}

function findKeyLineIndex(lines: string[], key: string): number {
  const prefix = `${key}:`;
  return lines.findIndex((line) => line.trimStart().startsWith(prefix));
}

function insertAfter(lines: string[], afterKey: string, newLine: string): string[] {
  const idx = findKeyLineIndex(lines, afterKey);
  if (idx === -1) return [newLine, ...lines];
  const keyLine = lines[idx] || '';
  const isBlockScalar = new RegExp(`^\\s*${afterKey}:\\s*[>|]`).test(keyLine);

  if (!isBlockScalar) {
    return [...lines.slice(0, idx + 1), newLine, ...lines.slice(idx + 1)];
  }

  // If the key uses a block scalar (e.g., `title: >-`), insert after the block content.
  let insertIndex = idx + 1;
  while (insertIndex < lines.length) {
    const line = lines[insertIndex] ?? '';
    if (line === '') {
      insertIndex += 1;
      continue;
    }
    if (/^\s+/.test(line)) {
      insertIndex += 1;
      continue;
    }
    break;
  }

  return [...lines.slice(0, insertIndex), newLine, ...lines.slice(insertIndex)];
}

function replaceKeyLine(lines: string[], key: string, newLine: string): string[] {
  const idx = findKeyLineIndex(lines, key);
  if (idx === -1) return lines;
  return [...lines.slice(0, idx), newLine, ...lines.slice(idx + 1)];
}

function removeKeyLine(lines: string[], key: string): string[] {
  const prefix = `${key}:`;
  return lines.filter((line) => !line.trimStart().startsWith(prefix));
}

function pairedPostExists(locale: 'en' | 'ko', slug: string): boolean {
  const other = locale === 'en' ? 'ko' : 'en';
  const mdx = path.join(POSTS_DIR, other, `${slug}.mdx`);
  const md = path.join(POSTS_DIR, other, `${slug}.md`);
  return fs.existsSync(mdx) || fs.existsSync(md);
}

function normalizeAlternateLocaleLine(locale: 'en' | 'ko', slug: string): string {
  const other = locale === 'en' ? 'ko' : 'en';
  return `alternateLocale: /${other}/posts/${slug}`;
}

function parseFrontmatter(raw: string): { frontmatterLines: string[]; body: string } | null {
  if (!raw.startsWith('---\n') && raw.trimStart() !== raw) {
    // Non-frontmatter file or BOM/leading whitespace; skip.
    return null;
  }

  const lines = raw.split('\n');
  if (lines[0].trim() !== '---') return null;

  const endIndex = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
  if (endIndex === -1) return null;

  const frontmatterLines = lines.slice(1, endIndex);
  const body = lines.slice(endIndex + 1).join('\n');
  return { frontmatterLines, body };
}

function buildFile(frontmatterLines: string[], body: string): string {
  const fm = ['---', ...frontmatterLines, '---'].join('\n');
  // Preserve body exactly (it already includes its own leading newline if present).
  return `${fm}\n${body}`;
}

function main() {
  const files = walk(POSTS_DIR);
  let changed = 0;
  let fixedAlternateLocale = 0;
  let removedAlternateLocale = 0;
  let addedSlug = 0;
  let addedLocale = 0;

  for (const file of files) {
    const locale = getLocaleFromPath(file);
    if (!locale) continue;

    const slug = getSlugFromFilename(file);
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) continue;

    let { frontmatterLines, body } = parsed;
    const before = frontmatterLines.join('\n');

    if (!hasKey(frontmatterLines, 'slug')) {
      frontmatterLines = insertAfter(frontmatterLines, 'title', `slug: ${slug}`);
      addedSlug += 1;
    }

    if (!hasKey(frontmatterLines, 'locale')) {
      frontmatterLines = insertAfter(frontmatterLines, 'date', `locale: ${locale}`);
      addedLocale += 1;
    }

    const hasAlt = hasKey(frontmatterLines, 'alternateLocale');
    const hasPair = pairedPostExists(locale, slug);

    if (hasAlt && !hasPair) {
      frontmatterLines = removeKeyLine(frontmatterLines, 'alternateLocale');
      removedAlternateLocale += 1;
    } else if (hasAlt && hasPair) {
      const nextLine = normalizeAlternateLocaleLine(locale, slug);
      const prevIndex = findKeyLineIndex(frontmatterLines, 'alternateLocale');
      if (prevIndex !== -1 && frontmatterLines[prevIndex].trim() !== nextLine) {
        frontmatterLines = replaceKeyLine(frontmatterLines, 'alternateLocale', nextLine);
        fixedAlternateLocale += 1;
      }
    }

    const after = frontmatterLines.join('\n');
    if (after === before) continue;

    fs.writeFileSync(file, buildFile(frontmatterLines, body));
    changed += 1;
  }

  console.log('═'.repeat(60));
  console.log(`Files changed: ${changed}`);
  console.log(`Added slug: ${addedSlug}`);
  console.log(`Added locale: ${addedLocale}`);
  console.log(`alternateLocale fixed: ${fixedAlternateLocale}`);
  console.log(`alternateLocale removed (no pair): ${removedAlternateLocale}`);
  console.log('═'.repeat(60));
}

main();
