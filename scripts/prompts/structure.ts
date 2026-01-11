// Article type prompts based on WRITING_TEMPLATE.md

export type ArticleType = 'news' | 'analysis' | 'opinion';

export const ARTICLE_TYPE_DESCRIPTIONS = {
  news: '속보, 발표, 출시 소식 - 새로운 제품/서비스 발표, 회사 뉴스',
  analysis: '트렌드, 비교, 심층 분석 - 데이터 기반 분석, 업계 동향',
  opinion: '관점, 제안, 비평 - 의견 제시, 미래 예측, 비판적 시각',
};

// Gemini 3 최적화: 중요 지침 상단, Few-shot 예시 포함, 직접적 표현
export const CLASSIFY_PROMPT = `<task>글 유형 분류</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<categories>
- news: 속보, 발표, 출시 소식 (새로운 제품/서비스, 회사 뉴스)
- analysis: 트렌드, 비교, 심층 분석 (데이터 기반, 업계 동향)
- opinion: 관점, 제안, 비평 (의견, 미래 예측, 비판)
</categories>

<examples>
입력: "OpenAI가 GPT-5를 발표했다. CEO 샘 알트만은 이번 모델이..."
출력: {"type": "news", "reason": "회사의 신제품 발표 소식"}

입력: "최근 LLM 벤치마크를 분석한 결과, Claude가 코딩에서 15% 앞서..."
출력: {"type": "analysis", "reason": "벤치마크 데이터 기반 비교 분석"}

입력: "나는 AI 규제가 혁신을 막는다고 생각한다..."
출력: {"type": "opinion", "reason": "개인 관점 기반 비평"}
</examples>

<content>
{content}
</content>

<output_format>
{"type": "news|analysis|opinion", "reason": "분류 이유 (1문장)"}
</output_format>`;

export const NEWS_STRUCTURE_PROMPT = `<role>MIT Technology Review 스타일의 기술 기자</role>

<critical_rules>
- 마크다운 본문만 출력 (프론트매터 금지)
- 문장 15단어 이내, 능동태
- 금지 표현: "매우", "정말", "혁명적", "쉽게", "간단하게", "다양한", "효율적으로"
- 잘 읽히고 후킹되어야 함 (길다고 좋은 게 아님)
</critical_rules>

<structure>
1. **도입부** (첫 문단): 후킹 + 핵심 정보. 독자가 왜 읽어야 하는지 3초 안에 설득.
2. ## 왜 중요한가: 2문단, 이 뉴스의 의미
3. ## 배경: 2문단, 맥락
4. ## 흔히 하는 실수: 관련 오해 1개
5. ## FAQ: 질문 3개 (Q&A 형식)
6. ## 다음 단계: 구체적 행동 제안
7. --- 출처: 참고 링크 목록
</structure>

<example>
입력: "OpenAI가 새로운 모델을 발표했다..."
출력:
OpenAI가 GPT-5를 공개했다. 기존 GPT-4 대비 추론 속도 2배, 컨텍스트 100만 토큰을 지원한다.

## 왜 중요한가
GPT-5는 에이전트 시대를 연다. 100만 토큰은 책 10권을 한 번에 처리한다는 의미다.
개발자들은 이제 복잡한 RAG 없이도 긴 문서를 다룰 수 있다.

## 배경
...
</example>

<content>
{content}
</content>

마크다운 본문만 응답하세요.`;

export const ANALYSIS_STRUCTURE_PROMPT = `<role>TechCrunch 스타일의 기술 분석가</role>

<critical_rules>
- 마크다운 본문만 출력 (프론트매터 금지)
- 문장 15단어 이내
- 데이터 비교 시 | 표 | 형식 | 사용
- 금지 표현: "매우", "다양한", "효과적인", "탁월한", "쉽게" → 구체적 수치로 대체
- 핵심이 명확해야 함 (장황함 금지)
</critical_rules>

<structure>
1. **도입부** (첫 문단): 핵심 인사이트 + 왜 중요한지. 3초 안에 설득.
2. ## 현황: 2문단, 현재 상황 + 데이터
3. ## 분석: 2문단, 원인과 의미
4. ## 흔히 하는 실수: 잘못된 접근 1개
5. ## FAQ: 질문 3개 (Q&A 형식)
6. ## 전략: 구체적 행동 제안
7. --- 출처: 참고 링크
</structure>

<example>
입력: "최근 벤치마크에서 Claude가 GPT를 앞섰다..."
출력:
Claude 3.5 Sonnet이 코딩 벤치마크에서 GPT-4o를 15% 앞섰다. HumanEval 92.3% vs 80.1%.

## 현황
| 모델 | HumanEval | MBPP |
|------|-----------|------|
| Claude 3.5 | 92.3% | 88.7% |
| GPT-4o | 80.1% | 82.4% |

Anthropic이 코딩 특화 전략을 택한 결과다.

## 분석
...
</example>

<content>
{content}
</content>

마크다운 본문만 응답하세요.`;

export const OPINION_STRUCTURE_PROMPT = `<role>Simon Willison 스타일의 기술 블로거</role>

<critical_rules>
- 마크다운 본문만 출력 (프론트매터 금지)
- 문장 15단어 이내
- 직접 진술: "~라고 생각한다" 대신 "~이다"
- 모든 주장에 데이터/링크 필수
- 금지 표현: "쉽게", "간단히", "다양한", "일반적으로"
- 확신 있되 독선적이지 않게
</critical_rules>

<structure>
1. **도입부** (첫 문단): 강한 주장 + 후킹. 왜 이 의견이 중요한지.
2. ## 근거: 2문단, 주장 뒷받침 증거
3. ## 반론: 다른 관점 1개 인정
4. ## FAQ: 질문 3개 (Q&A 형식)
5. ## 결론: 요약 + 행동 촉구
6. --- 출처: 참고 링크
</structure>

<example>
입력: "AI 규제가 혁신을 막는다..."
출력:
AI 규제는 혁신을 막지 않는다. 오히려 신뢰를 구축한다. EU AI Act 시행 후 유럽 AI 스타트업 투자가 23% 증가했다.

## 근거
규제가 있으면 기업들이 책임감 있게 개발한다. 의료 AI 분야에서 FDA 승인 제품의 시장 점유율이 78%다.
투자자들도 규제 준수 기업을 선호한다. 규제 리스크가 낮기 때문이다.

## 반론
...
</example>

<content>
{content}
</content>

마크다운 본문만 응답하세요.`;

export const STRUCTURE_PROMPTS: Record<ArticleType, string> = {
  news: NEWS_STRUCTURE_PROMPT,
  analysis: ANALYSIS_STRUCTURE_PROMPT,
  opinion: OPINION_STRUCTURE_PROMPT,
};

export const HEADLINE_PROMPT = `<task>헤드라인 생성</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<rules>
- 8-12단어
- 능동태, 현재 시제
- 핵심 키워드 포함
- 클릭베이트 금지
- 후킹되어야 함
</rules>

<examples>
입력: "OpenAI가 GPT-5를 발표했다. 기존 대비 2배 빠르고..."
출력: {"headline_en": "OpenAI Launches GPT-5 With 2x Speed and Million Token Context", "headline_ko": "OpenAI, 속도 2배 빠른 GPT-5 공개"}

입력: "Anthropic Claude가 코딩 벤치마크에서 1위를 차지..."
출력: {"headline_en": "Claude Takes Top Spot in Coding Benchmarks, Beats GPT-4", "headline_ko": "Claude, 코딩 벤치마크 1위 달성"}
</examples>

<content>
{content}
</content>

<output_format>
{"headline_en": "영어 헤드라인", "headline_ko": "한글 헤드라인"}
</output_format>`;

export const TRANSLATE_STRUCTURED_PROMPT = `<task>한→영 기술 글 번역</task>

<critical_rules>
- 마크다운 구조 유지 (##, -, |표|, 링크)
- 기술 용어는 표준 영어 (언어모델 → Language Model)
- 제품명/회사명 그대로 (GPT-4, Claude, OpenAI)
- 비격식체 → 전문적 영어
- 번역된 마크다운 본문만 출력 (설명 없이)
</critical_rules>

<example>
입력:
## 왜 중요한가
GPT-5는 에이전트 시대를 연다. 100만 토큰은 책 10권을 한 번에 처리한다는 의미다.

출력:
## Why It Matters
GPT-5 ushers in the age of AI agents. One million tokens means processing ten books at once.
</example>

<content>
{content}
</content>

번역된 마크다운 본문만 응답하세요.`;
