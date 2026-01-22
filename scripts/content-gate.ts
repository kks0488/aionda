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

function run(cmd: string) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
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

function quarantineFailedNewPosts(lastWrittenFiles: string[]) {
  const repoRoot = process.cwd();
  const reportPath = findLatestVerifyReportPath();
  if (!reportPath) return { quarantined: [] as string[], remaining: lastWrittenFiles };

  let report: any;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return { quarantined: [] as string[], remaining: lastWrittenFiles };
  }

  const failedRelFiles = new Set<string>();
  for (const r of report?.reports || []) {
    const failedHigh = Number(r?.failedHighPriority || 0) > 0;
    const noVerified = Number(r?.claimsChecked || 0) > 0 && Number(r?.verifiedClaims || 0) === 0;
    if (failedHigh || noVerified) {
      if (typeof r?.file === 'string' && r.file.trim().length > 0) {
        failedRelFiles.add(r.file.replace(/\//g, path.sep));
      }
    }
  }

  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  const quarantineRoot = path.join(repoRoot, '.vc', 'quarantine', stamp);
  fs.mkdirSync(quarantineRoot, { recursive: true });

  const quarantined: string[] = [];
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

    const dest = path.join(quarantineRoot, normalizedRel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(abs, dest);
    quarantined.push(rel);
  }

  if (quarantined.length === 0) return { quarantined, remaining: lastWrittenFiles };

  const last = readLastWrittenEntries();
  if (last) {
    const keep = new Set(remaining.map((f) => f.replace(/\//g, path.sep)));
    const nextFiles = last.files.filter((f) => keep.has(f.replace(/\//g, path.sep)));
    const nextEntries = last.entries.filter((e) => {
      const entryFiles = Array.isArray(e?.files) ? e.files.map((x: any) => String(x)) : [];
      return entryFiles.some((f: string) => keep.has(f.replace(/\//g, path.sep)));
    });
    const next = {
      ...last.parsed,
      files: nextFiles,
      entries: nextEntries,
    };
    fs.writeFileSync(last.path, JSON.stringify(next, null, 2));
  }

  console.log(`\n⚠️ Quarantined ${quarantined.length} newly written post file(s) due to verification failure.`);
  console.log(`   Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`   Quarantine: ${path.relative(repoRoot, quarantineRoot)}`);

  return { quarantined, remaining };
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const verify = args.includes('--verify');

  run('pnpm content:fix-frontmatter');
  run('pnpm content:frontmatter:guard');
  run('pnpm content:fix-redirects');

  const lastWritten = readLastWrittenPostFiles();
  if (strict && lastWritten.files.length > 0) {
    const filesArg = lastWritten.files.join(',');
    run(`pnpm content:style-fix -- --files=${filesArg}`);
  }

  try {
    run(`pnpm content:lint${strict ? ' -- --strict' : ''}`);
  } catch (error) {
    if (!strict || lastWritten.files.length === 0) throw error;
    console.log('\n⚠️ Strict lint failed. Attempting deterministic style fix + retry...');
    const filesArg = lastWritten.files.join(',');
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
          const { remaining } = quarantineFailedNewPosts(lastWritten.files);
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
