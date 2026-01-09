// Article type prompts based on WRITING_TEMPLATE.md

export type ArticleType = 'news' | 'analysis' | 'opinion';

export const ARTICLE_TYPE_DESCRIPTIONS = {
  news: '속보, 발표, 출시 소식 - 새로운 제품/서비스 발표, 회사 뉴스',
  analysis: '트렌드, 비교, 심층 분석 - 데이터 기반 분석, 업계 동향',
  opinion: '관점, 제안, 비평 - 의견 제시, 미래 예측, 비판적 시각',
};

export const CLASSIFY_PROMPT = `다음 글의 유형을 분류해주세요.

## 글 유형:
- news: 속보, 발표, 출시 소식 (새로운 제품/서비스, 회사 뉴스)
- analysis: 트렌드, 비교, 심층 분석 (데이터 기반, 업계 동향)
- opinion: 관점, 제안, 비평 (의견, 미래 예측, 비판)

## 글 내용:
{content}

## 응답 (JSON):
{
  "type": "news|analysis|opinion",
  "reason": "분류 이유 (1문장)"
}

JSON만 응답하세요.`;

export const NEWS_STRUCTURE_PROMPT = `당신은 MIT Technology Review 스타일의 기술 기자입니다.
다음 원문을 전문적인 뉴스 기사로 재구성해주세요.

## 원문:
{content}

## 구조 규칙 (뉴스형):
1. **리드** (첫 2-3문장): 무엇이, 언제, 누가 - 핵심 정보 먼저
2. **왜 중요한가** (## 섹션): 2-3문단, 이 뉴스의 의미
3. **배경** (## 섹션): 2-3문단, 맥락과 히스토리
4. **전망** (## 섹션): 1-2문단, 업계 반응이나 향후 예상
5. **출처** (---로 구분): 참고 링크 목록

## 스타일 규칙:
- 문장: 15단어 이내, 능동태
- 문단: 2-4문장, 한 문단 = 한 아이디어
- 데이터: 구체적 숫자 + 출처 (예: "1483 ELO로 1위")
- 금지: "매우", "정말", "혁명적", "게임체인저"
- 링크: [텍스트](URL) 형식으로 인라인

## 응답:
마크다운 형식의 본문만 응답하세요. 프론트매터 없이 본문만.`;

export const ANALYSIS_STRUCTURE_PROMPT = `당신은 TechCrunch 스타일의 기술 분석가입니다.
다음 원문을 전문적인 분석 기사로 재구성해주세요.

## 원문:
{content}

## 구조 규칙 (분석형):
1. **핵심 주장** (첫 문단): 이 글이 말하고자 하는 것
2. **현황** (## 섹션): 2-3문단, 현재 상황과 데이터
3. **분석** (## 섹션): 3-4문단, 왜 이런 일이 일어나는지
4. **의미** (## 섹션): 2문단, 독자에게 어떤 영향이 있는지
5. **출처** (---로 구분): 참고 링크 목록

## 스타일 규칙:
- 데이터 테이블: 비교 데이터가 있으면 | 표 | 형식 | 사용
- 문장: 15단어 이내
- 문단: 2-4문장
- 개인 의견은 "~라고 본다", "~일 수 있다"로 명확히 구분
- 금지: 모호한 표현, 과장

## 응답:
마크다운 형식의 본문만 응답하세요. 프론트매터 없이 본문만.`;

export const OPINION_STRUCTURE_PROMPT = `당신은 Simon Willison 스타일의 기술 블로거입니다.
다음 원문을 전문적인 오피니언 글로 재구성해주세요.

## 원문:
{content}

## 구조 규칙 (오피니언형):
1. **훅** (첫 1-2문장): 독자의 관심을 끄는 시작
2. **주장** (첫 문단 나머지): 핵심 논점
3. **근거** (## 섹션들): 3-4문단, 주장을 뒷받침하는 증거
4. **반론** (## 섹션): 1문단, 다른 관점 인정
5. **결론** (## 섹션): 1문단, 행동 제안 또는 요약
6. **출처** (---로 구분): 참고 링크 목록

## 스타일 규칙:
- 직접적 진술: "~라고 생각한다" 대신 "~이다"
- 근거 필수: 모든 주장에 데이터/링크
- 문장: 15단어 이내
- 문단: 2-4문장
- 확신 있지만 독선적이지 않게

## 응답:
마크다운 형식의 본문만 응답하세요. 프론트매터 없이 본문만.`;

export const STRUCTURE_PROMPTS: Record<ArticleType, string> = {
  news: NEWS_STRUCTURE_PROMPT,
  analysis: ANALYSIS_STRUCTURE_PROMPT,
  opinion: OPINION_STRUCTURE_PROMPT,
};

export const HEADLINE_PROMPT = `다음 본문에 맞는 헤드라인을 작성해주세요.

## 본문:
{content}

## 헤드라인 규칙:
- 8-12단어
- 능동태, 현재 시제
- 핵심 키워드 포함
- 클릭베이트 금지

## 예시:
Good: "OpenAI Releases GPT-5 With Native Tool Integration"
Bad: "You Won't Believe What OpenAI Just Did!"

## 응답 (JSON):
{
  "headline_en": "영어 헤드라인",
  "headline_ko": "한글 헤드라인"
}

JSON만 응답하세요.`;

export const TRANSLATE_STRUCTURED_PROMPT = `다음 한국어 기술 글을 영어로 번역해주세요.

## 번역 규칙:
1. 마크다운 구조(##, -, |표|) 유지
2. 기술 용어는 표준 영어 사용
3. 제품명/회사명 유지 (GPT-4, Claude 등)
4. 링크 [텍스트](URL) 유지
5. 비격식체 → 전문적 영어

## 원문:
{content}

## 응답:
번역된 마크다운 본문만 응답하세요.`;
