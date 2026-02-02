/**
 * GitHub repo crawler (API-based)
 *
 * Why: GitHub Trending HTML is often rate-limited/unstable for bots. We use the
 * Search API instead to capture "what's hot" in AI dev tooling.
 *
 * Writes items into data/news as tier B "news" entries so the existing
 * extract-topics pipeline can consume them without changes.
 *
 * Usage:
 *   pnpm crawl-github
 *   pnpm crawl-github --since=7d --limit=20
 *
 * Env:
 *   GITHUB_CRAWL_SINCE=7d
 *   GITHUB_CRAWL_LIMIT=20
 *   GITHUB_CRAWL_QUERIES="llm,agent,mcp,rag"
 *   GITHUB_TOKEN or GH_TOKEN (optional; increases rate limit)
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

type SourceTier = 'S' | 'A' | 'B' | 'C';
type SourceType = 'official' | 'news';

interface FeedItem {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceTier: SourceTier;
  sourceType: SourceType;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  content?: string;
  categories?: string[];
  fetchedAt: string;
}

const NEWS_DIR = './data/news';
const DEFAULT_SINCE = (process.env.GITHUB_CRAWL_SINCE || process.env.TOPICS_SINCE || '7d').trim();
const DEFAULT_LIMIT = (() => {
  const raw = process.env.GITHUB_CRAWL_LIMIT;
  if (!raw) return 20;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 20;
})();
const DEFAULT_QUERIES = (process.env.GITHUB_CRAWL_QUERIES || 'llm,agent,mcp,rag')
  .split(',')
  .map((q) => q.trim())
  .filter(Boolean);

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

function getStartOfTodayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function parseSinceArg(raw?: string): Date | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!value) return null;

  if (value === 'all') return null;
  if (value === 'today') return getStartOfTodayLocal();

  const relative = value.match(/^(\d+)\s*(h|d)$/);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2];
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const ms = unit === 'h' ? amount * 60 * 60 * 1000 : amount * 24 * 60 * 60 * 1000;
    return new Date(Date.now() - ms);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getExistingIds(dir: string): Set<string> {
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.json') && !f.startsWith('._'))
      .map((f) => f.replace(/\.json$/, ''))
  );
}

function buildSearchQuery(keyword: string, since: Date | null): string {
  const base = `${keyword} in:name,description,readme fork:false archived:false stars:>50`;
  if (!since) return base;
  // Use "pushed" as a cheap proxy for "recently active" (closer to trending than created-only).
  return `${base} pushed:>${formatYmd(since)}`;
}

async function fetchJson<T>(url: string): Promise<{ ok: boolean; status: number; json: T | null; text: string }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'AIOnda/1.0 (GitHub Crawler)',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  const text = await response.text();
  let json: T | null = null;
  try {
    json = JSON.parse(text) as T;
  } catch {
    json = null;
  }
  return { ok: response.ok, status: response.status, json, text };
}

function truncate(value: string, max: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const AI_SIGNAL_PATTERN =
  /\b(ai|artificial intelligence|machine learning|deep learning|neural|llm|genai|gpt|openai|anthropic|claude|gemini|llama|qwen|kimi|rag|retrieval|embedding|vector|transformer|diffusion|multimodal|agentic|mcp)\b/i;

const STRONG_KEYWORD_PATTERNS: Record<string, RegExp[]> = {
  llm: [/\bllm\b/i, /large[-\s]?language model/i, /language model/i],
  agent: [/\bagentic\b/i, /\bmulti[-\s]?agent\b/i, /\bai\s*agent\b/i, /\bagent\b/i],
  mcp: [/\bmcp\b/i, /model context protocol/i],
  rag: [
    /\brag\b/i,
    /retrieval[-\s]?augmented/i,
    /retrieval augmented generation/i,
    /\bembedding\b/i,
    /\bvector\b/i,
  ],
};

function matchesStrongKeyword(keyword: string, text: string): boolean {
  const key = keyword.trim().toLowerCase();
  const patterns = STRONG_KEYWORD_PATTERNS[key];
  if (!patterns || patterns.length === 0) {
    const safe = escapeRegex(key);
    return new RegExp(`\\b${safe}\\b`, 'i').test(text);
  }
  return patterns.some((re) => re.test(text));
}

function hasAiSignal(text: string): boolean {
  return AI_SIGNAL_PATTERN.test(text);
}

function shouldIncludeRepo(keyword: string, repo: any): boolean {
  const fullName = String(repo?.full_name || '').trim();
  const description = String(repo?.description || '').trim();
  const language = String(repo?.language || '').trim();
  const topics = Array.isArray(repo?.topics) ? repo.topics.map(String) : [];

  const haystack = `${fullName}\n${description}\n${language}\n${topics.join(' ')}`.slice(0, 4000);
  if (!matchesStrongKeyword(keyword, haystack)) return false;
  if (!hasAiSignal(haystack)) return false;
  return true;
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  GitHub Search Crawler (AI dev tooling)');
  console.log('  Source: GitHub Search API → data/news (tier B)');
  console.log('═'.repeat(60) + '\n');

  const args = process.argv.slice(2);
  const sinceArg = args.find((a) => a.startsWith('--since='));
  const limitArg = args.find((a) => a.startsWith('--limit='));

  const since = parseSinceArg(sinceArg ? sinceArg.split('=')[1] : DEFAULT_SINCE);
  const perQueryLimit = (() => {
    if (!limitArg) return DEFAULT_LIMIT;
    const parsed = Number.parseInt(limitArg.split('=')[1] || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT;
  })();

  const keywords = DEFAULT_QUERIES.length > 0 ? DEFAULT_QUERIES : ['llm', 'agent', 'mcp', 'rag'];

  if (!existsSync(NEWS_DIR)) mkdirSync(NEWS_DIR, { recursive: true });
  const existingIds = getExistingIds(NEWS_DIR);

  console.log(`📁 Existing news items: ${existingIds.size}`);
  console.log(`⏱️  Since: ${since ? since.toISOString() : '(all time)'}`);
  console.log(`🔎 Keywords: ${keywords.join(', ')}`);
  console.log('');

  let totalNew = 0;
  let totalSkipped = 0;
  let totalFiltered = 0;

  for (const keyword of keywords) {
    const q = buildSearchQuery(keyword, since);
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${perQueryLimit}`;
    console.log(`📡 Query: ${q}`);

    const { ok, status, json, text } = await fetchJson<{ items?: any[]; message?: string }>(url);
    if (!ok || !json) {
      console.log(`   ❌ GitHub API failed (${status}): ${truncate(json?.message || text, 160)}`);
      continue;
    }

    const items = Array.isArray(json.items) ? json.items : [];
    console.log(`   ✅ Found: ${items.length}`);

    for (const repo of items) {
      const repoId = repo?.id;
      const fullName = String(repo?.full_name || '').trim();
      const htmlUrl = String(repo?.html_url || '').trim();
      if (!repoId || !fullName || !htmlUrl) continue;

      if (!shouldIncludeRepo(keyword, repo)) {
        totalFiltered++;
        continue;
      }

      const id = `github-${repoId}`;
      if (existingIds.has(id)) {
        totalSkipped++;
        continue;
      }

      const description = String(repo?.description || '').trim();
      const language = String(repo?.language || '').trim();
      const topics = Array.isArray(repo?.topics) ? repo.topics.map(String) : [];
      const stars = Number(repo?.stargazers_count || 0);
      const forks = Number(repo?.forks_count || 0);
      const pushedAt = String(repo?.pushed_at || repo?.updated_at || repo?.created_at || new Date().toISOString());
      const license = String(repo?.license?.spdx_id || repo?.license?.key || '').trim();

      const contentBits = [
        language ? `Language: ${language}` : '',
        Number.isFinite(stars) ? `Stars: ${stars}` : '',
        Number.isFinite(forks) ? `Forks: ${forks}` : '',
        license ? `License: ${license}` : '',
        topics.length > 0 ? `Topics: ${topics.slice(0, 8).join(', ')}` : '',
      ].filter(Boolean);

      const item: FeedItem = {
        id,
        sourceId: `github-search-${keyword}`,
        sourceName: `GitHub Search (${keyword})`,
        sourceTier: 'B',
        sourceType: 'news',
        title: description ? `${fullName} — ${truncate(description, 120)}` : fullName,
        link: htmlUrl,
        pubDate: pushedAt,
        contentSnippet: truncate(description, 500),
        content: truncate(contentBits.join(' | '), 2000),
        categories: topics.slice(0, 24),
        fetchedAt: new Date().toISOString(),
      };

      writeFileSync(join(NEWS_DIR, `${id}.json`), JSON.stringify(item, null, 2));
      existingIds.add(id);
      totalNew++;
    }

    // Light rate-limit (Search API has strict unauthenticated quotas).
    await new Promise((r) => setTimeout(r, token ? 350 : 900));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✨ Done!');
  console.log(`   New: ${totalNew}`);
  console.log(`   Skipped (existing): ${totalSkipped}`);
  console.log(`   Filtered (irrelevant): ${totalFiltered}`);
  console.log(`   Total news items: ${existingIds.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
