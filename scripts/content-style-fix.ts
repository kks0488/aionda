/**
 * Deterministic, repo-local style fixer to pass strict lint without LLMs.
 *
 * Focus:
 * - soften absolute language in English
 * - split long English sentences (> 20 words) using simple heuristics
 *
 * Options:
 *   --files=a,b,c    Limit to specific post files (recommended)
 *   --dry-run        Print changes without writing
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

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

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countWords(sentence: string): number {
  const matches = sentence.match(/\b[\w'-]+\b/g);
  return matches ? matches.length : 0;
}

function softenAbsoluteLanguage(line: string): string {
  // Keep changes small and reversible; prefer softening over re-phrasing.
  const replacements: Array<[RegExp, string]> = [
    [/\bmust\b/gi, 'should'],
    [/\bnever\b/gi, 'rarely'],
    [/\balways\b/gi, 'often'],
    [/\bimpossible\b/gi, 'hard'],
    [/\bperfectly\b/gi, 'well'],
    [/\bcompletely\b/gi, 'largely'],
    [/\bguarantee(s)?\b/gi, 'help ensure'],
    [/\b100%\b/g, 'a high degree'],
    // De-hype common adjectives (lint uses warning-level "hype").
    [/\bunprecedented\b/gi, 'notable'],
    [/\bgroundbreaking\b/gi, 'notable'],
    [/\brevolutionary\b/gi, 'significant'],
    [/\bgame-?changer\b/gi, 'meaningful shift'],
    [/\bmind-?blowing\b/gi, 'remarkable'],
    [/\bincredible\b/gi, 'notable'],
    [/\bamazing\b/gi, 'notable'],
    [/\btremendous\b/gi, 'substantial'],
    [/\bmassive\b/gi, 'large'],
    [/\benormous\b/gi, 'large'],
    [/\b혁명적\b/g, '의미 있는'],
    [/\b게임체인저\b/g, '변수'],
    [/\b엄청난\b/g, '주목할 만한'],
    [/\b대단한\b/g, '주목할 만한'],
    [/\b놀라운\b/g, '주목할 만한'],
  ];

  let out = line;
  for (const [re, to] of replacements) out = out.replace(re, to);
  return out;
}

function splitLongSentence(sentence: string): string[] {
  const trimmed = sentence.trim();
  if (countWords(trimmed) <= 20) return [trimmed];

  const splitters: Array<{ re: RegExp; keep: string }> = [
    { re: /;\s+/g, keep: ';' },
    { re: /:\s+/g, keep: ':' },
    { re: /,\s+(and|but|so|because|which|that)\s+/gi, keep: ',' },
    { re: /,\s+/g, keep: ',' },
    { re: /\s+\(([^)]+)\)\s+/g, keep: '' },
  ];

  for (const splitter of splitters) {
    const matches = Array.from(trimmed.matchAll(splitter.re));
    if (matches.length === 0) continue;

    // Choose a split close to the middle.
    const midpoint = Math.floor(trimmed.length / 2);
    const best = matches.reduce((acc, m) => {
      const idx = m.index ?? -1;
      if (idx === -1) return acc;
      const dist = Math.abs(idx - midpoint);
      if (!acc || dist < acc.dist) return { idx, len: m[0].length, dist };
      return acc;
    }, null as null | { idx: number; len: number; dist: number });

    if (!best) continue;

    const leftRaw = trimmed.slice(0, best.idx + (splitter.keep ? splitter.keep.length : 0)).trim();
    const rightRaw = trimmed.slice(best.idx + best.len).trim();
    if (!leftRaw || !rightRaw) continue;

    const left = leftRaw.replace(/[;:,]\s*$/g, '').trim();
    const right = rightRaw.replace(/^[,;:]\s*/g, '').trim();
    if (!left || !right) continue;

    const leftSentence = left.endsWith('.') || left.endsWith('!') || left.endsWith('?') ? left : `${left}.`;
    return [leftSentence, right];
  }

  return [trimmed];
}

function capitalizeSentenceStart(value: string): string {
  const trimmed = value.trimStart();
  if (!trimmed) return value;
  const first = trimmed[0];
  if (first >= 'a' && first <= 'z') {
    const cap = first.toUpperCase() + trimmed.slice(1);
    return value.replace(trimmed, cap);
  }
  return value;
}

function processMarkdownBody(markdown: string): { next: string; changed: boolean; stats: { softened: number; split: number } } {
  const parts = markdown.split(/```[\s\S]*?```/g);
  const codeBlocks = markdown.match(/```[\s\S]*?```/g) || [];

  let softened = 0;
  let split = 0;

  const processedParts = parts.map((part) => {
    const lines = part.split('\n');
    const nextLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Avoid touching headings.
      if (/^\s*#{1,6}\s+/.test(line)) {
        nextLines.push(line);
        continue;
      }

      // Avoid touching source link bullets.
      if (/^\s*-\s+/.test(line) && /\]\([^)]+\)/.test(line)) {
        nextLines.push(line);
        continue;
      }

      let nextLine = line;
      if (/^\*\*Action Items for Today:\*\*\s*$/i.test(nextLine.trim())) {
        nextLine = '**Checklist for Today:**';
      }
      if (/^\s*A\.\s*$/.test(nextLine)) {
        nextLine = nextLine.replace(/A\./, 'A:');
      }
      if (nextLine.trim() === 'A:' && i + 1 < lines.length) {
        const peek = lines[i + 1];
        if (peek && peek.trim() && !/^\s*#{1,6}\s+/.test(peek)) {
          nextLine = `A: ${peek.trim()}`;
          i += 1;
        }
      }
      const before = nextLine;
      nextLine = softenAbsoluteLanguage(nextLine);
      if (nextLine !== before) softened += 1;

      // Split only plain English-ish sentences; skip empty or very short lines.
      if (/^\s*A[:.]\s*/.test(nextLine)) {
        nextLines.push(nextLine);
        continue;
      }

      if (countWords(nextLine) > 22) {
        const sentences = splitSentences(nextLine);
        if (sentences.length === 1 && countWords(sentences[0]) > 20) {
          const splitSentencesOut = splitLongSentence(sentences[0]);
          if (splitSentencesOut.length > 1) {
            split += 1;
            const normalized = splitSentencesOut.map((s, idx) => (idx === 0 ? s : capitalizeSentenceStart(s)));
            nextLines.push(...normalized);
            continue;
          }
        }
      }

      nextLines.push(nextLine);
    }

    return nextLines.join('\n');
  });

  // Stitch back code blocks in the original order.
  let rebuilt = '';
  for (let i = 0; i < processedParts.length; i++) {
    rebuilt += processedParts[i];
    if (i < codeBlocks.length) rebuilt += codeBlocks[i];
  }

  const changed = rebuilt !== markdown;
  return { next: rebuilt, changed, stats: { softened, split } };
}

function normalizeKoTldrHeading(markdown: string): { next: string; changed: boolean } {
  const parts = markdown.split(/```[\s\S]*?```/g);
  const codeBlocks = markdown.match(/```[\s\S]*?```/g) || [];

  const processed = parts.map((part) => {
    const lines = part.split('\n');
    const out: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!/^##\s*TL;DR\s*$/i.test(line.trim())) {
        out.push(line);
        continue;
      }

      // Count bullets until next heading/blank-line boundary.
      let bullets = 0;
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (/^\s*#{1,6}\s+/.test(next)) break;
        if (next.trim() === '') break;
        if (/^\s*[-*]\s+/.test(next)) bullets += 1;
      }

      out.push(bullets === 3 ? '## 세 줄 요약' : '## 간단 요약');
    }

    return out.join('\n');
  });

  let rebuilt = '';
  for (let i = 0; i < processed.length; i++) {
    rebuilt += processed[i];
    if (i < codeBlocks.length) rebuilt += codeBlocks[i];
  }

  return { next: rebuilt, changed: rebuilt !== markdown };
}

function isPostFile(file: string): boolean {
  const normalized = file.replace(/\//g, path.sep);
  return (
    normalized.includes(`${['apps', 'web', 'content', 'posts'].join(path.sep)}${path.sep}`) &&
    (normalized.endsWith('.mdx') || normalized.endsWith('.md'))
  );
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const files = parseFilesArg(args);

  if (files.length === 0) {
    console.error('❌ No target files. Pass --files=a,b,c');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  let touched = 0;
  let totalSoftened = 0;
  let totalSplit = 0;

  for (const rawFile of files) {
    const rel = path.isAbsolute(rawFile) ? path.relative(repoRoot, rawFile) : rawFile;
    const normalizedRel = rel.replace(/\//g, path.sep);
    if (!isPostFile(normalizedRel)) continue;

    const fullPath = path.join(repoRoot, normalizedRel);
    if (!fs.existsSync(fullPath)) continue;

    const raw = fs.readFileSync(fullPath, 'utf8');
    const parsed = matter(raw);
    const originalBody = parsed.content || '';

    const locale = String(parsed.data?.locale || '').toLowerCase();
    const isKo = locale === 'ko' || normalizedRel.includes(`${path.sep}ko${path.sep}`);
    const tldrNormalized = isKo ? normalizeKoTldrHeading(originalBody) : { next: originalBody, changed: false };

    const processed = processMarkdownBody(tldrNormalized.next);
    const changed = tldrNormalized.changed || processed.changed;
    if (!changed) continue;

    touched += 1;
    totalSoftened += processed.stats.softened;
    totalSplit += processed.stats.split;

    if (!dryRun) {
      const rebuilt = matter.stringify(processed.next, parsed.data);
      fs.writeFileSync(fullPath, rebuilt);
    }
  }

  console.log('\n🪄 Content style fix summary');
  console.log(`Files touched: ${touched}`);
  console.log(`Lines softened: ${totalSoftened}`);
  console.log(`Sentences split: ${totalSplit}`);
  if (dryRun) console.log('(dry-run) No files were modified.');
}

main();
