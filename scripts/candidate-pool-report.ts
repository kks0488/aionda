/**
 * Candidate pool report
 *
 * Lists items moved into `.vc/candidate-pool/*` (verify-failed drafts)
 * and legacy `.vc/quarantine/*` folders.
 *
 * Usage:
 *   pnpm tsx scripts/candidate-pool-report.ts
 */

import fs from 'fs';
import path from 'path';

type Manifest = {
  generatedAt?: string;
  reason?: string;
  report?: string;
  files?: string[];
  details?: Record<
    string,
    { failedHighPriority?: number; claimsChecked?: number; verifiedClaims?: number; avgConfidence?: number } | null
  >;
};

function listDirs(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(root, d.name))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function readManifest(dir: string): Manifest | null {
  const p = path.join(dir, 'manifest.json');
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as Manifest;
  } catch {
    return null;
  }
}

function main() {
  const repoRoot = process.cwd();
  const vc = path.join(repoRoot, '.vc');
  const candidateRoot = path.join(vc, 'candidate-pool');
  const legacyRoot = path.join(vc, 'quarantine');

  const candidates = listDirs(candidateRoot);
  const legacy = listDirs(legacyRoot);

  const printBlock = (label: string, dir: string) => {
    const rel = path.relative(repoRoot, dir);
    const m = readManifest(dir);
    console.log(`\n- ${label}: ${rel}`);
    if (!m) return;
    if (m.generatedAt) console.log(`  generatedAt: ${m.generatedAt}`);
    if (m.reason) console.log(`  reason: ${m.reason}`);
    if (m.report) console.log(`  report: ${m.report}`);
    const files = Array.isArray(m.files) ? m.files : [];
    if (files.length > 0) console.log(`  files: ${files.length}`);
    for (const f of files.slice(0, 10)) {
      const d = m.details?.[f] || null;
      const suffix = d
        ? ` (failedHigh=${d.failedHighPriority ?? 0} claims=${d.claimsChecked ?? 0} ok=${d.verifiedClaims ?? 0})`
        : '';
      console.log(`    - ${f}${suffix}`);
    }
    if (files.length > 10) console.log(`    … +${files.length - 10} more`);
  };

  console.log('Candidate pool report');
  console.log('=====================');
  console.log(`candidate-pool entries: ${candidates.length}`);
  console.log(`legacy quarantine entries: ${legacy.length}`);

  for (const dir of candidates) printBlock('candidate', dir);
  for (const dir of legacy) printBlock('legacy', dir);
}

main();

