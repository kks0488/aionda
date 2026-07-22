export interface IndexingCandidate {
  date?: string;
  lastReviewedAt?: string;
  verificationScore?: number;
  sourceUrl?: string;
  content?: string;
}

export interface IndexingAssessment {
  indexable: boolean;
  reasons: string[];
}

const REFERENCE_HEADING = /^##\s*(참고\s*자료|References|Sources)\s*$/im;
const LOW_TRUST_HOST = /(dcinside\.com|reddit\.com|x\.com|twitter\.com|medium\.com)$/i;

function referenceDomains(markdown: string): Set<string> {
  const heading = REFERENCE_HEADING.exec(markdown);
  if (!heading || typeof heading.index !== 'number') return new Set();
  const section = markdown.slice(heading.index + heading[0].length);
  const domains = new Set<string>();

  const matches = section.match(/https?:\/\/[^\s)]+/g) || [];
  for (const rawUrl of matches) {
    try {
      const hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');
      if (!LOW_TRUST_HOST.test(hostname)) domains.add(hostname);
    } catch {
      // Ignore malformed legacy URLs.
    }
  }

  return domains;
}

function templateFingerprintCount(markdown: string): number {
  const patterns = [
    /^##\s*(TL;DR|세\s*줄\s*요약)\s*$/im,
    /^##\s*(FAQ|자주\s*묻는\s*질문)\s*$/im,
    /^##\s*(실전\s*적용|Practical Application)\s*$/im,
    /(오늘\s*바로\s*할\s*일|Checklist for Today)/i,
    /^##\s*(현황|Current State)\s*$/im,
    /^##\s*(분석|Analysis)\s*$/im,
  ];
  return patterns.filter((pattern) => pattern.test(markdown)).length;
}

/**
 * Conservative, reversible SEO gate for legacy programmatic content.
 * Pages remain available to readers, but thin or highly templated pages are
 * excluded from the sitemap and receive noindex until they are re-reviewed.
 */
export function assessPostIndexability(post: IndexingCandidate): IndexingAssessment {
  if (process.env.SEO_QUALITY_GATE === 'false') return { indexable: true, reasons: [] };
  const phase = Number.parseInt(process.env.SEO_QUALITY_PHASE || '1', 10);

  const reasons: string[] = [];
  const content = String(post.content || '');
  const score = Number(post.verificationScore);

  if (!Number.isFinite(score) || score < 0.8) reasons.push('verification-score-below-0.80');
  if (!post.lastReviewedAt) reasons.push('missing-review-date');
  if (content.replace(/\s+/g, '').length < 1200) reasons.push('thin-content');

  const trustedReferenceDomains = referenceDomains(content);
  if (trustedReferenceDomains.size < 2) reasons.push('fewer-than-two-independent-reference-domains');

  const hasLegacyTemplate = templateFingerprintCount(content) >= 4;
  if (hasLegacyTemplate) {
    reasons.push('legacy-fixed-template-footprint');
  }

  // A single legacy trait should not remove an otherwise useful page from
  // search. Score the evidence and editorial signals together.
  let qualityScore = 0;
  if (Number.isFinite(score) && score >= 0.8) qualityScore += 1;
  if (Number.isFinite(score) && score >= 0.85) qualityScore += 1;
  if (post.lastReviewedAt) qualityScore += 1;
  if (trustedReferenceDomains.size >= 2) qualityScore += 2;
  if (!hasLegacyTemplate) qualityScore += 2;

  const hardFailure =
    !Number.isFinite(score) ||
    score < 0.75 ||
    content.replace(/\s+/g, '').length < 1200 ||
    (score < 0.8 && trustedReferenceDomains.size < 2);

  // Phase 1 removes only the clearest high-risk pages. Phase 2 applies the
  // broader editorial score after Search Console exports have been reviewed.
  if (phase <= 1 && !hardFailure) return { indexable: true, reasons: [] };
  if (!hardFailure && qualityScore >= 4) return { indexable: true, reasons: [] };

  reasons.push('quality-score-below-indexing-threshold');
  return { indexable: false, reasons };
}
