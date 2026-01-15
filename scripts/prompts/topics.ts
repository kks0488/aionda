// Topic extraction and article writing prompts

export const EXTRACT_TOPIC_PROMPT = `당신은 AI 기술 큐레이터입니다.
다음 커뮤니티 글을 읽고, 전문적인 블로그 아티클로 다룰 만한 토픽을 추출하세요.

## 글 내용:
{content}

## 추출 기준:
1. 기술적 인사이트가 있는가? (새로운 정보, 비교, 분석)
2. 독자에게 실용적 가치가 있는가? (활용 방법, 팁, 전략)
3. 검증 가능한 주장이 있는가? (수치, 사실, 비교)

## 응답 규칙:
- 논의 가치가 없으면 worthDiscussing: false
- 갤러리 말투/비속어는 무시하고 핵심 인사이트만 추출
- 조사 질문은 공식 문서/논문에서 답을 찾을 수 있는 것으로

## 응답 (JSON):
{
  "worthDiscussing": true/false,
  "reason": "판단 이유 (1문장)",
  "topic": {
    "title": "토픽 제목 (전문적, 20자 이내)",
    "description": "토픽 설명 (1-2문장)",
    "keyInsights": ["핵심 인사이트 1", "핵심 인사이트 2"],
    "researchQuestions": [
      "조사할 질문 1 (공식 문서에서 답 찾을 수 있는 것)",
      "조사할 질문 2",
      "조사할 질문 3"
    ]
  }
}

JSON만 응답하세요.`;

export const EXTRACT_TOPIC_FROM_NEWS_PROMPT = `당신은 AI 기술 에디터입니다.
다음 뉴스/블로그 기사를 읽고, 우리 블로그에서 다룰 만한 토픽인지 판단하세요.

## 기사:
{content}

## 추출 기준:
1. AI/기술 관련 뉴스인가?
2. 최신 정보인가? (1주일 이내 발표)
3. 독자에게 가치가 있는가?
4. 이미 널리 알려진 오래된 뉴스가 아닌가? (예: 2026년 시점에서 Gemini 2.0, GPT-4, Claude 3.5 소식은 구식임)

## 응답 규칙:
- AI/기술과 무관하면 worthDiscussing: false
- 단순 제품 광고/홍보는 제외
- 실질적 기술 변화가 있는 것만 선택
- 2026년 기준 레거시 모델(Gemini 2.x 이하, GPT-4 이하, Claude 3.5 이하) 관련 단순 소식은 worthDiscussing: false

## 응답 (JSON):
{
  "worthDiscussing": true/false,
  "reason": "판단 이유 (1문장)",
  "topic": {
    "title": "토픽 제목 (전문적, 20자 이내)",
    "description": "토픽 설명 (1-2문장)",
    "keyInsights": ["핵심 인사이트 1", "핵심 인사이트 2"],
    "researchQuestions": [
      "추가 조사할 질문 1",
      "추가 조사할 질문 2",
      "추가 조사할 질문 3"
    ]
  }
}

JSON만 응답하세요.`;

export const RESEARCH_QUESTION_PROMPT = `당신은 AI 기술 리서처입니다.
다음 질문에 대해 검색 결과를 바탕으로 정확한 답변을 작성하세요.

## 질문:
{question}

## 검색 결과:
{searchResults}

## 응답 규칙:
1. 검색 결과에 있는 정보만 사용
2. 확인되지 않은 정보는 "확인되지 않음"으로 표시
3. 출처 URL 필수 포함
4. 추측/가정 금지

## 응답 (JSON):
{
  "answer": "질문에 대한 답변 (검색 결과 기반)",
  "confidence": 0.0-1.0,
  "sources": [
    {
      "url": "출처 URL",
      "title": "출처 제목",
      "snippet": "관련 인용문"
    }
  ],
  "unverified": ["확인되지 않은 부분 (있다면)"]
}

JSON만 응답하세요.`;

export const WRITE_ARTICLE_PROMPT = `당신은 최고의 AI 기술 기자입니다. The Verge, TechCrunch 수준의 글을 씁니다.

## 토픽:
{topic}

## 조사 결과:
{findings}

## 핵심 원칙:
1. **후킹**: 첫 문장에서 독자를 사로잡아라. "~가 발표했다"로 시작하지 마라.
2. **구체성**: 숫자, 날짜, 이름을 넣어라. "큰 성과" 대신 "벤치마크 15% 향상"
3. **맥락**: 왜 이게 중요한지 설명해라. 업계 전체에 미치는 영향.
4. **비판적 시각**: 장점만 나열하지 마라. 한계, 우려, 반론도 다뤄라.
5. **실용성**: 독자가 뭘 해야 하는지 알려줘라.

## 문체:
- 짧은 문장과 긴 문장을 섞어 리듬감 있게
- 수동태 금지. "발표되었다" → "구글이 발표했다"
- 금지 표현: "매우", "다양한", "탁월한", "혁신적인", "획기적인"
- 비유와 예시를 활용해 어려운 개념을 쉽게
- 전문 용어는 처음 등장할 때 간단히 설명

## 구조 (2000자 이상):

**도입부** (3-4문장)
- 훅: 왜 이게 지금 중요한가?
- 핵심 뉴스 1문장 요약
- 업계 맥락 1문장

## 현황
(2-3문단, 각 3-4문장)
- 발표된 사실, 수치, 기능
- 경쟁사 비교가 있다면 포함
- 출시 시기, 가격, 접근 방법

## 분석
(2문단)
- 이게 왜 중요한가? 업계에 미치는 영향
- 우려점이나 한계는? 비판적 시각

## 실전 적용
(1-2문단)
- 개발자/사용자가 지금 할 수 있는 것
- 구체적인 활용 시나리오

## FAQ
(3개, Q&A 형식)
- 독자가 궁금해할 질문 3개
- 간결하지만 충분한 답변

## 결론
(1문단)
- 핵심 요약 1-2문장
- 앞으로 주목할 점

## 금지사항:
- 본문에 [링크](URL) 형식 금지
- "참고 자료" 섹션 작성 금지 (시스템이 자동 추가)
- 프론트매터 없이 본문만

마크다운 본문만 응답하세요.`;

export const GENERATE_METADATA_PROMPT = `다음 본문에 맞는 메타데이터를 생성하세요.

## 본문:
{content}

## 규칙:
- 한글 제목: 25자 이내
- 영어 제목: 8-10 단어, Title Case
- 슬러그: 영어, 소문자, 하이픈
- 메타 설명: 한글 80자, 영어 120자 이내
- 태그: 관련 키워드 3-5개

## 응답 (JSON):
{
  "title_ko": "한글 제목",
  "title_en": "English Title",
  "slug": "english-slug",
  "description_ko": "한글 메타 설명",
  "description_en": "English meta description",
  "tags": ["tag1", "tag2", "tag3"]
}

JSON만 응답하세요.`;

export const GENERATE_IMAGE_PROMPT_PROMPT = `당신은 AI 이미지 생성 프롬프트 전문가입니다.
다음 블로그 글의 제목과 내용을 바탕으로, 커버 이미지 생성용 프롬프트를 작성하세요.

## 글 정보:
제목: {title}
요약: {excerpt}

## 프롬프트 작성 규칙:
1. **절대 텍스트 금지**: 프롬프트에 제목, 레이블, 텍스트 관련 단어 포함 금지
2. **시각적 메타포**: 글의 핵심 개념을 추상적 이미지로 표현
3. **분위기**: 미래적, 기술적, 전문적
4. **색상**: 블루/시안/다크 그라디언트 기본
5. **구도**: 16:9 비율, 중앙 포커스

## 좋은 예시:
- "AI 일자리 대체" → "human silhouettes dissolving into digital particles, office environment fading into circuit patterns"
- "커리어 피라미드 붕괴" → "crumbling geometric pyramid structure with fragmented platforms, figures climbing unstable steps"
- "LLM 추론 능력" → "neural pathways forming tree-like branching structures, glowing connections"

## 나쁜 예시 (금지):
- "AI job replacement text" (텍스트 언급)
- "cover image for blog post" (블로그/커버 언급)
- "title: AI Revolution" (제목/레이블)

## 응답 (JSON):
{
  "imagePrompt": "Cinematic digital art, [시각적 요소들], [색상 팔레트], dark gradient background, futuristic aesthetic, dramatic lighting, 16:9 composition, abstract conceptual visualization, ultra high quality"
}

JSON만 응답하세요.`;
