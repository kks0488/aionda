/**
 * Auto-repair content using the latest content-verify report.
 *
 * Goal: make the publish pipeline self-healing when verification fails.
 *
 * Strategy (conservative):
 * - Only touches claims that are priority=high and verified=false
 * - If correctedText exists AND the exact claim text exists in the file, replace it.
 * - Otherwise, remove the line containing the claim text.
 *
 * Options:
 *   --report=path          Use a specific report JSON (default: latest .vc/content-verify-*.json)
 *   --files=a,b,c          Limit repairs to specific post files
 *   --dry-run              Print summary without writing files
 */

import fs from 'fs';
import path from 'path';

type Priority = 'high' | 'medium' | 'low';

interface ClaimResult {
  text: string;
  priority: Priority;
  verified: boolean;
  correctedText?: string;
}

interface FileReport {
  file: string; // repo-relative
  failedHighPriority: number;
  results: ClaimResult[];
}

interface VerificationBundle {
  generatedAt?: string;
  reports: FileReport[];
}

function parseCsvArg(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
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

function findLatestVerifyReport(repoRoot: string): string | null {
  const dir = path.join(repoRoot, '.vc');
  if (!fs.existsSync(dir)) return null;

  const candidates = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith('content-verify-') && f.endsWith('.json'))
    .map((f) => path.join(dir, f));

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const ma = fs.statSync(a).mtimeMs;
    const mb = fs.statSync(b).mtimeMs;
    return mb - ma;
  });

  return candidates[0];
}

function replaceAllExact(haystack: string, needle: string, replacement: string): string {
  if (!needle) return haystack;
  if (!haystack.includes(needle)) return haystack;
  return haystack.split(needle).join(replacement);
}

function shouldReplaceClaim(claimText: string, correctedText: string): boolean {
  const claim = String(claimText || '').trim();
  const corrected = String(correctedText || '').trim();
  if (!claim || !corrected) return false;

  // Prefer removing risky comparative/absolute rewrites rather than swapping in
  // a new sentence that may still be unverifiable (self-healing > completeness).
  const risky = /(대신|후순위|밀려|압도|지배|supplant|replace|replaced|dominat|always|never|impossible|guarantee|100%)/i;
  if (risky.test(corrected)) return false;

  // Avoid "corrections" that expand the claim substantially (often adds new facts).
  if (corrected.length > claim.length * 1.1) return false;

  return true;
}

function removeLineContaining(haystack: string, needle: string): { next: string; removed: boolean } {
  const idx = haystack.indexOf(needle);
  if (idx === -1) return { next: haystack, removed: false };

  const lineStart = haystack.lastIndexOf('\n', idx);
  const start = lineStart === -1 ? 0 : lineStart + 1;
  const lineEnd = haystack.indexOf('\n', idx + needle.length);
  const end = lineEnd === -1 ? haystack.length : lineEnd + 1;

  const next = haystack.slice(0, start) + haystack.slice(end);
  return { next, removed: true };
}

async function main() {
  const args = process.argv.slice(2);
  const reportArg = args.find((a) => a.startsWith('--report='));
  const dryRun = args.includes('--dry-run');
  const filesOverride = parseFilesArg(args);

  const repoRoot = process.cwd();
  const reportPath =
    (reportArg ? reportArg.split('=')[1] : '') ||
    findLatestVerifyReport(repoRoot) ||
    '';

  if (!reportPath || !fs.existsSync(reportPath)) {
    console.error('❌ No verification report found. Run `pnpm content:verify` first.');
    process.exit(1);
  }

  const bundle = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as VerificationBundle;
  const targetSet =
    filesOverride.length > 0
      ? new Set(
          filesOverride
            .map((f) => (path.isAbsolute(f) ? path.relative(repoRoot, f) : f))
            .map((f) => f.replace(/\//g, path.sep))
        )
      : null;

  let filesTouched = 0;
  let totalFixes = 0;

  for (const report of bundle.reports || []) {
    if (report.failedHighPriority <= 0) continue;
    if (targetSet && !targetSet.has(report.file)) continue;

    const fullPath = path.join(repoRoot, report.file);
    if (!fs.existsSync(fullPath)) continue;

    const original = fs.readFileSync(fullPath, 'utf8');
    let updated = original;
    let fileFixes = 0;

    for (const result of report.results || []) {
      if (result.priority !== 'high') continue;
      if (result.verified) continue;

      const claimText = String(result.text || '').trim();
      if (!claimText) continue;

      if (!updated.includes(claimText)) continue;

      const corrected = typeof result.correctedText === 'string' ? result.correctedText.trim() : '';

      if (corrected && shouldReplaceClaim(claimText, corrected)) {
        updated = replaceAllExact(updated, claimText, corrected);
        fileFixes += 1;
        continue;
      }

      const removed = removeLineContaining(updated, claimText);
      if (removed.removed) {
        updated = removed.next;
        fileFixes += 1;
      }
    }

    if (updated !== original) {
      filesTouched += 1;
      totalFixes += fileFixes;
      if (!dryRun) {
        fs.writeFileSync(fullPath, updated);
      }
    }
  }

  const relReport = path.relative(repoRoot, reportPath);
  console.log(`\n🧰 Content repair report: ${relReport}`);
  console.log(`Files touched: ${filesTouched}`);
  console.log(`High-priority fixes applied: ${totalFixes}`);
  if (dryRun) console.log('(dry-run) No files were modified.');
}

main().catch((error) => {
  console.error('❌ content repair crashed:', error);
  process.exit(1);
});
