export type EditorialSeries =
  | 'k-ai-pulse'
  | 'explainer'
  | 'deep-dive'
  | 'comparison'
  | 'practical-guide'
  | 'perspective';

type SignalGroup = 'pulse' | 'explainer' | 'deepDive' | 'comparison' | 'practicalGuide' | 'perspective';

type Signal = { id: string; re: RegExp };

const SIGNALS: Record<SignalGroup, Signal[]> = {
  pulse: [
    { id: 'announce_ko', re: /발표|출시|업데이트|공개|런칭|릴리즈|패치|버전|프리뷰|베타|정식\s*출시/i },
    { id: 'announce_en', re: /\b(announce|release|launch|update|preview|beta|ga|availability|rollout)\b/i },
    { id: 'policy_ko', re: /규제|법|표준|제재|금지|약관|서비스\s*약관|tos/i },
    { id: 'policy_en', re: /\b(regulat|ban|law|standard|compliance|terms of service|tos|policy)\b/i },
    { id: 'eol', re: /지원\s*종료|서비스\s*종료|eol|end of support|sunset/i },
    { id: 'product_ko', re: /가격|요금|플랜|무료|유료|구독/i },
    { id: 'product_en', re: /\b(pricing|subscription|plan|free tier|paid)\b/i },
  ],
  explainer: [
    { id: 'explainer_ko', re: /개념|정리|설명|원리|가이드|입문|튜토리얼|용어/i },
    { id: 'explainer_en', re: /\b(how to|what is|explained|primer|guide|why)\b/i },
    { id: 'reading_ko', re: /읽는\s*법|해석|체크리스트|기본기/i },
  ],
  deepDive: [
    { id: 'systems_ko', re: /아키텍처|설계|구현|컴파일|최적화|성능|벤치마크|커널|스케줄링|메모리|스레드/i },
    { id: 'systems_en', re: /\b(architecture|design|implementation|compiler|optimization|performance|benchmark|kernel|memory|thread)\b/i },
    { id: 'research_ko', re: /논문|실험|재현|재현성|평가|측정|데이터셋/i },
    { id: 'research_en', re: /\b(paper|arxiv|experiment|reproduc|evaluation|measure|dataset)\b/i },
    { id: 'analysis_ko', re: /분석|해부|리스크|시나리오|한계|의사\s*결정/i },
    { id: 'analysis_en', re: /\b(analysis|deep dive|risk|scenario|limitation|decision)\b/i },
    { id: 'security_ko', re: /보안|취약점|공격|방어|위협\s*모델|완화/i },
    { id: 'security_en', re: /\b(security|vulnerab|exploit|attack|defense|threat model|mitigation)\b/i },
    { id: 'hardware_ko', re: /gpu|tpu|npu|cuda|hbm|칩|반도체|가속기/i },
    { id: 'hardware_en', re: /\b(gpu|tpu|npu|cuda|hbm|accelerator|chip|silicon)\b/i },
    { id: 'tradeoff', re: /\b(trade-?off|if\/then|decision memo)\b|트레이드오프|조건부|if\/then/i },
  ],
  comparison: [
    { id: 'compare_ko', re: /비교|대결|맞대결|벤치마크\s*비교/i },
    { id: 'compare_vs', re: /\b(vs|versus)\b/i },
    { id: 'compare_en', re: /\b(compare|head to head|benchmark comparison|which is better)\b/i },
  ],
  practicalGuide: [
    { id: 'practical_ko', re: /실무|적용|현업|도입|마이그레이션|세팅/i },
    { id: 'practical_en', re: /\b(production|real-world|deploy|migration|setup|integrate)\b/i },
  ],
  perspective: [
    { id: 'perspective_ko', re: /관점|의견|반론|주장|과대평가|과소평가/i },
    { id: 'perspective_en', re: /\b(opinion|take|unpopular|overrated|underrated|myth|misconception)\b/i },
  ],
};

function scoreSignals(text: string, group: SignalGroup): { score: number; matched: string[] } {
  const matched: string[] = [];
  for (const signal of SIGNALS[group]) {
    if (signal.re.test(text)) matched.push(signal.id);
  }
  return { score: matched.length, matched };
}

export function scoreEditorialSeriesSignals(input: {
  title?: string;
  description?: string;
  keyInsights?: string[];
}): {
  pulseScore: number;
  explainerScore: number;
  deepDiveScore: number;
  comparisonScore: number;
  practicalGuideScore: number;
  perspectiveScore: number;
  matched: {
    pulse: string[];
    explainer: string[];
    deepDive: string[];
    comparison: string[];
    practicalGuide: string[];
    perspective: string[];
  };
} {
  const combined = [input.title, input.description, ...(input.keyInsights || [])]
    .filter(Boolean)
    .join('\n');

  const pulse = scoreSignals(combined, 'pulse');
  const explainer = scoreSignals(combined, 'explainer');
  const deepDive = scoreSignals(combined, 'deepDive');
  const comparison = scoreSignals(combined, 'comparison');
  const practicalGuide = scoreSignals(combined, 'practicalGuide');
  const perspective = scoreSignals(combined, 'perspective');

  return {
    pulseScore: pulse.score,
    explainerScore: explainer.score,
    deepDiveScore: deepDive.score,
    comparisonScore: comparison.score,
    practicalGuideScore: practicalGuide.score,
    perspectiveScore: perspective.score,
    matched: {
      pulse: pulse.matched,
      explainer: explainer.matched,
      deepDive: deepDive.matched,
      comparison: comparison.matched,
      practicalGuide: practicalGuide.matched,
      perspective: perspective.matched,
    },
  };
}

export function selectEditorialSeries(input: {
  title?: string;
  description?: string;
  keyInsights?: string[];
}): EditorialSeries {
  const scores = scoreEditorialSeriesSignals(input);

  // 0) Strong explicit type signals first. Weak signals must fall back to legacy logic.
  if (scores.comparisonScore >= 2) return 'comparison';
  if (scores.practicalGuideScore >= 2) return 'practical-guide';
  if (scores.perspectiveScore >= 2) return 'perspective';

  // 1) Explainer has highest priority: it's intentional and SEO-driven.
  if (scores.explainerScore > 0) return 'explainer';

  // 2) Clear announcement/policy/news → Pulse (even if mildly technical).
  if (scores.pulseScore >= 2 && scores.deepDiveScore <= 1) return 'k-ai-pulse';

  // 3) Research/engineering-heavy topic without strong “news” signals → Deep Dive.
  if (scores.deepDiveScore >= 3 && scores.pulseScore <= 1) return 'deep-dive';
  if (scores.deepDiveScore >= 2 && scores.pulseScore === 0) return 'deep-dive';

  // 4) Mixed signals → choose by relative strength.
  if (scores.pulseScore >= 2 && scores.deepDiveScore >= 2) {
    return scores.deepDiveScore >= scores.pulseScore + 1 ? 'deep-dive' : 'k-ai-pulse';
  }

  // 5) Tie (common: “model 공개/출시” + technical keyword) → prefer Pulse unless explicitly framed as analysis.
  const title = String(input.title || '');
  if (scores.pulseScore === 1 && scores.deepDiveScore === 1) {
    const analysisCue = SIGNALS.deepDive.some((s) => (s.id === 'analysis_ko' || s.id === 'analysis_en') && s.re.test(title));
    return analysisCue ? 'deep-dive' : 'k-ai-pulse';
  }

  // 6) Fallback → relative strength (bias toward Deep Dive for long-term value).
  if (scores.deepDiveScore > scores.pulseScore) return 'deep-dive';
  if (scores.pulseScore > scores.deepDiveScore) return 'k-ai-pulse';
  return 'deep-dive';
}

export function formatSeriesForPrompt(series: EditorialSeries): string {
  if (series === 'k-ai-pulse') return 'K‑AI Pulse (Signal Brief)';
  if (series === 'explainer') return 'Explainer (Pillar/Evergreen)';
  if (series === 'comparison') return 'Comparison (Head-to-Head)';
  if (series === 'practical-guide') return 'Practical Guide (Hands-on)';
  if (series === 'perspective') return 'Perspective (Opinionated but Evidence-based)';
  return 'Deep Dive (Decision Memo)';
}
