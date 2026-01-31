/**
 * Slow-but-strong factual gate: verify extracted claims for changed/new posts.
 *
 * This uses Gemini + Google Search tool via SearchMode prompts.
 *
 * Default: verify only changed/new post files.
 * Options:
 *   --all         Verify all posts (expensive)
 *   --max=N       Max claims per file (default: 6)
 *   --allow-ai-disabled  Exit 0 even if AI API is disabled (NOT recommended for publishing)
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { execSync } from 'child_process';
import { extractClaims, verifyClaim } from './lib/gemini.js';
import { filterValidSources, meetsConfidenceThreshold } from './lib/search-mode.js';

type Priority = 'high' | 'medium' | 'low';

interface ExtractedClaim {
  id?: string;
  text: string;
  type: string;
  entities?: string[];
  priority?: Priority;
}

interface ClaimResult {
  id: string;
  text: string;
  type: string;
  priority: Priority;
  verified: boolean;
  confidence: number;
  notes: string;
  correctedText?: string;
  sources: Array<{ url: string; title: string; tier: string }>;
}

interface FileReport {
  file: string;
  claimsChecked: number;
  verifiedClaims: number;
  avgConfidence: number;
  failedHighPriority: number;
  results: ClaimResult[];
}

const POSTS_PREFIX = `${['apps', 'web', 'content', 'posts'].join(path.sep)}${path.sep}`;

function isPostFile(file: string): boolean {
  return (
    file.includes(POSTS_PREFIX) &&
    (file.endsWith('.mdx') || file.endsWith('.md'))
  );
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

function walkAllPosts(rootDir: string): string[] {
  if (!fs.existsSync(rootDir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name.startsWith('._')) continue;
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkAllPosts(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!full.endsWith('.mdx') && !full.endsWith('.md')) continue;
    out.push(full);
  }
  return out;
}

function normalizePriority(value: unknown): Priority {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'high' || v === 'medium' || v === 'low') return v;
  return 'medium';
}

function claimSortKey(priority: Priority): number {
  if (priority === 'high') return 0;
  if (priority === 'medium') return 1;
  return 2;
}

function parseMaxArg(args: string[]): number {
  const maxArg = args.find((a) => a.startsWith('--max='));
  if (!maxArg) return 6;
  const value = Number.parseInt(maxArg.split('=')[1] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : 6;
}

async function verifyFile(filePath: string, maxClaims: number): Promise<FileReport> {
  const repoRoot = process.cwd();
  const rel = path.relative(repoRoot, filePath);

  const raw = fs.readFileSync(filePath, 'utf8');
  let parsed: { content: string; data?: Record<string, unknown> };
  try {
    parsed = matter(raw);
  } catch (error: any) {
    return {
      file: rel,
      claimsChecked: 0,
      verifiedClaims: 0,
      avgConfidence: 0,
      failedHighPriority: 1,
      results: [
        {
          id: 'frontmatter_parse',
          text: 'Frontmatter parse failed',
          type: 'frontmatter_parse',
          priority: 'high',
          verified: false,
          confidence: 0,
          notes: error?.message || 'Failed to parse frontmatter',
          sources: [],
        },
      ],
    };
  }

  const content = parsed.content || '';
  const frontmatter = (parsed.data || {}) as Record<string, unknown>;
  const preferredSources = (() => {
    const urls = new Set<string>();
    const primary = typeof frontmatter.sourceUrl === 'string' ? frontmatter.sourceUrl : '';
    if (primary && primary.startsWith('http')) urls.add(primary);

    const markdownLinks = [...content.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)];
    for (const m of markdownLinks) {
      const u = String(m[1] || '').trim();
      if (u.startsWith('http')) urls.add(u);
    }

    const bareLinks = [...content.matchAll(/https?:\/\/[^\s)]+/g)];
    for (const m of bareLinks) {
      const u = String(m[0] || '').trim();
      if (u.startsWith('http')) urls.add(u);
    }

    return Array.from(urls).slice(0, 8);
  })();
  const errorToText = (err: unknown): string => {
    const anyErr = err as any;
    if (anyErr?.name) return String(anyErr.name);
    if (anyErr?.message) return String(anyErr.message);
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  };

  const fallbackExtractClaims = (rawContent: string, limit: number): ExtractedClaim[] => {
    // Deterministic fallback when the LLM-based claim extractor fails (e.g., AbortError).
    // Goal: keep verification meaningful (no "silent pass") while preserving exact quotes.
    const lines = rawContent
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      // Skip headings, bullets, and code fences-ish lines.
      .filter((l) => !/^#{1,6}\s+/.test(l))
      .filter((l) => !/^[-*]\s+/.test(l))
      .filter((l) => !/^```/.test(l))
      // Skip example scene lines.
      .filter((l) => !/^Example:/i.test(l) && !/^예:\s*/.test(l));

    const candidates = lines
      .filter((l) => /\b(20\d{2}|mmlu|gpqa|gsm8k|swe-bench|livecodebench|aime|benchmark|release|launched|priced?|%|\d)\b/i.test(l))
      // Prefer lines that look like factual claims.
      .sort((a, b) => {
        const score = (s: string) => {
          let v = 0;
          if (/\b20\d{2}\b/.test(s)) v += 2;
          if (/%|\b\d+(?:\.\d+)?\b/.test(s)) v += 2;
          if (/\b(mmlu|gpqa|gsm8k|swe-bench|livecodebench|aime|benchmark)\b/i.test(s)) v += 3;
          if (/\b(release|launched|priced?)\b/i.test(s)) v += 1;
          return v;
        };
        return score(b) - score(a);
      })
      .slice(0, Math.max(0, limit));

    return candidates.map((text, idx) => {
      const lower = text.toLowerCase();
      const type =
        /mmlu|gpqa|gsm8k|swe-bench|livecodebench|aime|benchmark/.test(lower) ? 'benchmark'
          : /release|launched|priced?/.test(lower) ? 'release_date'
            : 'general';
      return {
        id: `fallback_claim_${idx + 1}`,
        text,
        type,
        priority: 'high',
        entities: [],
      };
    });
  };

  let extracted: ExtractedClaim[] = [];
  try {
    extracted = (await extractClaims(content)) as ExtractedClaim[];
  } catch (err) {
    // Fall back to deterministic extraction so verification remains meaningful.
    extracted = fallbackExtractClaims(content, Math.min(maxClaims, 6));
  }

  // If claim extraction returns empty but the content clearly contains verifiable facts,
  // treat it as a verification failure (prevents “silent pass” on API aborts/timeouts).
  const looksVerifiable =
    /\b(20\d{2}|mmlu|gpqa|gsm8k|swe-bench|livecodebench|aime|benchmark|release|launched|priced?|%|\d)\b/i.test(content);
  if ((!extracted || extracted.length === 0) && looksVerifiable) {
    extracted = fallbackExtractClaims(content, Math.min(maxClaims, 6));
  }
  if ((!extracted || extracted.length === 0) && looksVerifiable) {
    return {
      file: rel,
      claimsChecked: 0,
      verifiedClaims: 0,
      avgConfidence: 0,
      failedHighPriority: 1,
      results: [
        {
          id: 'claim_extraction_empty',
          text: 'No verifiable claims extracted',
          type: 'claim_extraction_empty',
          priority: 'high',
          verified: false,
          confidence: 0,
          notes: 'No claims extracted despite quantitative/benchmark markers in the content.',
          sources: [],
        },
      ],
    };
  }

  const claims = (extracted || [])
    .filter((c) => c && typeof c.text === 'string' && c.text.trim().length > 0)
    .map((c, idx) => ({
      id: c.id || `claim_${idx + 1}`,
      text: c.text.trim(),
      type: String(c.type || 'general'),
      entities: Array.isArray(c.entities) ? c.entities.map(String) : undefined,
      priority: normalizePriority(c.priority),
    }))
    .sort((a, b) => claimSortKey(a.priority) - claimSortKey(b.priority))
    .slice(0, maxClaims);

  const results: ClaimResult[] = [];
  let verifiedClaims = 0;
  let confidenceSum = 0;
  let failedHighPriority = 0;

  // Verify sequentially to reduce rate limit risk (the verifyClaim itself uses Google Search tool).
  for (const claim of claims) {
    console.log(`  🔎 ${rel}: ${claim.text.slice(0, 70)}${claim.text.length > 70 ? '…' : ''}`);
    const verification = await verifyClaim(claim, content, preferredSources);

    const validSources = filterValidSources(verification.sources || []);
    const verified = Boolean(verification.verified) && meetsConfidenceThreshold(verification.confidence);

    if (claim.priority === 'high' && !verified) failedHighPriority += 1;
    if (verified) verifiedClaims += 1;
    confidenceSum += Number.isFinite(verification.confidence) ? verification.confidence : 0;

    results.push({
      id: claim.id,
      text: claim.text,
      type: claim.type,
      priority: claim.priority,
      verified,
      confidence: verification.confidence,
      notes: verification.notes || '',
      correctedText: verification.correctedText,
      sources: validSources.map((s) => ({
        url: s.url,
        title: s.title,
        tier: s.tier,
      })),
    });

    await new Promise((r) => setTimeout(r, 500));
  }

  const avgConfidence = claims.length > 0 ? confidenceSum / claims.length : 0;

  return {
    file: rel,
    claimsChecked: claims.length,
    verifiedClaims,
    avgConfidence: Math.round(avgConfidence * 1000) / 1000,
    failedHighPriority,
    results,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const verifyAll = args.includes('--all');
  const allowAiDisabled = args.includes('--allow-ai-disabled') || process.env.ALLOW_AI_DISABLED === 'true';
  const maxClaims = parseMaxArg(args);
  const filesOverride = parseFilesArg(args);

  const aiDisabled = ['true', '1'].includes((process.env.AI_API_DISABLED || '').toLowerCase());
  if (aiDisabled && !allowAiDisabled) {
    console.error('❌ AI_API_DISABLED=true. Refusing to run content verification for publishing.');
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const allPostFiles = walkAllPosts(path.join(repoRoot, 'apps', 'web', 'content', 'posts'));
  const changedPostFiles = listChangedPostFiles();
  const targets = filesOverride.length > 0
    ? filesOverride
        .map((f) => (path.isAbsolute(f) ? f : path.join(repoRoot, f)))
        .filter((f) => fs.existsSync(f))
        .filter(isPostFile)
    : verifyAll
      ? allPostFiles
      : changedPostFiles;

  if (targets.length === 0) {
    if (filesOverride.length > 0) {
      console.log('No matching post files found for --files.');
    } else {
      console.log(verifyAll ? 'No posts found.' : 'No changed post files to verify.');
    }
    process.exit(0);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  Content Verification (SearchMode)`);
  console.log(`  Files: ${targets.length} | Max claims/file: ${maxClaims}`);
  console.log('═'.repeat(60) + '\n');

  const reports: FileReport[] = [];
  let failedFiles = 0;

  for (const filePath of targets) {
    const report = await verifyFile(filePath, maxClaims);
    reports.push(report);

    const ok = report.failedHighPriority === 0 && (report.claimsChecked === 0 || report.verifiedClaims > 0);
    if (!ok) failedFiles += 1;

    const summary =
      `claims=${report.claimsChecked} verified=${report.verifiedClaims} avg=${report.avgConfidence} failedHigh=${report.failedHighPriority}`;
    console.log(`  ${ok ? '✅' : '❌'} ${report.file} (${summary})`);
  }

  const outDir = path.join(repoRoot, '.vc');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `content-verify-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2));
  console.log(`\nWrote ${path.relative(repoRoot, outPath)}`);

  if (failedFiles > 0) {
    console.error(`\n❌ Verification failed for ${failedFiles} file(s).`);
    process.exit(1);
  }

  console.log('\n✅ Verification passed.');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ content verification crashed:', error);
  process.exit(1);
});
