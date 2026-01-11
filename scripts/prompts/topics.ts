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

export const WRITE_ARTICLE_PROMPT = `당신은 MIT Technology Review 스타일의 기술 기자입니다.
다음 조사 결과를 바탕으로 전문적인 블로그 아티클을 작성하세요.

## 토픽:
{topic}

## 조사 결과:
{findings}

## 작성 규칙:
1. 조사 결과에 있는 정보만 사용 (원본 갤러리 글 참조 금지)
2. 본문에는 출처 링크 넣지 마세요 - 깔끔하게 읽히도록
3. 추측/가정 금지 - 확인된 사실만
4. 문장 15단어 이내, 능동태
5. 금지 표현: "매우", "다양한", "효과적", "탁월한"

## 중요: 출처 표기 방식
- 본문에 [Title](URL) 형식 사용 금지
- 본문은 깔끔하게, 출처 없이 작성
- 모든 출처는 글 마지막 "참고 자료" 섹션에만 모아서 표기

## 구조:
1. **도입부** (2-3문장): 핵심 인사이트 + 왜 중요한지
2. ## 현황: 조사된 사실과 데이터 (2-3문단)
3. ## 분석: 의미와 영향 (2문단)
4. ## 실전 적용: 독자가 활용할 수 있는 방법 (1-2문단)
5. ## FAQ: 질문 3개 (Q&A 형식, 답변에도 링크 넣지 말 것)
6. ## 결론: 요약 + 행동 제안 (1문단)

마크다운 본문만 응답하세요. 프론트매터 없이. 본문에 링크 넣지 마세요.`;

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
