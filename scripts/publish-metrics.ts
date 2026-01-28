/**
 * Publish throughput + quality snapshot (deterministic, log-based).
 *
 * Goal: answer “are we hitting ~1 post/hour?” and “is the latest post structurally good?”
 *
 * Usage:
 *   pnpm -s tsx scripts/publish-metrics.ts
 *   pnpm -s tsx scripts/publish-metrics.ts --days=7
 */

import fs from 'fs';
import path from 'path';

// When piping output (e.g., `| head`), Node can throw EPIPE on further writes.
process.stdout.on('error', (error: any) => {
  if (error?.code === 'EPIPE') process.exit(0);
});

type RunOutcome =
  | 'published'
  | 'no_new_articles'
  | 'no_changes'
  | 'overlap_exit'
  | 'skipped_dirty_worktree'
  | 'skipped_not_on_main'
  | 'gate_failed'
  | 'blocked_push'
  | 'failed'
  | 'unknown';

type RunInfo = {
  start: Date;
  end?: Date;
  outcomes: Set<RunOutcome>;
  slugs: Array<{ at: Date; slug: string }>;
};

type PublishEvent = { at: Date; slug: string };

function parseIntArg(args: string[], name: string, fallback: number): number {
  const raw = args.find((a) => a.startsWith(`${name}=`))?.split('=')[1] ?? '';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatHms(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function parseLogFileDate(fileName: string): string | null {
  const m = fileName.match(/auto-publish-(\d{8})\.log$/);
  if (!m) return null;
  const d = m[1];
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function parseTimestamp(
  fileDateYmd: string,
  raw: { date?: string; time: string }
): Date | null {
  const ymd = raw.date || fileDateYmd;
  const iso = `${ymd}T${raw.time}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sum(values: number[]): number {
  return values.reduce((acc, n) => acc + n, 0);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
}

function readLines(filePath: string): string[] {
  return fs.readFileSync(filePath, 'utf8').split('\n');
}

function collectRunsFromLog(filePath: string): { runs: RunInfo[]; publishes: PublishEvent[] } {
  const fileName = path.basename(filePath);
  const fileDateYmd = parseLogFileDate(fileName) || formatYmd(new Date());

  const startRe = /^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\] Auto-publish started/;
  const doneRe = /^\[(?:(\d{4}-\d{2}-\d{2}) )?(\d{2}:\d{2}:\d{2})\] Auto-publish completed/;
  const successRe = /^\[(?:(\d{4}-\d{2}-\d{2}) )?(\d{2}:\d{2}:\d{2})\] SUCCESS: Published (.+)$/;

  const lines = readLines(filePath);
  const runs: RunInfo[] = [];
  const publishes: PublishEvent[] = [];
  let current: RunInfo | null = null;

  const finalize = () => {
    if (!current) return;
    runs.push(current);
    current = null;
  };

  for (const line of lines) {
    const start = startRe.exec(line);
    if (start) {
      finalize();
      const dt = parseTimestamp(fileDateYmd, { date: start[1], time: start[2] });
      if (!dt) continue;
      current = { start: dt, outcomes: new Set<RunOutcome>(), slugs: [] };
      continue;
    }

    if (!current) continue;

    const done = doneRe.exec(line);
    if (done) {
      const dt = parseTimestamp(fileDateYmd, { date: done[1] || undefined, time: done[2] });
      if (dt) current.end = dt;
      current.outcomes.add('unknown');
      continue;
    }

    const success = successRe.exec(line);
    if (success) {
      const dt = parseTimestamp(fileDateYmd, { date: success[1] || undefined, time: success[2] });
      const slug = String(success[3] || '').trim();
      if (dt && slug) {
        publishes.push({ at: dt, slug });
        current.slugs.push({ at: dt, slug });
        current.outcomes.add('published');
      }
      continue;
    }

    if (line.includes('Another auto-publish is running. Exiting.')) {
      current.outcomes.add('overlap_exit');
      continue;
    }

    if (line.includes('Worktree is dirty. Skipping auto-publish')) {
      current.outcomes.add('skipped_dirty_worktree');
      continue;
    }

    if (line.includes("Not on branch 'main'")) {
      current.outcomes.add('skipped_not_on_main');
      continue;
    }

    if (line.includes('❌ Gate failed. Aborting publish.')) {
      current.outcomes.add('gate_failed');
      continue;
    }

    if (line.includes('blocked: push failed') || line.includes('Push failed (commit preserved locally)')) {
      current.outcomes.add('blocked_push');
      continue;
    }

    if (line.includes('No new articles to publish')) {
      current.outcomes.add('no_new_articles');
      continue;
    }

    if (line.includes('No changes to commit')) {
      current.outcomes.add('no_changes');
      continue;
    }

    if (line.startsWith('failed: ') || line.includes('set_status \"failed:')) {
      current.outcomes.add('failed');
      continue;
    }
  }

  finalize();

  // Normalize outcomes per run.
  for (const run of runs) {
    if (run.outcomes.has('published')) continue;
    if (run.outcomes.has('gate_failed')) continue;
    if (run.outcomes.has('blocked_push')) continue;
    if (run.outcomes.has('skipped_dirty_worktree')) continue;
    if (run.outcomes.has('skipped_not_on_main')) continue;
    if (run.outcomes.has('overlap_exit')) continue;
    if (run.outcomes.has('no_new_articles')) continue;
    if (run.outcomes.has('no_changes')) continue;
    if (run.outcomes.has('failed')) continue;
    run.outcomes.add('unknown');
  }

  return { runs, publishes };
}

function limitToLastNDays(filePaths: string[], days: number): string[] {
  const withDate = filePaths
    .map((p) => ({ path: p, date: parseLogFileDate(path.basename(p)) }))
    .filter((x): x is { path: string; date: string } => Boolean(x.date));

  withDate.sort((a, b) => a.date.localeCompare(b.date));
  const selected = withDate.slice(Math.max(0, withDate.length - days)).map((x) => x.path);
  return selected;
}

function computeQualitySnapshotForSlug(repoRoot: string, slug: string): { ok: boolean; notes: string[] } {
  const notes: string[] = [];

  const pairs = [
    { locale: 'ko' as const, file: path.join(repoRoot, 'apps', 'web', 'content', 'posts', 'ko', `${slug}.mdx`) },
    { locale: 'en' as const, file: path.join(repoRoot, 'apps', 'web', 'content', 'posts', 'en', `${slug}.mdx`) },
  ];

  const tldrHeading = /^(##\s*(TL;DR|세\s*줄\s*요약)\s*)$/im;
  const koExample = /^\s*예:\s/m;
  const enExample = /^\s*Example:\s/m;
  const koChecklistLabel = /\*\*오늘\s*바로\s*할\s*일:\*\*/i;
  const enChecklistLabel = /\*\*Checklist\s+for\s+Today:\*\*/i;
  const koSources = /^##\s*참고\s*자료\s*$/im;
  const enSources = /^##\s*References\s*$/im;

  const countBulletsAfterMarker = (markdown: string, marker: RegExp): number => {
    const match = marker.exec(markdown);
    if (!match || typeof match.index !== 'number') return 0;
    const after = markdown.slice(match.index + match[0].length);
    const nextHeadingIndex = after.search(/^##\s+/m);
    const section = nextHeadingIndex === -1 ? after : after.slice(0, nextHeadingIndex);
    return section.split('\n').filter((line) => /^\s*-\s+/.test(line)).length;
  };

  for (const p of pairs) {
    if (!fs.existsSync(p.file)) {
      notes.push(`[${p.locale}] missing file: ${path.relative(repoRoot, p.file)}`);
      continue;
    }

    const raw = fs.readFileSync(p.file, 'utf8');
    const content = raw.replace(/^---[\s\S]*?---\s*/m, ''); // strip frontmatter

    if (!tldrHeading.test(content)) {
      notes.push(`[${p.locale}] missing TL;DR heading`);
    } else {
      const bullets = countBulletsAfterMarker(content, tldrHeading);
      if (bullets !== 3) notes.push(`[${p.locale}] TL;DR bullets=${bullets} (expected 3)`);
    }

    if (p.locale === 'ko') {
      if (!koExample.test(content)) notes.push('[ko] missing "예:" paragraph');
      if (!koChecklistLabel.test(content)) notes.push('[ko] missing "**오늘 바로 할 일:**"');
      if (koChecklistLabel.test(content)) {
        const bullets = countBulletsAfterMarker(content, koChecklistLabel);
        if (bullets !== 3) notes.push(`[ko] checklist bullets=${bullets} (expected 3)`);
      }
      if (!koSources.test(content)) notes.push('[ko] missing sources section (## 참고 자료)');
    } else {
      if (!enExample.test(content)) notes.push('[en] missing "Example:" paragraph');
      if (!enChecklistLabel.test(content)) notes.push('[en] missing "**Checklist for Today:**"');
      if (enChecklistLabel.test(content)) {
        const bullets = countBulletsAfterMarker(content, enChecklistLabel);
        if (bullets !== 3) notes.push(`[en] checklist bullets=${bullets} (expected 3)`);
      }
      if (!enSources.test(content)) notes.push('[en] missing sources section (## References)');
    }
  }

  return { ok: notes.length === 0, notes };
}

function main() {
  const args = process.argv.slice(2);
  const days = parseIntArg(args, '--days', 7);

  const repoRoot = process.cwd();
  const logsDir = path.join(repoRoot, 'logs');
  const logFiles = fs.existsSync(logsDir)
    ? fs
        .readdirSync(logsDir)
        .filter((f) => /^auto-publish-\d{8}\.log$/.test(f))
        .map((f) => path.join(logsDir, f))
        .sort()
    : [];

  const targets = limitToLastNDays(logFiles, days);
  const allRuns: RunInfo[] = [];
  const allPublishes: PublishEvent[] = [];

  for (const filePath of targets) {
    const { runs, publishes } = collectRunsFromLog(filePath);
    allRuns.push(...runs);
    allPublishes.push(...publishes);
  }

  allRuns.sort((a, b) => a.start.getTime() - b.start.getTime());
  allPublishes.sort((a, b) => a.at.getTime() - b.at.getTime());

  const now = new Date();
  const last24hCut = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const publishes24h = allPublishes.filter((p) => p.at >= last24hCut);

  const goalPerHour = 1;
  const goal24h = 24 * goalPerHour;
  const goalNDays = days * 24 * goalPerHour;

  const durationsSec = allRuns
    .map((r) => (r.end ? (r.end.getTime() - r.start.getTime()) / 1000 : null))
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 24 * 3600);

  const outcomeCounts = new Map<RunOutcome, number>();
  const bump = (k: RunOutcome) => outcomeCounts.set(k, (outcomeCounts.get(k) || 0) + 1);
  for (const run of allRuns) {
    // Choose the most “informative” outcome (published wins).
    if (run.outcomes.has('published')) bump('published');
    else if (run.outcomes.has('gate_failed')) bump('gate_failed');
    else if (run.outcomes.has('blocked_push')) bump('blocked_push');
    else if (run.outcomes.has('skipped_dirty_worktree')) bump('skipped_dirty_worktree');
    else if (run.outcomes.has('skipped_not_on_main')) bump('skipped_not_on_main');
    else if (run.outcomes.has('overlap_exit')) bump('overlap_exit');
    else if (run.outcomes.has('no_new_articles')) bump('no_new_articles');
    else if (run.outcomes.has('no_changes')) bump('no_changes');
    else if (run.outcomes.has('failed')) bump('failed');
    else bump('unknown');
  }

  const latest = allPublishes.length > 0 ? allPublishes[allPublishes.length - 1] : null;
  const intervalsMin = allPublishes
    .slice(1)
    .map((p, i) => (p.at.getTime() - allPublishes[i].at.getTime()) / 1000 / 60)
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 7 * 24 * 60);

  console.log('\n' + '═'.repeat(72));
  console.log('Auto-publish Throughput & Quality Snapshot');
  console.log('═'.repeat(72));
  console.log(`Now: ${formatYmd(now)} ${formatHms(now)}`);
  console.log(`Window: last ${days} day(s)`);

  if (latest) {
    console.log(`Last publish: ${formatYmd(latest.at)} ${formatHms(latest.at)}  slug=${latest.slug}`);
  } else {
    console.log('Last publish: (none found in selected log window)');
  }

  console.log('\nThroughput');
  console.log(`- Last 24h: ${publishes24h.length}/${goal24h}  (${(publishes24h.length / goal24h * 100).toFixed(1)}%)`);
  console.log(`- Last ${days}d: ${allPublishes.length}/${goalNDays}  (${(allPublishes.length / goalNDays * 100).toFixed(1)}%)`);
  console.log(`- Avg/day: ${(allPublishes.length / days).toFixed(2)} | Avg/hour: ${(allPublishes.length / (days * 24)).toFixed(3)}`);

  if (intervalsMin.length > 0) {
    console.log('\nPublish intervals (minutes)');
    console.log(`- p50=${percentile(intervalsMin, 0.5).toFixed(1)}  p90=${percentile(intervalsMin, 0.9).toFixed(1)}  max=${Math.max(...intervalsMin).toFixed(1)}`);
  }

  if (durationsSec.length > 0) {
    console.log('\nRun duration (minutes)');
    console.log(`- p50=${(percentile(durationsSec, 0.5) / 60).toFixed(1)}  p90=${(percentile(durationsSec, 0.9) / 60).toFixed(1)}  max=${(Math.max(...durationsSec) / 60).toFixed(1)}`);
  }

  console.log('\nRun outcomes');
  const ordered: RunOutcome[] = [
    'published',
    'no_new_articles',
    'no_changes',
    'overlap_exit',
    'gate_failed',
    'blocked_push',
    'skipped_dirty_worktree',
    'skipped_not_on_main',
    'failed',
    'unknown',
  ];
  for (const key of ordered) {
    const count = outcomeCounts.get(key) || 0;
    if (count === 0) continue;
    console.log(`- ${key}: ${count}`);
  }

  console.log('\nRecent publishes');
  for (const p of allPublishes.slice(-10).reverse()) {
    console.log(`- ${formatYmd(p.at)} ${formatHms(p.at)}  ${p.slug}`);
  }

  if (latest) {
    const quality = computeQualitySnapshotForSlug(repoRoot, latest.slug);
    console.log('\nLatest post structural quality (deterministic)');
    console.log(`- ${quality.ok ? 'OK' : 'Needs review'} (${latest.slug})`);
    for (const note of quality.notes.slice(0, 12)) console.log(`  - ${note}`);
    if (quality.notes.length > 12) console.log(`  - ... +${quality.notes.length - 12} more`);
  }

  console.log('');
}

main();
