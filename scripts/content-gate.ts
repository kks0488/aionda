/**
 * Content quality gate for the pipeline.
 *
 * Runs deterministic fixers, then lints changed/new post files.
 *
 * Options:
 *   --strict   Fail on warnings (not just errors)
 *   --verify   Verify factual claims via SearchMode (slow, requires AI + Google Search)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const POSTS_PREFIX = `${['apps', 'web', 'content', 'posts'].join(path.sep)}${path.sep}`;
const TRANSIENT_VERIFY_NOTE_PATTERN = /(verification failed due to error|aborterror|timed out|parsing failed|unable to verify|search failed)/i;

function sleepMs(ms: number) {
  if (ms <= 0) return;
  // Synchronous sleep to keep this script simple (execSync-based).
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function run(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

function isPostFile(file: string): boolean {
  return (
    file.includes(POSTS_PREFIX) &&
    (file.endsWith('.mdx') || file.endsWith('.md'))
  );
}

function listChangedPostFiles(): string[] {
  const seen = new Set<string>();

  const read = (cmd: string): string => {
    try {
      return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    } catch {
      return '';
    }
  };

  const add = (output: string) => {
    for (const raw of output.split('\n')) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      seen.add(trimmed.replace(/\//g, path.sep));
    }
  };

  // Unstaged + staged changes, plus untracked new files.
  add(read('git diff --name-only --diff-filter=ACMR'));
  add(read('git diff --name-only --diff-filter=ACMR --cached'));
  add(read('git ls-files --others --exclude-standard'));

  return Array.from(seen).filter(isPostFile);
}

function unionFiles(a: string[], b: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of [...a, ...b]) {
    const normalized = item.replace(/\//g, path.sep);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function readLastWrittenPostFiles(): { exists: boolean; files: string[] } {
  const repoRoot = process.cwd();
  const lastWrittenPath = path.join(repoRoot, '.vc', 'last-written.json');
  if (!fs.existsSync(lastWrittenPath)) return { exists: false, files: [] };

  try {
    const raw = fs.readFileSync(lastWrittenPath, 'utf8');
    const parsed = JSON.parse(raw);
    const files: string[] = Array.isArray(parsed?.files)
      ? (parsed.files as unknown[]).map(String)
      : [];
    const existing = files
      .map((f) => f.trim())
      .filter((f) => f.length > 0)
      .filter((f: string) => {
        const abs = path.isAbsolute(f) ? f : path.join(repoRoot, f);
        return fs.existsSync(abs);
      });
    return {
      exists: true,
      files: existing,
    };
  } catch {
    return { exists: true, files: [] };
  }
}

function readLastWrittenEntries(): {
  path: string;
  parsed: any;
  files: string[];
  entries: Array<{ slug?: string; files?: string[] }>;
} | null {
  const repoRoot = process.cwd();
  const lastWrittenPath = path.join(repoRoot, '.vc', 'last-written.json');
  if (!fs.existsSync(lastWrittenPath)) return null;
  try {
    const raw = fs.readFileSync(lastWrittenPath, 'utf8');
    const parsed = JSON.parse(raw);
    const files = Array.isArray(parsed?.files) ? parsed.files.map(String) : [];
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    return { path: lastWrittenPath, parsed, files, entries };
  } catch {
    return null;
  }
}

function findLatestVerifyReportPath(): string | null {
  const repoRoot = process.cwd();
  const vcDir = path.join(repoRoot, '.vc');
  if (!fs.existsSync(vcDir)) return null;

  const candidates = fs
    .readdirSync(vcDir)
    .filter((f) => /^content-verify-\d+\.json$/.test(f))
    .map((f) => path.join(vcDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  return candidates[0] || null;
}

function isTransientVerifyNote(note: unknown): boolean {
  return TRANSIENT_VERIFY_NOTE_PATTERN.test(String(note || ''));
}

function normalizePath(value: string): string {
  return value.replace(/\//g, path.sep);
}

function readVerifyReport(reportPath: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return null;
  }
}

function analyzeVerifyReport(report: any, targets: string[]) {
  const targetSet = new Set(targets.map((t) => normalizePath(t)));
  const normalizedReports = Array.isArray(report?.reports) ? report.reports : [];

  const failingFiles: string[] = [];
  const hardRepairFiles: string[] = [];
  const transientOnlyFiles: string[] = [];
  const nonActionableFiles: string[] = [];

  for (const r of normalizedReports) {
    const file = typeof r?.file === 'string' ? normalizePath(r.file) : '';
    if (!file || !targetSet.has(file)) continue;

    const claimsChecked = Number(r?.claimsChecked || 0);
    const verifiedClaims = Number(r?.verifiedClaims || 0);
    const failedHigh = Number(r?.failedHighPriority || 0);
    const ok = failedHigh === 0 && (claimsChecked === 0 || verifiedClaims > 0);
    if (ok) continue;

    failingFiles.push(file);

    const results = Array.isArray(r?.results) ? r.results : [];
    const failedHighResults = results.filter((x: any) => x?.priority === 'high' && x?.verified === false);
    const transientHigh = failedHighResults.filter((x: any) => isTransientVerifyNote(x?.notes));
    const hardHigh = failedHighResults.filter((x: any) => !isTransientVerifyNote(x?.notes));

    if (hardHigh.length > 0) {
      hardRepairFiles.push(file);
      continue;
    }

    if (failedHighResults.length > 0 && transientHigh.length === failedHighResults.length) {
      transientOnlyFiles.push(file);
      continue;
    }

    // Example: verifiedClaims==0 but no high failures => nothing the current repair script can fix.
    nonActionableFiles.push(file);
  }

  return {
    failingFiles: Array.from(new Set(failingFiles)),
    hardRepairFiles: Array.from(new Set(hardRepairFiles)),
    transientOnlyFiles: Array.from(new Set(transientOnlyFiles)),
    nonActionableFiles: Array.from(new Set(nonActionableFiles)),
  };
}

function verifyWithSelfHeal(files: string[]) {
  const repoRoot = process.cwd();
  const normalized = files.map((f) => normalizePath(f));
  const filesArg = normalized.join(',');
  const verifyCmd = `pnpm content:verify -- --files=${filesArg}`;

  const MAX_REPAIR_PASSES = 3;
  const MAX_TRANSIENT_RETRIES = 2;

  let repairPasses = 0;
  let transientRetries = 0;

  while (true) {
    try {
      run(verifyCmd);
      return;
    } catch {
      // continue
    }

    const reportPath = findLatestVerifyReportPath();
    if (!reportPath) {
      throw new Error('Verification failed but no content-verify report was found.');
    }
    const report = readVerifyReport(reportPath);
    if (!report) {
      throw new Error(`Verification failed and report could not be parsed: ${path.relative(repoRoot, reportPath)}`);
    }

    const analysis = analyzeVerifyReport(report, normalized);

    if (analysis.hardRepairFiles.length > 0 && repairPasses < MAX_REPAIR_PASSES) {
      repairPasses += 1;
      transientRetries = 0;
      const relReport = path.relative(repoRoot, reportPath);
      const repairFilesArg = analysis.hardRepairFiles.join(',');
      console.log(
        `\n❌ Verification failed (hard). Attempting auto-repair pass ${repairPasses}/${MAX_REPAIR_PASSES}...`
      );
      run(`pnpm content:repair -- --report=${relReport} --files=${repairFilesArg}`);
      continue;
    }

    const onlyTransient =
      analysis.failingFiles.length > 0 &&
      analysis.transientOnlyFiles.length === analysis.failingFiles.length &&
      analysis.nonActionableFiles.length === 0 &&
      analysis.hardRepairFiles.length === 0;

    if (onlyTransient && transientRetries < MAX_TRANSIENT_RETRIES) {
      transientRetries += 1;
      const backoffMs = 2000 * transientRetries;
      console.log(
        `\n⚠️ Verification failed due to transient errors only. Retrying (${transientRetries}/${MAX_TRANSIENT_RETRIES}) after ${backoffMs}ms...`
      );
      sleepMs(backoffMs);
      continue;
    }

    throw new Error(
      `Verification still failing after self-heal (repairs=${repairPasses}, transientRetries=${transientRetries}).`
    );
  }
}

function moveFailedNewPostsToCandidatePool(lastWrittenFiles: string[]) {
  const repoRoot = process.cwd();
  const reportPath = findLatestVerifyReportPath();
  if (!reportPath) return { quarantined: [] as string[], remaining: lastWrittenFiles };

  const last = readLastWrittenEntries();

  let report: any;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return { quarantined: [] as string[], remaining: lastWrittenFiles };
  }

  const failedRelFiles = new Set<string>();
  const failureDetails: Record<
    string,
    { failedHighPriority: number; claimsChecked: number; verifiedClaims: number; avgConfidence: number }
  > = {};
  for (const r of report?.reports || []) {
    const failedHigh = Number(r?.failedHighPriority || 0) > 0;
    const noVerified = Number(r?.claimsChecked || 0) > 0 && Number(r?.verifiedClaims || 0) === 0;
    if (failedHigh || noVerified) {
      if (typeof r?.file === 'string' && r.file.trim().length > 0) {
        const rel = r.file.replace(/\//g, path.sep);
        failedRelFiles.add(rel);
        failureDetails[rel] = {
          failedHighPriority: Number(r?.failedHighPriority || 0),
          claimsChecked: Number(r?.claimsChecked || 0),
          verifiedClaims: Number(r?.verifiedClaims || 0),
          avgConfidence: Number(r?.avgConfidence || 0),
        };
      }
    }
  }

  // Keep ko/en (alternateLocale) pairs consistent:
  // if any file in a last-written entry failed verification, move the whole entry.
  if (last) {
    for (const entry of last.entries) {
      const entryFiles = Array.isArray(entry?.files) ? entry.files.map((x: any) => String(x)) : [];
      const normalized = entryFiles.map((f) => f.replace(/\//g, path.sep));
      const anyFailed = normalized.some((f) => failedRelFiles.has(f));
      if (!anyFailed) continue;
      for (const f of normalized) failedRelFiles.add(f);
    }
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const candidatePoolRoot = path.join(repoRoot, '.vc', 'candidate-pool', stamp);
  fs.mkdirSync(candidatePoolRoot, { recursive: true });

  const moved: string[] = [];
  const remaining: string[] = [];

  for (const rel of lastWrittenFiles.map((f) => f.replace(/\//g, path.sep))) {
    const normalizedRel = rel.startsWith(path.sep) ? rel.slice(1) : rel;
    const shouldQuarantine = failedRelFiles.has(normalizedRel);
    if (!shouldQuarantine) {
      remaining.push(rel);
      continue;
    }

    const abs = path.isAbsolute(rel) ? rel : path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;

    // Only quarantine newly written files (untracked) to avoid deleting existing posts.
    try {
      execSync(`git ls-files --error-unmatch ${JSON.stringify(rel.replace(/\\/g, '/'))}`, { stdio: 'ignore' });
      remaining.push(rel);
      continue;
    } catch {
      // untracked => ok to quarantine
    }

    const dest = path.join(candidatePoolRoot, normalizedRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(abs, dest);
    moved.push(rel);
  }

  if (moved.length === 0) return { quarantined: [], remaining: lastWrittenFiles };

  // Write a small manifest for the candidate pool entry.
  const manifest = {
    generatedAt: new Date().toISOString(),
    reason: 'verify_failed',
    report: path.relative(repoRoot, reportPath),
    files: moved.map((f) => f.replace(/\//g, path.sep)),
    details: Object.fromEntries(
      moved
        .map((f) => f.replace(/\//g, path.sep))
        .map((f) => [f, failureDetails[f] || null])
    ),
  };
  fs.writeFileSync(path.join(candidatePoolRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));

  if (last) {
    const keep = new Set(remaining.map((f) => f.replace(/\//g, path.sep)));
    const nextFiles = last.files.filter((f) => keep.has(f.replace(/\//g, path.sep)));
    const nextEntries = last.entries
      .map((e) => {
        const entryFiles = Array.isArray(e?.files) ? e.files.map((x: any) => String(x)) : [];
        const filteredFiles = entryFiles.filter((f: string) => keep.has(f.replace(/\//g, path.sep)));
        return { ...e, files: filteredFiles };
      })
      .filter((e) => Array.isArray(e?.files) && e.files.length > 0);
    const next = {
      ...last.parsed,
      files: nextFiles,
      entries: nextEntries,
    };
    fs.writeFileSync(last.path, JSON.stringify(next, null, 2));
  }

  console.log(`\n⚠️ Moved ${moved.length} newly written post file(s) to the candidate pool due to verification failure.`);
  console.log(`   Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`   Candidate pool: ${path.relative(repoRoot, candidatePoolRoot)}`);

  return { quarantined: moved, remaining };
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const verify = args.includes('--verify');

  run('pnpm content:fix-frontmatter');
  run('pnpm content:frontmatter:guard');
  run('pnpm content:fix-redirects');

  const lastWritten = readLastWrittenPostFiles();
  const changedPostFiles = listChangedPostFiles();
  const styleFixTargets = strict ? unionFiles(lastWritten.files, changedPostFiles) : [];

  if (strict && styleFixTargets.length > 0) {
    const filesArg = styleFixTargets.join(',');
    run(`pnpm content:style-fix -- --files=${filesArg}`);
  }

  try {
    run(`pnpm content:lint${strict ? ' -- --strict' : ''}`);
  } catch (error) {
    if (!strict || styleFixTargets.length === 0) throw error;
    console.log('\n⚠️ Strict lint failed. Attempting deterministic style fix + retry...');
    const filesArg = styleFixTargets.join(',');
    run(`pnpm content:style-fix -- --files=${filesArg}`);
    run('pnpm content:lint -- --strict');
  }

  if (verify) {
    if (lastWritten.files.length > 0) {
      try {
        verifyWithSelfHeal(lastWritten.files);
      } catch {
        console.log('\n❌ Verification still failed. Quarantining failed newly written posts and continuing...');
        const { remaining } = moveFailedNewPostsToCandidatePool(lastWritten.files);
        if (remaining.length === 0) {
          console.log('\n(no remaining newly written posts) Skipping content verification.');
        } else {
          verifyWithSelfHeal(remaining);
        }
      }
    } else if (lastWritten.exists) {
      console.log('\n(no newly written posts) Skipping content verification.');
    } else {
      try {
        run('pnpm content:verify');
      } catch {
        console.log('\n❌ Verification failed. Attempting auto-repair (high-priority claims only)...');
        run('pnpm content:repair');
        run('pnpm content:verify');
      }
    }
  }
}

main();
