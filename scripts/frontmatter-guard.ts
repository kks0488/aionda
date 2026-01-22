/**
 * Frontmatter guard (deterministic).
 *
 * Goals:
 * - Catch duplicate top-level keys early (e.g., duplicated `description`)
 * - Fix common YAML footguns deterministically (e.g., unquoted ":" in title)
 *
 * Options:
 * - --files=a,b,c   Only check these files
 * - --fix           Apply safe auto-fixes (quote values with ": ")
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const POSTS_PREFIX = `${['apps', 'web', 'content', 'posts'].join(path.sep)}${path.sep}`;

function isPostFile(file: string): boolean {
  return (
    file.includes(POSTS_PREFIX) &&
    (file.endsWith('.mdx') || file.endsWith('.md'))
  );
}

function parseFilesArg(args: string[]): string[] {
  const filesArgs = args.filter((a) => a.startsWith('--files='));
  if (filesArgs.length === 0) return [];

  const values = filesArgs
    .map((a) => a.split('=')[1] || '')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.replace(/\//g, path.sep));

  return Array.from(new Set(values));
}

function readCmd(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
  } catch {
    return '';
  }
}

function listChangedPostFiles(): string[] {
  const seen = new Set<string>();
  const add = (output: string) => {
    for (const raw of output.split('\n')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      seen.add(trimmed.replace(/\//g, path.sep));
    }
  };

  add(readCmd('git diff --name-only --diff-filter=ACMR'));
  add(readCmd('git diff --name-only --diff-filter=ACMR --cached'));
  add(readCmd('git ls-files --others --exclude-standard'));

  return Array.from(seen).filter(isPostFile);
}

function extractFrontmatterBlock(raw: string): { start: number; end: number; block: string } | null {
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) return null;
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== '---') return null;

  let endLine = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') {
      endLine = i;
      break;
    }
  }
  if (endLine === -1) return null;

  const block = lines.slice(0, endLine + 1).join('\n');
  const start = 0;
  const end = block.length;
  return { start, end, block };
}

function findDuplicateTopLevelKeys(frontmatter: string): string[] {
  const lines = frontmatter.split('\n');
  const counts = new Map<string, number>();

  for (const line of lines) {
    if (!line) continue;
    if (line === '---') continue;
    if (/^\s/.test(line)) continue; // ignore indented (nested) keys
    const m = line.match(/^([A-Za-z0-9_]+):/);
    if (!m) continue;
    const key = m[1];
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function quoteIfNeeded(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (trimmed.startsWith('"') || trimmed.startsWith("'")) return value;
  if (trimmed === '|' || trimmed === '>' || trimmed === '|-' || trimmed === '>-') return value;
  if (!trimmed.includes(': ')) return value;
  const escaped = trimmed.replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function applySafeFixes(frontmatter: string): { updated: string; changed: boolean } {
  const lines = frontmatter.split('\n');
  let changed = false;

  const out = lines.map((line) => {
    if (!line) return line;
    if (line === '---') return line;
    if (/^\s/.test(line)) return line;

    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) return line;

    const [, key, rawValue] = m;
    // Only fix scalar single-line values. Multiline YAML uses `>`/`|` which we skip above.
    const fixedValue = quoteIfNeeded(rawValue);
    if (fixedValue !== rawValue) {
      changed = true;
      return `${key}: ${fixedValue}`;
    }
    return line;
  });

  return { updated: out.join('\n'), changed };
}

function main() {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const filesOverride = parseFilesArg(args);

  const repoRoot = process.cwd();
  const targetsRel = filesOverride.length > 0 ? filesOverride : listChangedPostFiles();
  const targets = targetsRel
    .map((f) => (path.isAbsolute(f) ? f : path.join(repoRoot, f)))
    .filter((f) => fs.existsSync(f))
    .filter((f) => isPostFile(f));

  if (targets.length === 0) {
    console.log('✅ Frontmatter guard: no target post files.');
    process.exit(0);
  }

  const errors: string[] = [];
  let fixedCount = 0;

  for (const filePath of targets) {
    const rel = path.relative(repoRoot, filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const fm = extractFrontmatterBlock(raw);
    if (!fm) continue;

    const duplicates = findDuplicateTopLevelKeys(fm.block);
    if (duplicates.length > 0) {
      errors.push(`${rel}: duplicate top-level keys: ${duplicates.join(', ')}`);
      continue;
    }

    if (!fix) continue;
    const { updated, changed } = applySafeFixes(fm.block);
    if (!changed) continue;

    const next = raw.slice(0, fm.start) + updated + raw.slice(fm.end);
    fs.writeFileSync(filePath, next);
    fixedCount += 1;
  }

  if (fixedCount > 0) {
    console.log(`🛡️ Frontmatter guard: applied safe fixes to ${fixedCount} file(s).`);
  }

  if (errors.length > 0) {
    console.error('❌ Frontmatter guard failed:\n' + errors.map((e) => `- ${e}`).join('\n'));
    process.exit(1);
  }

  console.log('✅ Frontmatter guard passed.');
}

main();

