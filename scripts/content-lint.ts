/**
 * Fast, repo-local content linter (no external binaries).
 *
 * Default: lint only changed post files.
 * Options:
 *   --all        Lint all posts
 *   --files=a,b  Lint specific post files (comma-separated, repo-relative)
 *   --strict     Fail on warnings (not just errors)
 */

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { execSync } from 'child_process';

type Severity = 'error' | 'warning' | 'suggestion';

interface LintIssue {
  file: string;
  severity: Severity;
  rule: string;
  message: string;
}

const POSTS_PREFIX = `${['apps', 'web', 'content', 'posts'].join(path.sep)}${path.sep}`;
const ABSOLUTE_PATTERN =
  /\b(guarantee|guarantees|100%|perfectly|impossible|completely|always|never|must)\b/i;
const TLDR_HEADING = /^##\s*(TL;DR|세\s*줄\s*요약|세줄\s*요약|간단\s*요약)\s*$/im;
const SOURCES_HEADING = /^##\s*(참고\s*자료|References|Sources)\s*$/im;
const SERIES_TAGS = ['k-ai-pulse', 'explainer', 'deep-dive'] as const;
const FIELD_NOTES_TAG = 'field-notes';
const FIELD_NOTES_DISCLOSURE_HEADING = /^##\s*(Disclosure|공개|면책)\s*$/im;
const FIELD_NOTES_ENV_HEADING = /^##\s*(환경|Environment|Setup)\s*$/im;
const KO_EXAMPLE_MARKER = /^\s*예:\s/m;
const EN_EXAMPLE_MARKER = /^\s*Example:\s/m;
const KO_CHECKLIST_MARKER = /\*\*오늘\s*바로\s*할\s*일:\*\*/i;
const EN_CHECKLIST_MARKER = /\*\*Checklist\s+for\s+Today:\*\*/i;
const FAQ_HEADING = /^##\s*FAQ\s*$/im;
const EVERGREEN_KW_SOURCE_ID_PREFIX = 'evergreen-kw-ko-';

const HYPE_WORDS = [
  'revolutionary',
  'game-changer',
  'groundbreaking',
  'unprecedented',
  'amazing',
  'incredible',
  'mind-blowing',
  'tremendous',
  'massive',
  'enormous',
  '혁명적',
  '게임체인저',
  '엄청난',
  '대단한',
  '놀라운',
];

const VAGUE_WORDS = [
  'very',
  'really',
  'extremely',
  'highly',
  'quite',
  'somewhat',
  'fairly',
  'rather',
  'pretty much',
  'a lot',
  'many',
  'some',
  'several',
  'various',
  'numerous',
  'countless',
  '매우',
  '정말',
  '엄청',
  '굉장히',
  '상당히',
  '많은',
  '여러',
  '다양한',
];

type ForbiddenExpressionRule = {
  phrase: string;
  suggestions: string[];
};

const FORBIDDEN_EXPRESSION_RULES: ForbiddenExpressionRule[] = [
  { phrase: '쉽게', suggestions: ['수월하게', '부담을 낮춰'] },
  { phrase: '간단하게', suggestions: ['단계를 줄여', '짧은 절차로'] },
  { phrase: '효과적으로', suggestions: ['근거 기반으로', '목표 대비 성과를 높여'] },
  { phrase: '다양한', suggestions: ['여러', '서로 다른'] },
  { phrase: '일반적으로', suggestions: ['대체로', '보통'] },
  { phrase: '대등한', suggestions: ['비슷한 수준의', '유사한 성능의'] },
  { phrase: '탁월한', suggestions: ['강점이 있는', '우수한'] },
];

function stripSourcesSection(markdown: string): string {
  const idx = markdown.search(SOURCES_HEADING);
  return idx === -1 ? markdown : markdown.slice(0, idx);
}

function normalizeTags(raw: unknown): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
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

function stripMarkdown(text: string): string {
  let t = text;
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`[^`]*`/g, ' ');
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  t = t.replace(/#+\s*/g, '');
  t = t.replace(/[*_>\-]{1,3}/g, ' ');
  return t;
}

function extractInternalLinks(markdown: string): string[] {
  const out: string[] = [];
  const re = /\]\((\/(?:ko|en)\/[^)\s]+)\)/g;
  for (const match of String(markdown || '').matchAll(re)) {
    const href = String(match[1] || '').trim();
    if (!href) continue;
    out.push(href);
  }
  return out;
}

function normalizeInternalHref(href: string): string {
  let value = String(href || '').trim();
  const hashIndex = value.indexOf('#');
  if (hashIndex >= 0) value = value.slice(0, hashIndex);
  const queryIndex = value.indexOf('?');
  if (queryIndex >= 0) value = value.slice(0, queryIndex);
  return value;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countWords(sentence: string): number {
  const matches = sentence.match(/\b[\w'-]+\b/g);
  return matches ? matches.length : 0;
}

function countBulletsInSection(markdown: string, heading: RegExp): number {
  const re = new RegExp(heading.source, heading.flags.includes('g') ? heading.flags : heading.flags + 'g');
  const match = re.exec(markdown);
  if (!match || typeof match.index !== 'number') return 0;

  const after = markdown.slice(match.index + match[0].length);
  const nextHeadingIndex = after.search(/^##\s+/m);
  const section = nextHeadingIndex === -1 ? after : after.slice(0, nextHeadingIndex);
  return section.split('\n').filter((line) => /^\s*-\s+/.test(line)).length;
}

function countBulletsAfterMarker(markdown: string, marker: RegExp): number {
  const match = marker.exec(markdown);
  if (!match || typeof match.index !== 'number') return 0;
  const after = markdown.slice(match.index + match[0].length);
  const nextHeadingIndex = after.search(/^##\s+/m);
  const section = nextHeadingIndex === -1 ? after : after.slice(0, nextHeadingIndex);
  return section.split('\n').filter((line) => /^\s*-\s+/.test(line)).length;
}

function getTldrBullets(markdown: string): string[] {
  const lines = markdown.split('\n');
  const headingIndex = lines.findIndex((line) => TLDR_HEADING.test(line));
  if (headingIndex === -1) return [];

  let endIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  return lines
    .slice(headingIndex + 1, endIndex)
    .filter((line) => /^\s*-\s+/.test(line))
    .map((line) => line.replace(/^\s*-\s+/, '').trim())
    .filter(Boolean);
}

function getFirstNarrativeLineAfterTldr(markdown: string): string | null {
  const lines = markdown.split('\n');
  const headingIndex = lines.findIndex((line) => TLDR_HEADING.test(line));
  if (headingIndex === -1) return null;

  let endIndex = lines.length;
  for (let i = headingIndex + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  for (let i = endIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^##\s+/.test(line)) continue;
    return line;
  }
  return null;
}

function extractParagraphStartingWith(markdown: string, startsWith: RegExp): string | null {
  const lines = markdown.split('\n');
  const startIndex = lines.findIndex((line) => startsWith.test(line));
  if (startIndex === -1) return null;

  const para: string[] = [lines[startIndex]];
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break;
    if (/^##\s+/.test(line)) break;
    para.push(line);
  }
  return para.join(' ').replace(/\s+/g, ' ').trim();
}

function extractHeadingSection(markdown: string, heading: RegExp): string {
  const raw = String(markdown || '');
  const re = new RegExp(heading.source, heading.flags);
  const match = re.exec(raw);
  if (!match || typeof match.index !== 'number') return '';

  const after = raw.slice(match.index + match[0].length);
  const nextHeadingIndex = after.search(/^##\s+/m);
  return (nextHeadingIndex === -1 ? after : after.slice(0, nextHeadingIndex)).trim();
}

function countFaqPairs(markdown: string): number {
  const section = extractHeadingSection(markdown, FAQ_HEADING);
  if (!section) return 0;
  const q = section.match(/^\s*(?:\*\*)?\s*Q[:：]\s*.+/gim) || [];
  const a = section.match(/^\s*(?:\*\*)?\s*A[:：]\s*.+/gim) || [];
  return Math.min(q.length, a.length);
}

function includesAny(textLower: string, terms: string[]): string | null {
  for (const term of terms) {
    if (!term) continue;
    if (textLower.includes(term.toLowerCase())) return term;
  }
  return null;
}

function offsetToLineCol(text: string, offset: number): { line: number; col: number } {
  const normalized = text.slice(0, Math.max(0, offset));
  const lines = normalized.split('\n');
  return {
    line: lines.length,
    col: (lines[lines.length - 1] || '').length + 1,
  };
}

function warnForbiddenExpressions(file: string, body: string) {
  for (const rule of FORBIDDEN_EXPRESSION_RULES) {
    let startAt = 0;
    while (startAt < body.length) {
      const idx = body.indexOf(rule.phrase, startAt);
      if (idx === -1) break;
      const { line, col } = offsetToLineCol(body, idx);
      console.warn(
        `⚠️ ${file}:${line}:${col} [forbidden_expression] "${rule.phrase}" 감지됨. 대체 제안: ${rule.suggestions.join(' | ')}`
      );
      startAt = idx + rule.phrase.length;
    }
  }
}

function main() {
  const args = process.argv.slice(2);
  const lintAll = args.includes('--all');
  const strict = args.includes('--strict');
  const filesOverride = parseFilesArg(args);

  const repoRoot = process.cwd();
  const allPostFiles = walkAllPosts(path.join(repoRoot, 'apps', 'web', 'content', 'posts'));
  const changedPostFiles = listChangedPostFiles();
  const targets =
    filesOverride.length > 0
      ? filesOverride
          .map((f) => (path.isAbsolute(f) ? f : path.join(repoRoot, f)))
          .filter((f) => fs.existsSync(f))
          .filter(isPostFile)
      : lintAll
        ? allPostFiles
        : changedPostFiles;

  if (targets.length === 0) {
    if (filesOverride.length > 0) {
      console.log('No matching post files found for --files.');
    } else {
      console.log(lintAll ? 'No posts found.' : 'No changed post files to lint.');
    }
    process.exit(0);
  }

  const issues: LintIssue[] = [];

  for (const fullPath of targets) {
    const rel = path.relative(repoRoot, fullPath);
    const locale = rel.includes(`${POSTS_PREFIX}en${path.sep}`) ? 'en' : rel.includes(`${POSTS_PREFIX}ko${path.sep}`) ? 'ko' : 'unknown';

    const raw = fs.readFileSync(fullPath, 'utf8');
    let parsed: { content: string };
    try {
      parsed = matter(raw);
    } catch (error: any) {
      issues.push({
        file: rel,
        severity: 'error',
        rule: 'frontmatter_parse',
        message: error?.message || 'Failed to parse frontmatter',
      });
      continue;
    }

    const content = parsed.content || '';
    const frontmatter = (parsed as unknown as { data?: Record<string, unknown> }).data || {};
    const sourceId = typeof frontmatter.sourceId === 'string' ? frontmatter.sourceId.trim() : '';
    const isEvergreenKw = sourceId.startsWith(EVERGREEN_KW_SOURCE_ID_PREFIX);
    const primaryKeyword = typeof frontmatter.primaryKeyword === 'string' ? frontmatter.primaryKeyword.trim() : '';
    const intentRaw = typeof frontmatter.intent === 'string' ? frontmatter.intent.trim().toLowerCase() : '';
    const intent =
      intentRaw === 'informational' || intentRaw === 'commercial' || intentRaw === 'troubleshooting'
        ? intentRaw
        : '';
    const topicId = typeof frontmatter.topic === 'string' ? frontmatter.topic.trim() : '';
    const schemaRaw = typeof frontmatter.schema === 'string' ? frontmatter.schema.trim().toLowerCase() : '';
    const schema = schemaRaw === 'faq' || schemaRaw === 'howto' ? (schemaRaw as 'faq' | 'howto') : '';
    const tags = normalizeTags(frontmatter.tags);
    const seriesTags = tags.filter((t) => (SERIES_TAGS as readonly string[]).includes(t));
    const isFieldNotes = tags.includes(FIELD_NOTES_TAG);
    if (seriesTags.length === 0) {
      issues.push({
        file: rel,
        severity: 'warning',
        rule: 'series_tag',
        message: `Add exactly one series tag: ${SERIES_TAGS.join(' | ')}`,
      });
    } else if (seriesTags.length > 1) {
      issues.push({
        file: rel,
        severity: 'warning',
        rule: 'series_tag',
        message: `Multiple series tags found (${seriesTags.join(', ')}). Keep exactly one.`,
      });
    }

    if (isEvergreenKw) {
      if (!primaryKeyword) {
        issues.push({
          file: rel,
          severity: 'warning',
          rule: 'evergreen_primary_keyword',
          message: 'Evergreen keyword posts require `primaryKeyword` in frontmatter.',
        });
      }

      if (!intent) {
        issues.push({
          file: rel,
          severity: 'warning',
          rule: 'evergreen_intent',
          message: 'Evergreen keyword posts require `intent` in frontmatter (informational | commercial | troubleshooting).',
        });
      }

      if (!topicId) {
        issues.push({
          file: rel,
          severity: 'warning',
          rule: 'evergreen_topic',
          message: 'Evergreen keyword posts require `topic` in frontmatter (topic cluster id).',
        });
      }

      if (!schema) {
        issues.push({
          file: rel,
          severity: 'warning',
          rule: 'evergreen_schema',
          message: 'Evergreen keyword posts require `schema` in frontmatter (faq | howto).',
        });
      }
    }

    if (isFieldNotes) {
      const byline = typeof frontmatter.byline === 'string' ? frontmatter.byline.trim() : '';
      if (!byline) {
        issues.push({
          file: rel,
          severity: 'warning',
          rule: 'field_notes_byline',
          message:
            'Field Notes requires a transparent byline. Add `byline` in frontmatter (e.g., "작성: 홍길동(대리) · 편집: AI온다").',
        });
      }

      if (!FIELD_NOTES_DISCLOSURE_HEADING.test(content)) {
        issues.push({
          file: rel,
          severity: 'suggestion',
          rule: 'field_notes_disclosure',
          message:
            'Field Notes: add a short disclosure section (e.g., "## 공개" or "## Disclosure") to clarify sponsorship/relationship/purchase context.',
        });
      }

      if (!FIELD_NOTES_ENV_HEADING.test(content)) {
        issues.push({
          file: rel,
          severity: 'suggestion',
          rule: 'field_notes_environment',
          message:
            'Field Notes: add an environment/setup section (e.g., "## 환경" or "## Environment") so readers can reproduce your context.',
        });
      }
    }

    // Exclude the Sources/References section from stylistic checks to avoid
    // false positives from paper titles (e.g., "Talk Isn't Always Cheap").
    const lintableContent = stripSourcesSection(content);
    const text = stripMarkdown(lintableContent);
    const textLower = text.toLowerCase();
    warnForbiddenExpressions(rel, lintableContent);

    if (!TLDR_HEADING.test(content)) {
      issues.push({
        file: rel,
        severity: 'warning',
        rule: 'missing_tldr',
        message: 'Add a TL;DR section near the top (e.g., "## TL;DR" or "## 세 줄 요약") with 3 bullet points.',
      });
    } else {
      const bullets = countBulletsInSection(content, TLDR_HEADING);
      if (bullets !== 3) {
        issues.push({
          file: rel,
          severity: 'suggestion',
          rule: 'tldr_bullets',
          message: `TL;DR section has ${bullets} bullet(s). Aim for exactly 3.`,
        });
      }

      const bulletTexts = getTldrBullets(content);
      const third = bulletTexts[2] || '';
      if (third) {
        const thirdLower = third.toLowerCase();
        const genericFuture =
          locale === 'ko'
            ? /(ai는\s*앞으로|미래|앞으로는|결국|언젠가)/i.test(third)
            : /\b(in the future|going forward|eventually|over time)\b/i.test(thirdLower);
        if (genericFuture) {
          issues.push({
            file: rel,
            severity: 'suggestion',
            rule: 'tldr_action',
            message: 'Third TL;DR bullet should end with an action/check/decision rule, not a generic future statement.',
          });
        }
      }

      const firstNarrative = getFirstNarrativeLineAfterTldr(content);
      if (firstNarrative) {
        const badLead =
          locale === 'ko'
            ? /^(?:[^\s]{2,20}\s*)?(?:가|이)\s*(?:발표|출시|공개|업데이트)/.test(firstNarrative)
            : /\b(announced|released|launched|unveiled|updated)\b/i.test(firstNarrative) &&
              /^[A-Z][^\n]{0,80}$/.test(firstNarrative);
        if (badLead) {
          issues.push({
            file: rel,
            severity: 'suggestion',
            rule: 'hook',
            message: 'Avoid starting the first narrative sentence after TL;DR with “X announced/released…”. Lead with the user-visible change/impact.',
          });
        }
      }
    }

    if (locale === 'ko' && !KO_EXAMPLE_MARKER.test(content)) {
      issues.push({
        file: rel,
        severity: 'suggestion',
        rule: 'example_missing',
        message: 'Add exactly one clearly labeled hypothetical scene paragraph near the top starting with "예:"',
      });
    }

    if (locale === 'en' && !EN_EXAMPLE_MARKER.test(content)) {
      issues.push({
        file: rel,
        severity: 'suggestion',
        rule: 'example_missing',
        message: 'Add exactly one clearly labeled hypothetical scene paragraph near the top starting with "Example:"',
      });
    }

    const examplePara =
      locale === 'ko'
        ? extractParagraphStartingWith(content, /^\s*예:\s/m)
        : locale === 'en'
          ? extractParagraphStartingWith(content, /^\s*Example:\s/m)
          : null;
    if (examplePara && /\d/.test(examplePara)) {
      issues.push({
        file: rel,
        severity: 'suggestion',
        rule: 'example_digits',
        message: 'Avoid numeric digits (0-9) inside the labeled Example/예: paragraph.',
      });
    }

    if (schema === 'faq') {
      const severity: Severity = isEvergreenKw ? 'warning' : 'suggestion';
      if (!FAQ_HEADING.test(content)) {
        issues.push({
          file: rel,
          severity,
          rule: 'faq_section_missing',
          message: 'schema=faq: add a dedicated "## FAQ" section (used for FAQPage JSON-LD).',
        });
      } else {
        const pairs = countFaqPairs(content);
        if (pairs < 2) {
          issues.push({
            file: rel,
            severity,
            rule: 'faq_pairs',
            message: `schema=faq: found ${pairs} Q/A pair(s). Add at least 2 for rich results.`,
          });
        }
      }
    }

    if (locale === 'ko') {
      const severity: Severity = schema === 'howto' ? 'warning' : 'suggestion';
      if (!KO_CHECKLIST_MARKER.test(content)) {
        issues.push({
          file: rel,
          severity,
          rule: 'checklist_missing',
          message: 'Under "## 실전 적용", include "**오늘 바로 할 일:**" with exactly 3 bullet points.',
        });
      } else {
        const bullets = countBulletsAfterMarker(content, KO_CHECKLIST_MARKER);
        if (bullets !== 3) {
          issues.push({
            file: rel,
            severity,
            rule: 'checklist_bullets',
            message: `Checklist has ${bullets} bullet(s). Aim for exactly 3.`,
          });
        }
      }
    }

    if (locale === 'en') {
      const severity: Severity = schema === 'howto' ? 'warning' : 'suggestion';
      if (!EN_CHECKLIST_MARKER.test(content)) {
        issues.push({
          file: rel,
          severity,
          rule: 'checklist_missing',
          message: 'Under "## Practical Application", include "**Checklist for Today:**" with exactly 3 bullet points.',
        });
      } else {
        const bullets = countBulletsAfterMarker(content, EN_CHECKLIST_MARKER);
        if (bullets !== 3) {
          issues.push({
            file: rel,
            severity,
            rule: 'checklist_bullets',
            message: `Checklist has ${bullets} bullet(s). Aim for exactly 3.`,
          });
        }
      }
    }

    {
      const internalLinks = extractInternalLinks(stripSourcesSection(content))
        .map(normalizeInternalHref)
        .filter(Boolean);
      const uniqueInternal = Array.from(new Set(internalLinks));
      const minLinks = 3;

      if (uniqueInternal.length < minLinks) {
        const severity: Severity = isEvergreenKw || Boolean(sourceId) ? 'warning' : 'suggestion';
        issues.push({
          file: rel,
          severity,
          rule: 'internal_links_min',
          message: `Add at least ${minLinks} internal links (topic hub + related posts). Found ${uniqueInternal.length}.`,
        });
      } else if (uniqueInternal.length === 1 && internalLinks.length >= minLinks) {
        issues.push({
          file: rel,
          severity: 'warning',
          rule: 'internal_links_unique',
          message: 'Internal links point to a single destination repeatedly. Add a few different related posts.',
        });
      }
    }

    if (!SOURCES_HEADING.test(content)) {
      issues.push({
        file: rel,
        severity: 'warning',
        rule: 'missing_sources',
        message: 'Include a "## 참고 자료" (or References/Sources) section with trusted links.',
      });
    } else {
      const bullets = countBulletsInSection(content, SOURCES_HEADING);
      if (bullets === 0) {
        issues.push({
          file: rel,
          severity: 'warning',
          rule: 'sources_empty',
          message: 'Sources section exists but has no bullet links.',
        });
      }
    }

    if (ABSOLUTE_PATTERN.test(text)) {
      issues.push({
        file: rel,
        severity: 'warning',
        rule: 'absolute_language',
        message: 'Avoid absolute claims (e.g., 100%, guarantee, impossible) unless directly supported by sources.',
      });
    }

    const hype = includesAny(textLower, HYPE_WORDS);
    if (hype) {
      issues.push({
        file: rel,
        severity: 'warning',
        rule: 'hype',
        message: `Avoid hype word: "${hype}"`,
      });
    }

    const vague = includesAny(textLower, VAGUE_WORDS);
    if (vague) {
      issues.push({
        file: rel,
        severity: 'suggestion',
        rule: 'vague',
        message: `Avoid vague word: "${vague}"`,
      });
    }

    if (locale === 'en') {
      const sentences = splitSentences(text);
      let longCount = 0;
      for (const s of sentences) {
        const words = countWords(s);
        if (words > 20) longCount += 1;
      }

      if (longCount > 0) {
        issues.push({
          file: rel,
          severity: 'suggestion',
          rule: 'sentence_length',
          message: `Found ${longCount} sentence(s) > 20 words.`,
        });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warning').length;
  const suggestionCount = issues.filter((i) => i.severity === 'suggestion').length;

  for (const issue of issues) {
    const prefix =
      issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : '💡';
    console.log(`${prefix} ${issue.file} [${issue.rule}] ${issue.message}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`Files linted: ${targets.length}`);
  console.log(`Errors: ${errorCount} | Warnings: ${warnCount} | Suggestions: ${suggestionCount}`);
  console.log('═'.repeat(60));

  if (errorCount > 0) process.exit(1);
  if (strict && warnCount > 0) process.exit(1);
  process.exit(0);
}

main();
