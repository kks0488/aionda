/**
 * SearchMode Verification System
 * Based on REALITY_SYNC_KERNEL_V4_GUARD protocol
 *
 * Core Principles:
 * 1. Intellectual Honesty: 90% confidence threshold
 * 2. Fact over Assumption: No speculation
 * 3. Source Credibility Tiers: S/A/B/C classification
 * 4. Anti-Hallucination: No fabrication of sources
 */

// Source Credibility Tiers
export enum SourceTier {
  S = 'S', // Academic/Research - 🏛️
  A = 'A', // Official/Trusted - 🛡️
  B = 'B', // Caution Required - ⚠️
  C = 'C', // General - (no icon)
}

export interface VerifiedSource {
  url: string;
  title: string;
  tier: SourceTier;
  domain: string;
  icon: string;
  publishDate?: string;
  author?: string;
}

export interface SearchStrategy {
  keywords: string[];
  focus: string;
  academicRequired: boolean;
  domainFilters: string[];
}

export interface VerificationResult {
  timestamp: string;
  mode: 'online' | 'offline';
  strategy?: SearchStrategy;
  confidence: number;
  verified: boolean;
  sources: VerifiedSource[];
  notes: string;
  correctedText?: string;
}

// Tier S: Academic/Research Sources (🏛️)
const TIER_S_DOMAINS = [
  'scholar.google.com',
  'semanticscholar.org',
  'pubmed.ncbi.nlm.nih.gov',
  'openalex.org',
  'crossref.org',
  'core.ac.uk',
  'arxiv.org',
  'nature.com',
  'sciencedirect.com',
  'wiley.com',
  'springer.com',
  'ieee.org',
  'acm.org',
  'frontiersin.org',
];

// Tier A: Official/Trusted Sources (🛡️)
const TIER_A_PATTERNS = [
  /\.gov$/,
  /\.mil$/,
  /\.edu$/,
  /\.ac\.[a-z]{2}$/,
  /\.go\.kr$/,
  /(^|\.)europa\.eu$/,
  /(^|\.)eur-lex\.europa\.eu$/,
  /(^|\.)ilo\.org$/,
  /(^|\.)oecd\.org$/,
  /(^|\.)who\.int$/,
  /(^|\.)un\.org$/,
  /(^|\.)unicef\.org$/,
  /(^|\.)undp\.org$/,
  /(^|\.)worldbank\.org$/,
  /(^|\.)imf\.org$/,
  /(^|\.)wto\.org$/,
  /(^|\.)kiet\.re\.kr$/,
  /(^|\.)openai\.com$/,
  /(^|\.)anthropic\.com$/,
  /(^|\.)tsmc\.com$/,
  /google\.com\/(?:blog|research)/,
  /microsoft\.com\/(?:research|blog)/,
  /(^|\.)meta\.com$/,
  /(^|\.)nvidia\.com$/,
  /(^|\.)huggingface\.co$/,
  /(^|\.)techcrunch\.com$/,
  /(^|\.)arstechnica\.com$/,
  /(^|\.)venturebeat\.com$/,
  /(^|\.)technologyreview\.com$/,
  /(^|\.)wired\.com$/,
  /(^|\.)zdnet\.com$/,
  /(^|\.)theverge\.com$/,
  /(^|\.)time\.com$/,
  /thekurzweillibrary\.com/,
  /klri\.re\.kr/,
  /(^|\.)reuters\.com$/,
  /(^|\.)apnews\.com$/,
  /(^|\.)bbc\.com$/,
  /(^|\.)nytimes\.com$/,
  /(^|\.)yonhapnews\.co\.kr$/,
];

// Tier B: Caution Required (⚠️)
const TIER_B_PATTERNS = [
  /twitter\.com|x\.com/,
  /reddit\.com/,
  /facebook\.com/,
  /instagram\.com/,
  /linkedin\.com/,
  /stackoverflow\.com/,
  /quora\.com/,
  /dcinside\.com/,
  /namu\.wiki/,
  /wikipedia\.org/,
  /tistory\.com/,
  /medium\.com/,
  /youtube\.com/,
  /blog\./,
];

/**
 * Classify source URL into credibility tier
 */
export function classifySource(url: string): SourceTier {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();

    // Check Tier S (Academic)
    for (const sDomain of TIER_S_DOMAINS) {
      if (domain.includes(sDomain)) {
        return SourceTier.S;
      }
    }

    // Check Tier A (Official/Trusted)
    for (const pattern of TIER_A_PATTERNS) {
      if (pattern.test(domain) || pattern.test(url)) {
        return SourceTier.A;
      }
    }

    // Check Tier B (Caution)
    for (const pattern of TIER_B_PATTERNS) {
      if (pattern.test(domain) || pattern.test(url)) {
        return SourceTier.B;
      }
    }

    // Default: Tier C (General)
    return SourceTier.C;
  } catch {
    return SourceTier.C;
  }
}

/**
 * Get icon for source tier
 */
export function getTierIcon(tier: SourceTier): string {
  switch (tier) {
    case SourceTier.S:
      return '🏛️';
    case SourceTier.A:
      return '🛡️';
    case SourceTier.B:
      return '⚠️';
    case SourceTier.C:
    default:
      return '';
  }
}

/**
 * Build search strategy for a claim
 */
export function buildSearchStrategy(claim: {
  text: string;
  type: string;
  entities?: string[];
  searchQueries?: string[];
}): SearchStrategy {
  const keywords: string[] = [];
  const domainFilters: string[] = [];

  // Add entities as keywords
  if (claim.entities) {
    keywords.push(...claim.entities);
  }

  // Add search queries if provided
  if (claim.searchQueries) {
    keywords.push(...claim.searchQueries);
  }

  // Determine if academic sources are required
  const academicTypes = ['research', 'benchmark', 'technical_spec', 'comparison'];
  const academicRequired = academicTypes.includes(claim.type);

  // Add domain filters for academic claims
  if (academicRequired) {
    domainFilters.push(
      'site:arxiv.org',
      'site:openai.com',
      'site:anthropic.com',
      'site:huggingface.co'
    );
  }

  // Add official sources for company statements
  if (claim.type === 'company_statement' && claim.entities) {
    for (const entity of claim.entities) {
      const entityLower = entity.toLowerCase();
      if (entityLower.includes('openai')) {
        domainFilters.push('site:openai.com');
      } else if (entityLower.includes('anthropic') || entityLower.includes('claude')) {
        domainFilters.push('site:anthropic.com');
      } else if (entityLower.includes('google') || entityLower.includes('gemini')) {
        domainFilters.push('site:blog.google', 'site:deepmind.google', 'site:ai.google.dev');
      } else if (entityLower.includes('meta') || entityLower.includes('llama')) {
        domainFilters.push('site:ai.meta.com');
      } else if (entityLower.includes('deepseek')) {
        domainFilters.push('site:deepseek.com');
      }
    }
  }

  return {
    keywords,
    focus: claim.type,
    academicRequired,
    domainFilters,
  };
}

/**
 * Create verified source object
 */
export function createVerifiedSource(
  url: string,
  title: string,
  publishDate?: string,
  author?: string
): VerifiedSource {
  const tier = classifySource(url);
  let domain = '';
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  return {
    url,
    title,
    tier,
    domain,
    icon: getTierIcon(tier),
    publishDate,
    author,
  };
}

/**
 * Format sources for output (H0_Data_Formatter compliant)
 */
export function formatSourcesOutput(sources: VerifiedSource[]): string {
  if (sources.length === 0) {
    return '';
  }

  const lines: string[] = ['### 🔗 참조 출처 (Verified Sources)'];

  // Sort by tier (S -> A -> B -> C)
  const tierOrder = { S: 0, A: 1, B: 2, C: 3 };
  const sorted = [...sources].sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

  for (const source of sorted) {
    const icon = source.icon ? `${source.icon} ` : '';
    const date = source.publishDate ? ` (${source.publishDate})` : '';
    lines.push(`- ${icon}[${source.title}](${source.url})${date}`);
  }

  return lines.join('\n');
}

/**
 * Calculate overall verification confidence
 * Applies 90% threshold rule from SearchMode
 */
export function calculateConfidence(
  claimConfidence: number,
  sourceQuality: number,
  hasAcademicSources: boolean
): number {
  // Base confidence from claim verification
  let confidence = claimConfidence * 0.5;

  // Add source quality factor
  confidence += sourceQuality * 0.3;

  // Bonus for academic sources
  if (hasAcademicSources) {
    confidence += 0.2;
  } else {
    confidence += 0.1;
  }

  // Apply ceiling
  return Math.min(confidence, 1.0);
}

/**
 * Check if confidence meets 90% threshold
 */
export function meetsConfidenceThreshold(confidence: number): boolean {
  return confidence >= 0.9;
}

/**
 * Generate verification timestamp
 */
export function getVerificationTimestamp(): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  return `${year}.${month}.${day}_${hours}:${minutes}:${seconds}`;
}

/**
 * Get system mode based on threshold date (2026-01-15)
 */
export function getSystemMode(): 'online' | 'offline' {
  const threshold = new Date('2026-01-15T00:00:00');
  const now = new Date();
  return now >= threshold ? 'online' : 'offline';
}

/**
 * Format verification header
 */
export function formatVerificationHeader(): string {
  const timestamp = getVerificationTimestamp();
  const mode = getSystemMode();

  if (mode === 'online') {
    return `[🟢 Online Mode | ${timestamp}]`;
  } else {
    return `[🚫 Offline Mode | ${timestamp}]`;
  }
}

/**
 * Anti-hallucination check: Validate source URLs
 */
export function validateSourceUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Must have valid protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    // Must have valid hostname
    if (!urlObj.hostname || urlObj.hostname.length < 3) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Filter out potentially fabricated sources
 */
export function filterValidSources(sources: VerifiedSource[]): VerifiedSource[] {
  return sources.filter((source) => {
    // Validate URL format
    if (!validateSourceUrl(source.url)) {
      console.warn(`Invalid source URL filtered: ${source.url}`);
      return false;
    }
    // Require title
    if (!source.title || source.title.length < 3) {
      console.warn(`Source without valid title filtered: ${source.url}`);
      return false;
    }
    return true;
  });
}
