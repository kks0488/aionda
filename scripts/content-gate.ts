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
    const files = Array.isArray(parsed?.files) ? parsed.files.map(String) : [];
    const existing = files
      .filter((f) => typeof f === 'string' && f.trim().length > 0)
      .filter((f) => {
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
      const verifyCmd = `pnpm content:verify -- --files=${lastWritten.files.join(',')}`;
      const repairCmd = `pnpm content:repair -- --files=${lastWritten.files.join(',')}`;

      try {
        run(verifyCmd);
      } catch {
        console.log('\n❌ Verification failed. Attempting auto-repair (high-priority claims only)...');
        run(repairCmd);
        try {
          run(verifyCmd);
        } catch {
          console.log('\n❌ Verification still failed. Quarantining failed newly written posts and continuing...');
          const { remaining } = moveFailedNewPostsToCandidatePool(lastWritten.files);
          if (remaining.length === 0) {
            console.log('\n(no remaining newly written posts) Skipping content verification.');
          } else {
            const remainingVerifyCmd = `pnpm content:verify -- --files=${remaining.join(',')}`;
            run(remainingVerifyCmd);
          }
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
