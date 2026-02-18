export const CORE_TAGS = ['agi', 'llm', 'robotics', 'hardware'] as const;

const CORE_TAG_PATTERNS: Array<{ tag: (typeof CORE_TAGS)[number]; regex: RegExp }> = [
  { tag: 'agi', regex: /agi|artificial general intelligence|superintelligence|초지능|범용.*인공지능/i },
  { tag: 'robotics', regex: /robot|로봇|humanoid|휴머노이드|boston dynamics|figure|drone|드론|자율주행/i },
  { tag: 'hardware', regex: /hardware|하드웨어|gpu|tpu|nvidia|chip|반도체|칩|blackwell|h100|b200|rubin|cuda|hbm/i },
  { tag: 'llm', regex: /llm|language model|언어.*모델|대형언어|transformer|트랜스포머|gpt|chatgpt|claude|gemini|llama/i },
];

export function deriveCoreTagsFromContent(
  title: string,
  content: string,
  tags: string[] = []
): Array<(typeof CORE_TAGS)[number]> {
  const combined = `${String(title || '')}\n${Array.isArray(tags) ? tags.join(' ') : ''}\n${String(content || '')}`.toLowerCase();
  const derived = CORE_TAG_PATTERNS.filter(({ regex }) => regex.test(combined)).map(({ tag }) => tag);
  return derived.length > 0 ? derived : ['llm'];
}
