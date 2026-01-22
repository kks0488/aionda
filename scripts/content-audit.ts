import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

type Locale = 'en' | 'ko' | 'unknown';

type CoreCategory = 'agi' | 'llm' | 'robotics' | 'hardware' | 'news' | 'opinion';

const POSTS_DIR = path.join(process.cwd(), 'apps/web/content/posts');
const CORE_CATEGORIES: CoreCategory[] = ['agi', 'llm', 'robotics', 'hardware', 'news', 'opinion'];
const DERIVED_CORE_TAG_PATTERNS: Array<{ tag: 'agi' | 'robotics' | 'hardware' | 'llm'; regex: RegExp }> = [
  { tag: 'agi', regex: /agi|artificial general intelligence|superintelligence|초지능|범용.*인공지능/i },
  { tag: 'robotics', regex: /robot|로봇|humanoid|휴머노이드|boston dynamics|figure|drone|드론|자율주행/i },
  { tag: 'hardware', regex: /hardware|하드웨어|gpu|tpu|nvidia|chip|반도체|칩|blackwell|h100|b200|rubin|cuda|hbm/i },
  { tag: 'llm', regex: /llm|language model|언어.*모델|대형언어|transformer|트랜스포머|gpt|chatgpt|claude|gemini|llama/i },
];
const VERTEX_REDIRECT_PATTERN = /vertexaisearch\.cloud\.google\.com\/grounding-api-redirect\//i;
const ABSOLUTE_LANGUAGE_PATTERN =
  /\b(guarantee|guarantees|100%|perfectly|impossible|completely|always|never|must)\b/i;

interface AuditPercentiles {
  p10: number;
  p50: number;
  p90: number;
}

interface AuditReport {
  generatedAt: string;
  totalPosts: number;
  byLocale: Record<string, number>;
  missingFrontmatter: {
    slug: number;
    locale: number;
    description: number;
    sourceUrl: number;
    verificationScore: number;
    samples: {
      slug: string[];
      locale: string[];
      description: string[];
      sourceUrl: string[];
      verificationScore: string[];
    };
  };
  invalidAlternateLocale: {
    count: number;
    samples: Array<{ file: string; alternateLocale: string }>;
  };
  missingAlternateLocale: {
    count: number;
    samples: string[];
  };
  koOnlyPosts: {
    count: number;
    samples: string[];
  };
  contentChars: AuditPercentiles;
  linkCounts: AuditPercentiles;
  vertexRedirect: {
    posts: number;
    links: number;
    samples: string[];
  };
  absoluteLanguagePosts: {
    count: number;
    samples: string[];
  };
  enSentenceAvgWords: {
    postsMeasured: number;
    p10: number;
    p50: number;
    p90: number;
  };
  coreTagCoverage: Record<CoreCategory | 'anyCore', number>;
  postsMissingAnyCoreTag: {
    count: number;
    samples: string[];
  };
  derivedCoreCoverage: Record<'agi' | 'llm' | 'robotics' | 'hardware' | 'anyCore', number>;
  postsMissingAnyDerivedCoreTag: {
    count: number;
    samples: string[];
  };
  uniqueTags: number;
  topTags: Array<[string, number]>;
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('._')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!full.endsWith('.mdx') && !full.endsWith('.md')) continue;
    out.push(full);
  }
  return out;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const index = Math.floor(values.length * p);
  return values[Math.min(Math.max(index, 0), values.length - 1)];
}

function toPercentiles(values: number[]): AuditPercentiles {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
  };
}

function slugSet(dir: string): Set<string> {
  if (!fs.existsSync(dir)) return new Set();
  return new Set(
    fs
      .readdirSync(dir)
      .filter((file) => !file.startsWith('._'))
      .filter((file) => file.endsWith('.mdx') || file.endsWith('.md'))
      .map((file) => file.replace(/\.mdx?$/, ''))
  );
}

function alternateLocaleToFile(value: unknown): string | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  const match = raw.match(/^\/(en|ko)\/posts\/([^/]+)$/);
  if (!match) return null;
  const [, locale, slug] = match;
  return path.join(POSTS_DIR, locale, `${slug}.mdx`);
}

function stripMarkdown(text: string): string {
  let t = text;
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`[^`]*`/g, ' ');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  t = t.replace(/#+\s*/g, '');
  t = t.replace(/[*_>\-]{1,3}/g, ' ');
  return t;
}

function words(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}

function computeEnSentenceAvgWords(content: string): number | null {
  const plain = stripMarkdown(content);
  const sentences = plain
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const lengths = sentences
    .map((s) => words(s).length)
    .filter((n) => n >= 3 && n <= 80);

  if (lengths.length === 0) return null;
  return lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
}

function parseTags(raw: unknown): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : [raw];
  return items
    .map((t) => String(t).trim())
    .filter(Boolean)
    .map((t) => t.toLowerCase());
}

function deriveCoreTags(title: string, content: string, tags: string[]): Array<'agi' | 'llm' | 'robotics' | 'hardware'> {
  const combined = `${title}\n${tags.join(' ')}\n${content}`.toLowerCase();
  const derived = DERIVED_CORE_TAG_PATTERNS.filter(({ regex }) => regex.test(combined)).map(
    ({ tag }) => tag
  );
  return derived.length ? derived : ['llm'];
}

function sample<T>(items: T[], limit = 10): T[] {
  return items.slice(0, limit);
}

function generateMarkdown(report: AuditReport): string {
  const lines: string[] = [];

  lines.push(`# Content Audit`);
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push(`- Total posts: ${report.totalPosts}`);
  lines.push(`- Locales: ${Object.entries(report.byLocale).map(([k, v]) => `${k}=${v}`).join(', ')}`);
  lines.push('');
  lines.push('## Key Metrics');
  lines.push('');
  lines.push(
    `- Content length (chars): p10=${report.contentChars.p10}, p50=${report.contentChars.p50}, p90=${report.contentChars.p90}`
  );
  lines.push(
    `- Links per post: p10=${report.linkCounts.p10}, p50=${report.linkCounts.p50}, p90=${report.linkCounts.p90}`
  );
  lines.push(
    `- EN avg words/sentence: p10=${report.enSentenceAvgWords.p10}, p50=${report.enSentenceAvgWords.p50}, p90=${report.enSentenceAvgWords.p90}`
  );
  lines.push('');
  lines.push('## Integrity');
  lines.push('');
  lines.push(`- Invalid alternateLocale: ${report.invalidAlternateLocale.count}`);
  lines.push(`- Missing alternateLocale: ${report.missingAlternateLocale.count}`);
  lines.push(`- KO-only posts (no EN pair): ${report.koOnlyPosts.count}`);
  lines.push('');
  lines.push('## Sources');
  lines.push('');
  lines.push(
    `- Vertex redirect posts: ${report.vertexRedirect.posts} (links: ${report.vertexRedirect.links})`
  );
  lines.push(`- Posts with absolute language: ${report.absoluteLanguagePosts.count}`);
  lines.push('');
  lines.push('## Taxonomy');
  lines.push('');
  lines.push(
    `- Core category coverage (any): ${report.coreTagCoverage.anyCore}/${report.totalPosts}`
  );
  lines.push(`- Posts missing any core tag: ${report.postsMissingAnyCoreTag.count}`);
  lines.push(
    `- Derived core coverage (any): ${report.derivedCoreCoverage.anyCore}/${report.totalPosts}`
  );
  lines.push(`- Posts missing any derived core tag: ${report.postsMissingAnyDerivedCoreTag.count}`);
  lines.push(`- Unique tags: ${report.uniqueTags}`);
  lines.push('');
  lines.push('## Frontmatter Gaps');
  lines.push('');
  lines.push(
    `- Missing slug: ${report.missingFrontmatter.slug} | locale: ${report.missingFrontmatter.locale} | description: ${report.missingFrontmatter.description}`
  );
  lines.push(
    `- Missing sourceUrl: ${report.missingFrontmatter.sourceUrl} | verificationScore: ${report.missingFrontmatter.verificationScore}`
  );
  lines.push('');

  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const outArg = args.find((a) => a.startsWith('--out='));
  const formatArg = args.find((a) => a.startsWith('--format='));

  const outPath = outArg ? outArg.split('=')[1] : '';
  const format = formatArg ? formatArg.split('=')[1] : '';
  const outputFormat = format === 'md' || format === 'markdown' ? 'md' : 'json';

  const files = walk(POSTS_DIR);
  const byLocale: Record<string, number> = {};

  const missingSamples = {
    slug: [] as string[],
    locale: [] as string[],
    description: [] as string[],
    sourceUrl: [] as string[],
    verificationScore: [] as string[],
  };

  const invalidAlternateSamples: Array<{ file: string; alternateLocale: string }> = [];
  const missingAlternateSamples: string[] = [];
  const vertexSamples: string[] = [];
  const absoluteSamples: string[] = [];
  const missingCoreSamples: string[] = [];

  const contentSizes: number[] = [];
  const linkCounts: number[] = [];
  const enSentenceAvgs: number[] = [];

  const tagCounts = new Map<string, number>();
  const coreCoverage: Record<CoreCategory | 'anyCore', number> = {
    agi: 0,
    llm: 0,
    robotics: 0,
    hardware: 0,
    news: 0,
    opinion: 0,
    anyCore: 0,
  };

  const derivedCoverage: Record<'agi' | 'llm' | 'robotics' | 'hardware' | 'anyCore', number> = {
    agi: 0,
    llm: 0,
    robotics: 0,
    hardware: 0,
    anyCore: 0,
  };

  let missingSlug = 0;
  let missingLocale = 0;
  let missingDescription = 0;
  let missingSourceUrl = 0;
  let missingVerificationScore = 0;

  let invalidAlternate = 0;
  let missingAlternate = 0;
  let vertexRedirectPosts = 0;
  let vertexRedirectLinks = 0;
  let absoluteLanguagePosts = 0;
  let postsMissingCore = 0;
  let postsMissingDerivedCore = 0;
  const missingDerivedCoreSamples: string[] = [];

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    const locale = rel.includes('/posts/en/') ? 'en' : rel.includes('/posts/ko/') ? 'ko' : 'unknown';
    byLocale[locale] = (byLocale[locale] || 0) + 1;

    const raw = fs.readFileSync(file, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data || {};
    const content = parsed.content || '';
    const title = typeof data.title === 'string' ? data.title : '';

    const tags = parseTags(data.tags);
    for (const tag of tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);

    let hasAnyCore = false;
    for (const c of CORE_CATEGORIES) {
      if (tags.some((t) => t.includes(c))) {
        coreCoverage[c] += 1;
        hasAnyCore = true;
      }
    }
    if (hasAnyCore) {
      coreCoverage.anyCore += 1;
    } else {
      postsMissingCore += 1;
      if (missingCoreSamples.length < 10) missingCoreSamples.push(rel);
    }

    const derived = deriveCoreTags(title, content, tags);
    const derivedUnique = [...new Set(derived)];
    for (const d of derivedUnique) {
      derivedCoverage[d] += 1;
    }
    if (derivedUnique.length > 0) {
      derivedCoverage.anyCore += 1;
    } else {
      postsMissingDerivedCore += 1;
      if (missingDerivedCoreSamples.length < 10) missingDerivedCoreSamples.push(rel);
    }

    if (!data.slug) {
      missingSlug += 1;
      if (missingSamples.slug.length < 10) missingSamples.slug.push(rel);
    }

    if (!data.locale) {
      missingLocale += 1;
      if (missingSamples.locale.length < 10) missingSamples.locale.push(rel);
    }

    if (!data.description && !data.excerpt) {
      missingDescription += 1;
      if (missingSamples.description.length < 10) missingSamples.description.push(rel);
    }

    if (!data.sourceUrl) {
      missingSourceUrl += 1;
      if (missingSamples.sourceUrl.length < 10) missingSamples.sourceUrl.push(rel);
    }

    if (data.verificationScore === undefined) {
      missingVerificationScore += 1;
      if (missingSamples.verificationScore.length < 10) missingSamples.verificationScore.push(rel);
    }

    const rawAlternate = typeof data.alternateLocale === 'string' ? data.alternateLocale.trim() : '';
    if (!rawAlternate) {
      missingAlternate += 1;
      if (missingAlternateSamples.length < 10) missingAlternateSamples.push(rel);
    } else {
      const alternateFile = alternateLocaleToFile(rawAlternate);
      if (!alternateFile || !fs.existsSync(alternateFile)) {
        invalidAlternate += 1;
        if (invalidAlternateSamples.length < 10) {
          invalidAlternateSamples.push({
            file: rel,
            alternateLocale: rawAlternate,
          });
        }
      }
    }

    const links = [...content.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+)\)/g)].map((m) => m[1]);
    linkCounts.push(links.length);

    const vertexLinks = links.filter((u) => VERTEX_REDIRECT_PATTERN.test(u));
    if (vertexLinks.length > 0) {
      vertexRedirectPosts += 1;
      vertexRedirectLinks += vertexLinks.length;
      if (vertexSamples.length < 10) vertexSamples.push(rel);
    }

    if (ABSOLUTE_LANGUAGE_PATTERN.test(content)) {
      absoluteLanguagePosts += 1;
      if (absoluteSamples.length < 10) absoluteSamples.push(rel);
    }

    contentSizes.push(content.length);

    if (locale === 'en') {
      const avg = computeEnSentenceAvgWords(content);
      if (avg !== null) enSentenceAvgs.push(avg);
    }
  }

  // KO-only slugs (file-based)
  const enSlugs = slugSet(path.join(POSTS_DIR, 'en'));
  const koSlugs = slugSet(path.join(POSTS_DIR, 'ko'));
  const koOnly = [...koSlugs].filter((slug) => !enSlugs.has(slug)).sort();

  enSentenceAvgs.sort((a, b) => a - b);

  const report: AuditReport = {
    generatedAt: new Date().toISOString(),
    totalPosts: files.length,
    byLocale,
    missingFrontmatter: {
      slug: missingSlug,
      locale: missingLocale,
      description: missingDescription,
      sourceUrl: missingSourceUrl,
      verificationScore: missingVerificationScore,
      samples: missingSamples,
    },
    invalidAlternateLocale: {
      count: invalidAlternate,
      samples: invalidAlternateSamples,
    },
    missingAlternateLocale: {
      count: missingAlternate,
      samples: missingAlternateSamples,
    },
    koOnlyPosts: {
      count: koOnly.length,
      samples: sample(koOnly, 20),
    },
    contentChars: toPercentiles(contentSizes),
    linkCounts: toPercentiles(linkCounts),
    vertexRedirect: {
      posts: vertexRedirectPosts,
      links: vertexRedirectLinks,
      samples: vertexSamples,
    },
    absoluteLanguagePosts: {
      count: absoluteLanguagePosts,
      samples: absoluteSamples,
    },
    enSentenceAvgWords: {
      postsMeasured: enSentenceAvgs.length,
      p10: Number(percentile(enSentenceAvgs, 0.1).toFixed(1)),
      p50: Number(percentile(enSentenceAvgs, 0.5).toFixed(1)),
      p90: Number(percentile(enSentenceAvgs, 0.9).toFixed(1)),
    },
    coreTagCoverage: coreCoverage,
    postsMissingAnyCoreTag: {
      count: postsMissingCore,
      samples: missingCoreSamples,
    },
    derivedCoreCoverage: derivedCoverage,
    postsMissingAnyDerivedCoreTag: {
      count: postsMissingDerivedCore,
      samples: missingDerivedCoreSamples,
    },
    uniqueTags: tagCounts.size,
    topTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20),
  };

  const output = outputFormat === 'md' ? generateMarkdown(report) : JSON.stringify(report, null, 2);

  if (outPath) {
    fs.writeFileSync(outPath, output);
    console.log(`Wrote ${outPath}`);
  } else {
    console.log(output);
  }
}

main();
