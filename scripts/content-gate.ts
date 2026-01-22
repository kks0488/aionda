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
    return {
      exists: true,
      files: files.filter((f) => typeof f === 'string' && f.trim().length > 0),
    };
  } catch {
    return { exists: true, files: [] };
  }
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const verify = args.includes('--verify');

  run('pnpm content:fix-frontmatter');
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
        run(verifyCmd);
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
