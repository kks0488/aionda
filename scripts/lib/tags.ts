export type TagLocale = 'ko' | 'en';

const TAG_ALIASES: Record<string, string> = {
  // Korean → English canonical
  인공지능: 'ai',
  ai: 'ai',
  'ai툴': 'ai-tools',
  'ai 도구': 'ai-tools',
  '에이전트': 'agent',
  에이전트: 'agent',
  자동화: 'automation',
  보안: 'security',
  안전: 'safety',
  정책: 'policy',
  규제: 'policy',
  벤치마크: 'benchmark',
  benchmarks: 'benchmark',
  benchmarking: 'benchmark',
  평가: 'evals',
  '검색 증강': 'rag',
  '검색증강': 'rag',
  '파인 튜닝': 'fine-tuning',
  파인튜닝: 'fine-tuning',
  파인튜닝: 'fine-tuning',
  멀티모달: 'multimodal',
  로보틱스: 'robotics',
  하드웨어: 'hardware',

  // Common spacing / formatting variants
  'hugging face': 'huggingface',
  'huggingface': 'huggingface',
  'prompt injection': 'prompt-injection',
  'prompt-injection': 'prompt-injection',
  'prompting': 'prompting',
  'tool calling': 'tool-calling',
  'tool-calling': 'tool-calling',
  'vector db': 'vector-db',
  'vector database': 'vector-db',
  'vector-db': 'vector-db',
  'open source': 'open-source',
  'open-source': 'open-source',
  'ai-strategy': 'strategy',
  'business-analysis': 'analysis',
  'decision-memo': 'analysis',
  'machine learning': 'ml',
  'deep learning': 'dl',

  // Series aliases
  'k ai pulse': 'k-ai-pulse',
  'k-ai-pulse': 'k-ai-pulse',
  explainer: 'explainer',
  'deep dive': 'deep-dive',
  'deep-dive': 'deep-dive',

  // Product/model families (collapse versions to family)
  chatgpt: 'gpt',
  'gpt': 'gpt',
  openai: 'openai',
  claude: 'claude',
  anthropic: 'anthropic',
  gemini: 'gemini',
  deepseek: 'deepseek',
  kimi: 'kimi',
  qwen: 'qwen',
  llama: 'llama',
};

// Keep the tag vocabulary tight so navigation/SEO stays sane.
// (Everything else gets dropped.)
const ALLOWED_TAGS = new Set<string>([
  // Core pillars (used in UI category chips / discovery)
  'agi',
  'llm',
  'robotics',
  'hardware',
  'ai',

  // Editorial series
  'k-ai-pulse',
  'explainer',
  'deep-dive',

  // Content categories
  'news',
  'opinion',
  'analysis',
  'strategy',
  'tutorial',
  'research',

  // Major companies / ecosystems
  'openai',
  'anthropic',
  'google',
  'microsoft',
  'nvidia',
  'amd',
  'apple',
  'huggingface',

  // Model families (no versions)
  'gpt',
  'gemini',
  'claude',
  'deepseek',
  'kimi',
  'qwen',
  'llama',

  // Technical themes (high-signal)
  'agent',
  'automation',
  'mcp',
  'rag',
  'evals',
  'benchmark',
  'inference',
  'training',
  'fine-tuning',
  'multimodal',
  'prompting',
  'tool-calling',
  'ml',
  'dl',
  'security',
  'safety',
  'policy',
  'open-source',
  'vector-db',
  'governance',
  'observability',
  'on-device',
  'privacy',
]);

const MODEL_FAMILY_PATTERNS: Array<{ re: RegExp; to: string }> = [
  { re: /^gpt[-\s]?\d/i, to: 'gpt' },
  { re: /^gemini[-\s]?\d/i, to: 'gemini' },
  { re: /^claude[-\s]?\d/i, to: 'claude' },
  { re: /^llama[-\s]?\d/i, to: 'llama' },
  { re: /^qwen[-\s]?\d/i, to: 'qwen' },
  { re: /^kimi[-\s]?\d/i, to: 'kimi' },
];

function normalizeBase(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .replace(/[’'"]/g, '')
    .replace(/[^\p{L}\p{N}\- ]/gu, '')
    .trim();
}

export function canonicalizeTag(raw: string): string {
  const base = normalizeBase(raw);
  if (!base) return '';

  // Direct alias mapping first.
  const aliased = TAG_ALIASES[base] || base;

  // Collapse model versions to family tags.
  for (const rule of MODEL_FAMILY_PATTERNS) {
    if (rule.re.test(aliased)) return rule.to;
  }

  // Keep only allowed vocabulary.
  if (ALLOWED_TAGS.has(aliased)) return aliased;

  // Try mapping variants with spaces→hyphens as a last chance.
  const hyphenated = aliased.replace(/\s+/g, '-');
  const hyphenAlias = TAG_ALIASES[hyphenated] || hyphenated;
  for (const rule of MODEL_FAMILY_PATTERNS) {
    if (rule.re.test(hyphenAlias)) return rule.to;
  }
  return ALLOWED_TAGS.has(hyphenAlias) ? hyphenAlias : '';
}

function uniq(tags: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    const t = String(tag || '').trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function pickCoreTagOrFallback(tags: string[]): string {
  const core = ['agi', 'llm', 'robotics', 'hardware'];
  for (const t of core) if (tags.includes(t)) return t;
  return 'llm';
}

export function canonicalizeTags(input: string[], options?: { maxTags?: number }): string[] {
  const maxTags = options?.maxTags && options.maxTags > 0 ? options.maxTags : 8;

  const canonical = uniq(
    input
      .flatMap((t) => String(t || '').split(','))
      .map((t) => canonicalizeTag(t))
      .filter(Boolean)
  );

  // Ensure exactly one core tag exists at least.
  const core = pickCoreTagOrFallback(canonical);
  const withCore = canonical.includes(core) ? canonical : [core, ...canonical];

  // Light prioritization: core → series → company/model → themes → rest.
  const priority = (tag: string) => {
    if (['agi', 'llm', 'robotics', 'hardware', 'ai'].includes(tag)) return 0;
    if (['k-ai-pulse', 'explainer', 'deep-dive'].includes(tag)) return 1;
    if (['openai', 'anthropic', 'google', 'microsoft', 'nvidia', 'amd', 'apple', 'huggingface'].includes(tag)) return 2;
    if (['gpt', 'gemini', 'claude', 'deepseek', 'kimi', 'qwen', 'llama'].includes(tag)) return 3;
    if (['news', 'analysis', 'opinion', 'tutorial', 'research'].includes(tag)) return 4;
    return 5;
  };

  const sorted = [...withCore].sort((a, b) => {
    const pa = priority(a);
    const pb = priority(b);
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  return sorted.slice(0, maxTags);
}
