// Article type prompts - Simplified version with gallery language removal

export type ArticleType = 'news' | 'analysis' | 'opinion';

export const ARTICLE_TYPE_DESCRIPTIONS = {
  news: '속보, 발표, 출시 소식 - 새로운 제품/서비스 발표, 회사 뉴스',
  analysis: '트렌드, 비교, 심층 분석 - 데이터 기반 분석, 업계 동향',
  opinion: '관점, 제안, 비평 - 의견 제시, 미래 예측, 비판적 시각',
};

// 공통 규칙: 갤러리 말투 제거
const LANGUAGE_CLEANUP_RULES = `
## 필수: 갤러리 말투 → 전문적 문체 변환
커뮤니티 비속어를 전문적 문체로 변환하세요:
- "하셈", "해셈" → "하세요", "합니다"
- "거임", "임" → "것입니다", "입니다"
- "하잖음", "잖음" → "하지 않습니까", "합니다"
- "ㅇㅇ", "ㄴㄴ", "ㄱㄱ" → 완전한 문장으로
- "~함", "~됨" → "~합니다", "~됩니다"
- 반말/비격식체 → 존댓말 또는 문어체 ("했다" → "했습니다" 또는 "한다")
- 이모티콘, "ㅋㅋ", "ㅎㅎ" → 제거
- 욕설, 비하 표현 → 제거 또는 중립적 표현으로`;

export const CLASSIFY_PROMPT = `다음 글의 유형을 분류해주세요.

## 글 유형:
- news: 속보, 발표, 출시 소식 (새로운 제품/서비스, 회사 뉴스)
- analysis: 트렌드, 비교, 심층 분석 (데이터 기반, 업계 동향)
- opinion: 관점, 제안, 비평 (의견, 미래 예측, 비판)

## 글 내용:
{content}

## 응답 (JSON):
{"type": "news|analysis|opinion", "reason": "분류 이유 (1문장)"}

JSON만 응답하세요.`;

export const NEWS_STRUCTURE_PROMPT = `당신은 MIT Technology Review 스타일의 기술 기자입니다.
다음 원문을 전문적인 뉴스 기사로 재구성해주세요.

${LANGUAGE_CLEANUP_RULES}

## 원문:
{content}

## 구조:
1. **도입부** (2-3문장): 핵심 사건 + 왜 중요한지
2. ## 무슨 일이 벌어졌나: 핵심 사건 요약 (3-4문장)
3. ## 왜 중요한가: 독자에게 미치는 영향 (2-3문장)
4. ## 배경: 맥락과 히스토리 (3-4문장)
5. ## 앞으로 어떻게 되나: 예상 시나리오 (2-3문장)
6. ## FAQ: 질문 3개 (Q&A 형식)

## 스타일:
- 문장: 15단어 이내, 능동태
- 문단: 2-4문장
- 금지: "매우", "정말", "혁명적", "다양한", "효율적으로"
- 입력에 없는 사실/수치 만들지 말 것

출처는 생성하지 마세요. 시스템이 자동으로 추가합니다.
마크다운 본문만 응답하세요. 프론트매터 없이.`;

export const ANALYSIS_STRUCTURE_PROMPT = `당신은 TechCrunch 스타일의 기술 분석가입니다.
다음 원문을 전문적인 분석 기사로 재구성해주세요.

${LANGUAGE_CLEANUP_RULES}

## 원문:
{content}

## 구조:
1. **도입부** (첫 문단): 핵심 인사이트 + 왜 중요한지
2. ## 현황: 현재 상황과 데이터 (2문단)
3. ## 분석: 원인과 의미 (2문단)
4. ## 흔히 하는 실수: 잘못된 접근 1개
5. ## FAQ: 질문 3개 (Q&A 형식)
6. ## 전략: 구체적 행동 제안

## 스타일:
- 데이터 비교 시 | 표 | 형식 | 사용
- 문장: 15단어 이내
- 금지: "매우", "다양한", "효과적인", "탁월한"
- 입력에 없는 사실/수치 만들지 말 것

출처는 생성하지 마세요. 시스템이 자동으로 추가합니다.
마크다운 본문만 응답하세요. 프론트매터 없이.`;

export const OPINION_STRUCTURE_PROMPT = `당신은 Simon Willison 스타일의 기술 블로거입니다.
다음 원문을 전문적인 오피니언 글로 재구성해주세요.

${LANGUAGE_CLEANUP_RULES}

## 원문:
{content}

## 구조:
1. **도입부** (첫 문단): 강한 주장 + 후킹
2. ## 근거: 주장 뒷받침 증거 (2문단)
3. ## 반론: 다른 관점 1개 인정
4. ## FAQ: 질문 3개 (Q&A 형식)
5. ## 결론: 요약 + 행동 촉구

## 스타일:
- 직접적 진술: "~라고 생각한다" 대신 "~이다"
- 모든 주장에 근거 필수
- 문장: 15단어 이내
- 입력에 없는 사실/수치 만들지 말 것

출처는 생성하지 마세요. 시스템이 자동으로 추가합니다.
마크다운 본문만 응답하세요. 프론트매터 없이.`;

export const STRUCTURE_PROMPTS: Record<ArticleType, string> = {
  news: NEWS_STRUCTURE_PROMPT,
  analysis: ANALYSIS_STRUCTURE_PROMPT,
  opinion: OPINION_STRUCTURE_PROMPT,
};

export const HEADLINE_PROMPT = `다음 본문에 맞는 헤드라인과 메타 설명을 작성해주세요.

## 본문:
{content}

## 규칙:
- 한글 제목: 25자 이내
- 영어 제목: 8-10 단어, Title Case
- 메타 설명: 한글 80자, 영어 120자 이내
- 핵심만 담아라. 부연 설명 금지.
- 클릭베이트 금지

## 응답 (JSON):
{
  "headline_en": "영어 헤드라인",
  "headline_ko": "한글 헤드라인",
  "description_en": "영어 메타 설명",
  "description_ko": "한글 메타 설명"
}

JSON만 응답하세요.`;

export const TRANSLATE_STRUCTURED_PROMPT = `다음 한국어 기술 글을 영어로 번역해주세요.

## 번역 규칙:
1. 마크다운 구조(##, -, |표|) 유지
2. 기술 용어는 표준 영어 사용
3. 제품명/회사명 유지 (GPT-5, Gemini 3, Claude 4 등)
4. 링크 [텍스트](URL) 유지
5. 코드 블록/URL/파일명 번역 금지

## 원문:
{content}

번역된 마크다운 본문만 응답하세요.`;
