import { describe, expect, it } from 'vitest';
import { assessPostIndexability } from './indexing-policy';

const references = `
## 참고 자료
- [Official documentation](https://openai.com/research/example)
- [Independent paper](https://arxiv.org/abs/1234.5678)
`;

describe('assessPostIndexability', () => {
  it('keeps a reviewed, evidenced, non-templated article indexable', () => {
    const result = assessPostIndexability({
      lastReviewedAt: '2026-07-23',
      verificationScore: 0.9,
      content: `${'근거와 분석을 구분한 본문이다. '.repeat(100)}${references}`,
    });
    expect(result).toEqual({ indexable: true, reasons: [] });
  });

  it('noindexes low-confidence legacy template content without removing it', () => {
    const result = assessPostIndexability({
      verificationScore: 0.67,
      content: `${'일반적인 설명이다. '.repeat(100)}\n## 세 줄 요약\n## 현황\n## 분석\n## 실전 적용\n## FAQ`,
    });
    expect(result.indexable).toBe(false);
    expect(result.reasons).toContain('verification-score-below-0.80');
    expect(result.reasons).toContain('legacy-fixed-template-footprint');
  });
});
