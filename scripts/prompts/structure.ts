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

<context>
- 입력은 커뮤니티 글, 기사 요약, 링크 모음 등 혼합형일 수 있습니다.
- 판단 기준은 "글의 목적/톤/형식"입니다.
</context>

<decision_rules>
- 발표/출시/사건/정책 공지 중심이면 news
- 데이터 비교/원인 분석/전망 중심이면 analysis
- 주장/평가/권고/비판 중심이면 opinion
- 혼합형이면 가장 지배적인 목적 1개만 선택
</decision_rules>

<output_rules>
- 키는 type, reason만 사용
- reason은 한국어 1문장
</output_rules>

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
- 입력에 없는 사실/수치/고유명사는 만들지 말 것
- 추정은 "가능성"으로 표시
</critical_rules>

<context>
- 입력은 링크/잡문이 섞인 원문일 수 있습니다.
- 사실 기반으로 요약하되, 과장/단정 금지.
</context>

<workflow>
1) 핵심 사건과 영향만 추출
2) 구조 순서대로 문단 작성
3) 금지어/길이/섹션 누락 자체 점검 (출력하지 않음)
</workflow>

<hooking_rules>
도입부는 반드시 다음 중 하나로 시작:
1. 충격적 사실/숫자: "X가 100만 달러를 날렸다."
2. 직접적 질문: "당신의 앱도 삭제될 수 있다."
3. 반전/역설: "AI 안전을 외치던 회사가 가장 위험한 AI를 만들었다."
4. 구체적 피해/이익: "개발자들은 이제 50% 더 빨리 코딩한다."

절대 하지 말 것:
- "~했다. ~이다. ~했다." 나열 (사실 나열은 후킹이 아님)
- "~에 대해 ~를 요구했다" (관료적 문체)
</hooking_rules>

<structure>
1. **도입부** (2-3문장): 후킹 문장 + "그래서 당신에게 무슨 의미인지" 연결
2. ## 무슨 일이 벌어졌나: 핵심 사건 요약 (3-4문장)
3. ## 왜 중요한가: 독자에게 미치는 영향 (2-3문장)
4. ## 배경: 이 사건의 맥락 (3-4문장)
5. ## 앞으로 어떻게 되나: 예상 시나리오 (2-3문장)
6. ## FAQ: 질문 3개
</structure>

<important>
출처는 생성하지 마세요. 시스템이 자동으로 추가합니다.
</important>

<example>
입력: "미국 상원의원들이 Grok의 유해한 AI 이미지 생성 문제로 앱 삭제 요구..."

출력:
당신이 쓰는 X 앱이 앱스토어에서 사라질 수 있다. 미 상원의원들이 애플과 구글에 X 삭제를 요구했다. Grok이 아동 성착취 이미지를 생성했기 때문이다.

## 무슨 일이 벌어졌나
Grok AI가 아동과 여성의 동의 없는 성적 이미지를 대량 생성했다. 일론 머스크는 이를 웃음 이모지로 반응했다. 연구원들은 Grok 아카이브에서 100개 이상의 아동 성학대 이미지를 발견했다. 상원의원들은 1월 23일까지 답변을 요구했다.

## 왜 중요한가
앱스토어 정책이 AI 생성 콘텐츠에도 적용되는지 첫 시험대다. 애플과 구글이 X를 삭제하면, 다른 AI 앱들도 같은 기준으로 심사받는다. 당신이 만든 AI 앱도 예외가 아니다.

## 배경
애플 약관은 "음란하고 불쾌한 콘텐츠"를 금지한다. X는 유료 사용자에게 Grok 이미지 생성을 여전히 허용 중이다. 머스크는 "표현의 자유 탄압"이라 반박했다.

## 앞으로 어떻게 되나
애플과 구글은 1월 23일까지 답변해야 한다. X가 Grok 필터링을 강화하거나, 앱이 삭제될 수 있다. 최악의 경우 X 플랫폼 전체가 앱스토어에서 퇴출된다.

## FAQ
**Q: 내 X 앱이 진짜 삭제되나?**
A: 아직 확정 아니다. 1월 23일 답변 이후 결정된다.

**Q: 머스크는 뭐라고 했나?**
A: "표현의 자유를 싫어해서 그렇다"고 비판했다.

**Q: 다른 AI 앱도 영향받나?**
A: 그렇다. 같은 기준이 적용되면 Midjourney, DALL-E 앱도 심사 대상이다.
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
- 입력에 없는 사실/수치/고유명사는 만들지 말 것
- 불확실한 내용은 "가능성"으로 표시
</critical_rules>

<context>
- 입력은 단문/링크 요약일 수 있습니다.
- 데이터가 없으면 일반론을 길게 늘리지 말고 간결하게 처리.
</context>

<workflow>
1) 수치/비교 근거를 우선 추출
2) 구조 섹션별로 핵심만 작성
3) 표/길이/금지어 체크 (출력하지 않음)
</workflow>

<structure>
1. **도입부** (첫 문단): 핵심 인사이트 + 왜 중요한지. 3초 안에 설득.
2. ## 현황: 2문단, 현재 상황 + 데이터
3. ## 분석: 2문단, 원인과 의미
4. ## 흔히 하는 실수: 잘못된 접근 1개
5. ## FAQ: 질문 3개 (Q&A 형식)
6. ## 전략: 구체적 행동 제안
</structure>

<important>
출처는 생성하지 마세요. 시스템이 자동으로 추가합니다.
</important>

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
- 입력에 없는 사실/수치/고유명사는 만들지 말 것
- 추정은 "가능성"으로 표시
</critical_rules>

<context>
- 의견 글이지만 근거 없는 단정은 금지.
- 주장의 근거가 입력에 없으면 일반론 대신 생략.
</context>

<workflow>
1) 주장 1개를 명확히 설정
2) 입력에 있는 근거만 사용
3) 반론 1개 제시 후 균형 유지
4) 금지어/근거 누락 체크 (출력하지 않음)
</workflow>

<structure>
1. **도입부** (첫 문단): 강한 주장 + 후킹. 왜 이 의견이 중요한지.
2. ## 근거: 2문단, 주장 뒷받침 증거
3. ## 반론: 다른 관점 1개 인정
4. ## FAQ: 질문 3개 (Q&A 형식)
5. ## 결론: 요약 + 행동 촉구
</structure>

<important>
출처는 생성하지 마세요. 시스템이 자동으로 추가합니다.
</important>

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

export const HEADLINE_PROMPT = `<task>헤드라인 및 메타 설명 생성</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<context>
- 입력은 본문 일부일 수 있으므로 핵심만 재구성하세요.
- 제목에 숫자/고유명사가 있으면 우선 유지하세요.
</context>

<workflow>
1) 핵심 사건/의미 1개만 선택
2) 길이 제한 내에서 과감히 축약
3) JSON 형식/길이/중복 체크 (출력하지 않음)
</workflow>

<critical_rules>
헤드라인:
- 한글 제목: 반드시 25자 이내 (공백 포함)
- 영어 제목: 8-10 단어 이내
- 핵심만 담아라. 부연 설명 금지.
- 영어 제목은 Title Case

메타 설명 (description):
- 본문 도입부와 다른 내용으로 작성
- 독자가 "왜 읽어야 하는지" 설명
- 한글 80자, 영어 120자 이내
- 호기심 유발 + 핵심 가치 전달
</critical_rules>

<output_rules>
- JSON 키 순서: headline_en, headline_ko, description_en, description_ko
- 줄바꿈 없이 1줄 JSON
</output_rules>

<examples>
입력: "당신의 X 앱이 스마트폰에서 강제 삭제될 위기다. 미 상원의원들이..."
출력: {
  "headline_en": "Senators Demand X Removal Over Grok AI",
  "headline_ko": "미 상원, X 앱스토어 퇴출 요구",
  "description_en": "Your X app could vanish from your phone. Here's why senators are targeting Grok AI and what it means for all AI apps.",
  "description_ko": "앱스토어 AI 규제의 첫 시험대. 1월 23일 결정이 모든 AI 앱의 운명을 바꾼다."
}

입력: "OpenAI가 GPT-5를 발표했다. 기존 대비 2배 빠르고..."
출력: {
  "headline_en": "OpenAI Unveils GPT-5 With 2x Speed",
  "headline_ko": "OpenAI, GPT-5 공개",
  "description_en": "The AI race enters a new phase. GPT-5 brings million-token context that could make RAG obsolete.",
  "description_ko": "100만 토큰 컨텍스트가 RAG를 대체할 수 있다. 개발자가 알아야 할 핵심 변화."
}
</examples>

<content>
{content}
</content>

<output_format>
{
  "headline_en": "영어 헤드라인",
  "headline_ko": "한글 헤드라인",
  "description_en": "영어 메타 설명 (120자 이내)",
  "description_ko": "한글 메타 설명 (80자 이내)"
}
</output_format>`;

export const TRANSLATE_STRUCTURED_PROMPT = `<task>한→영 기술 글 번역</task>

<critical_rules>
- 마크다운 구조 유지 (##, -, |표|, 링크)
- 기술 용어는 표준 영어 (언어모델 → Language Model)
- 제품명/회사명 그대로 (GPT-4, Claude, OpenAI)
- 비격식체 → 전문적 영어
- 번역된 마크다운 본문만 출력 (설명 없이)
- 코드 블록/인라인 코드/URL/파일명은 절대 번역하지 말 것
- 숫자/단위/버전 표기는 그대로 유지
</critical_rules>

<context>
- 입력은 구조화된 한국어 글입니다.
- 의미를 유지하되 과장 없이 명확한 영어로 옮기세요.
</context>

<workflow>
1) 문단/헤더/표 형식을 그대로 유지
2) 고유명사/코드/URL 보존
3) 누락/추가 문장 없는지 자체 점검 (출력하지 않음)
</workflow>

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
