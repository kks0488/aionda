# AI온다 (aionda) Blog - Claude Code Context

## Mission

> **"최신 AI 정보를 전문적인 콘텐츠로 정제하여 세계에 전파한다"**

**중요: 우리는 단순 복사가 아니라 검증된 정보를 재구성합니다.**

---

## Content Sources (콘텐츠 소스 정책)

### 소스 우선순위

| 우선순위 | 소스 유형 | 예시 | 용도 |
|---------|----------|------|------|
| **1순위** | 공식 블로그/발표 | Anthropic, OpenAI, Google AI, Nvidia 블로그 | 1차 소스, 가장 신뢰 |
| **2순위** | Tier A 뉴스 | TechCrunch, The Verge, Ars Technica, VentureBeat, MIT Tech Review | 심층 분석, 검증된 보도 |
| **3순위** | 리서치/논문 | arXiv, Hugging Face Papers, Google Scholar | 기술 심층 분석 |
| **4순위** | 공식 X/Twitter | @OpenAI, @AnthropicAI, @GoogleAI, @ClaudeAI | 속보, 발표 |
| **5순위** | 커뮤니티 | DC Inside 특이점갤러리 | 트렌드 파악, 아이디어 |

### 수동 글 작성 시 (Claude에게 요청할 때)

```
필수 사항:
1. 최신 뉴스 검색 (WebSearch 사용)
2. 공식 소스 우선 참조
3. Tier S/A 출처 2개 이상 확보
4. 발표일/출시일 정확히 확인

권장 워크플로우:
1. "~에 대해 글 써줘" 요청
2. Claude가 WebSearch로 최신 정보 수집
3. 공식 블로그/뉴스에서 팩트 확인
4. 한국어 + 영어 버전 작성
5. 이미지 생성 및 배포
```

### 자동 파이프라인 소스

**다중 소스 통합 파이프라인:**

| 소스 | Tier | 스크립트 | 데이터 |
|------|------|----------|--------|
| 공식 블로그 (Nvidia, DeepMind, Microsoft, HuggingFace) | S | `crawl-rss` | `data/official/` |
| 뉴스 (TechCrunch, Ars Technica, VentureBeat, MIT Tech Review, Wired, ZDNet) | A | `crawl-rss` | `data/news/` |
| DC Inside 특이점갤러리 | C | `crawl` | `data/raw/` |

**파이프라인 흐름:**
```
[다양한 소스] → extract-topics → research-topic → write-article → generate-image
     ↓              ↓                  ↓               ↓              ↓
  S/A/C 우선순위   토픽 추출        Gemini 검색      글 작성      AI 이미지
```

**이미지 생성:**
- Gemini로 글 내용 분석 → 시각적 메타포 생성 → SiliconFlow 이미지 생성
- 텍스트 없는 추상적 시각화

### 최신성 기준

- **속보**: 발표 후 24시간 이내
- **분석 기사**: 발표 후 1주일 이내
- **심층 리뷰**: 출시 후 1개월 이내

**오래된 정보 경고:**
> 1개월 이상 지난 정보는 "현재 상태 확인 필요" 표시

---

## 핵심 철학

### 우리가 하는 것
| 단계 | 설명 |
|------|------|
| **큐레이션** | 수백 개의 갤러리 글 중 **정말 가치있는 정보**만 선별 |
| **검증** | AI + 웹 검색으로 **사실 여부 확인**, 거짓/과장 정보 필터링 |
| **재구성** | 커뮤니티 글을 **전문적인 블로그 아티클**로 변환 |
| **번역** | 한국어 정보를 **영어로 번역**해서 글로벌 발행 |
| **시각화** | AI 생성 이미지로 **프로페셔널한 외관** 제공 |

### 우리가 하지 않는 것
- ❌ 갤러리 글을 **그대로 복사**해서 올리는 것
- ❌ 품질 검증 없이 **양**만 채우는 것
- ❌ "제목 없음", 한 줄 채팅 같은 **쓰레기 글** 발행
- ❌ 사실 확인 없이 **루머/추측** 전파

### 원칙
```
품질 > 양
검증 > 속도
가치 > 조회수
가독성 > 길이
```

**길다고 좋은 게 아니다:**
- 잘 읽혀야 한다
- 후킹이 되어야 한다
- 핵심이 명확해야 한다

**자세한 철학: [docs/VISION.md](docs/VISION.md)**

---

## Project Overview

**완전 자동화된 AI 기술 블로그**입니다.

DC Inside "특이점이 온다" 갤러리의 AI 관련 콘텐츠를 **큐레이션, 검증, 재구성**하여 글로벌 발행합니다.

**핵심 특징:**
- GitHub Actions 기반 하루 4회 자동 실행
- 하루 3-5개 **고품질** 글 생성 (양보다 질)
- 다단계 품질 필터링 (500자+, 검증점수 0.5+, 쓰레기 제목 거부)
- Gemini AI로 커버 이미지 자동 생성
- 에러 복구 및 재시도 로직 내장

## Automation Schedule

| 시간 (KST) | UTC | 실행 내용 |
|-----------|-----|----------|
| 02:00 | 17:00 | 크롤링 → 선별 → 검증 → 번역 → 발행 |
| 08:00 | 23:00 | 크롤링 → 선별 → 검증 → 번역 → 발행 |
| 14:00 | 05:00 | 크롤링 → 선별 → 검증 → 번역 → 발행 |
| 20:00 | 11:00 | 크롤링 → 선별 → 검증 → 번역 → 발행 |

**각 실행: 최대 3개 글 생성 (하루 총 8-12개)**

## Key Directories

```
/home/kkaemo/projects/aionda/
├── apps/web/                    # Next.js 14 블로그
│   ├── content/posts/ko/        # 한국어 포스트 (MDX)
│   ├── content/posts/en/        # 영어 포스트 (MDX)
│   ├── public/images/posts/     # 커버 이미지 (AI 생성)
│   ├── components/              # React 컴포넌트
│   └── lib/                     # 유틸리티
├── packages/crawler/            # 크롤링 모듈
├── scripts/                     # 자동화 스크립트
│   ├── crawl.ts                 # DC Inside 크롤러
│   ├── crawl-rss.ts             # RSS 피드 크롤러 (공식 블로그 + 뉴스)
│   ├── extract-topics.ts        # 통합 토픽 추출 (S/A/C 우선순위)
│   ├── research-topic.ts        # Gemini + Google Search 검증
│   ├── write-article.ts         # 아티클 작성
│   ├── generate-image.ts        # AI 동적 이미지 프롬프트 + SiliconFlow
│   ├── prompts/topics.ts        # 프롬프트 모음
│   └── lib/
│       ├── gemini.ts            # Gemini API 클라이언트
│       └── work-queue.ts        # 작업 큐 관리
├── data/
│   ├── raw/                     # DC Inside 수집
│   ├── official/                # 공식 블로그 RSS (Tier S)
│   ├── news/                    # 뉴스 RSS (Tier A)
│   ├── topics/                  # 추출된 토픽
│   ├── researched/              # 리서치 완료
│   └── published/               # 발행 완료
├── .github/workflows/
│   └── auto-update.yml          # 자동화 워크플로우
├── docs/                        # 문서
└── .vibe/                       # 작업 로그
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Content**: MDX with next-mdx-remote
- **i18n**: next-intl (ko primary, en secondary)
- **Styling**: Tailwind CSS
- **Crawling**: Cheerio (axios, 1초 딜레이)
- **AI**: Gemini API (검증, 번역, 구조화, 이미지 생성)
- **Automation**: GitHub Actions (하루 4회 cron)
- **Deployment**: Vercel (자동 배포)

---

## Automated Pipeline (Topic-Based)

```
DC Inside Gallery
      ↓ (pnpm crawl, 5 pages, 1s delay)
data/raw/*.json (800+ posts)
      ↓ (pnpm extract-topics)
data/topics/*.json (토픽 추출, 가치 판단)
      ↓ (pnpm research-topic)
data/researched/*.json (Tier S/A 출처 2개+ 필수)
      ↓ (pnpm write-article)
content/posts/ko/*.mdx + en/*.mdx
      ↓ (pnpm generate-image)
public/images/posts/*
      ↓ (git commit + push)
Vercel Auto-Deploy
```

### Source Tier Classification
| Tier | 유형 | 예시 |
|------|------|------|
| **S** | 학술/공식 | PubMed, arXiv, 공식 docs |
| **A** | 권위있는 뉴스 | Reuters, TechCrunch, The Verge |
| **B** | 주의 필요 | 일반 블로그, 커뮤니티 |
| **C** | 참고만 | SNS, 개인 의견 |

**발행 기준: Tier S/A 출처 2개 이상 필수**

---

## Quality Scoring (Auto-Select)

### 필수 조건 (먼저 체크)
```
✗ 제목이 "제목 없음", "무제", "ㅇㅇ" 등 → 즉시 거부
✗ 콘텐츠 500자 미만 → 즉시 거부
✗ 유의미한 문장 2개 미만 → 즉시 거부
✗ 의미있는 텍스트 200자 미만 (이모티콘/기호 제외) → 즉시 거부
```

### 점수 계산 (필수 조건 통과 후)
```
기본 점수:
  + 조회수/50 (최대 20점)
  + 좋아요×2 (최대 20점)

보너스:
  + AI 키워드 (ai, gpt, claude 등): +5점/개
  + 정보/뉴스 카테고리: +10점
  + 콘텐츠 200자 이상: +10점

페널티:
  - 스팸 키워드 (광고, 코인 등): -15점/개
  - 제목 10자 미만: -20점

선택 기준:
  - MIN_QUALITY_SCORE: 30
  - MAX_POSTS: 5/실행
```

### 최종 발행 검증 (generate-post.ts)
```
✗ 제목이 쓰레기 타이틀 → 발행 거부
✗ 콘텐츠 500자 미만 → 발행 거부
✗ verificationScore 0.5 미만 → 발행 거부
✗ 유의미한 문장 2개 미만 → 발행 거부
```

---

## Work Queue Management

`scripts/lib/work-queue.ts`

**자동 타임아웃:**
- 24시간 이상 claimed 상태 → 자동 해제
- 중복 작업 방지
- 긴급 복구: `forceReleaseAllClaims()`

---

## Manual Commands

```bash
# === 다중 소스 파이프라인 (권장) ===
pnpm crawl              # DC Inside 크롤링
pnpm crawl-rss          # 공식 블로그 + 뉴스 RSS 수집
pnpm crawl-all          # 모든 소스 크롤링 (위 두 개 동시 실행)

pnpm extract-topics     # 통합 토픽 추출 (S > A > C 우선순위)
pnpm research-topic     # Gemini + Google Search 검증
pnpm write-article      # 아티클 생성 (ko + en)
pnpm generate-image     # AI 동적 프롬프트 + 이미지 생성

# === 전체 파이프라인 한번에 ===
pnpm pipeline           # crawl → extract → research → write → image

# === 레거시 파이프라인 (사용 안함) ===
pnpm auto-select        # 품질 점수 기반 자동 선별
pnpm verify             # 선별된 글 검증
pnpm translate          # 검증된 글 번역
pnpm generate-post      # MDX 파일 생성

# === 빌드 & 배포 ===
cd apps/web && pnpm build
git push                # Vercel 자동 배포
```

---

## Data Schemas

### Raw Post (`data/raw/*.json`)
```json
{
  "id": "930644",
  "title": "OpenAI GPT-5 출시",
  "category": "정보/뉴스",
  "author": "nickname",
  "date": "2026.01.10",
  "content": "<html>",
  "contentText": "plain text",
  "views": 1234,
  "likes": 56,
  "url": "https://..."
}
```

### Verified Post (`data/verified/*.json`)
```json
{
  "postId": "930644",
  "claims": [...],
  "overallScore": 0.85,
  "recommendation": "publish",
  "translation": {
    "title_en": "English title",
    "content_en": "Translated content",
    "slug": "openai-gpt-5-launch"
  }
}
```

### Work Queue (`data/work-queue.json`)
```json
{
  "claimed": {
    "930644": { "by": "crawler", "at": "2026-01-10T21:44:05Z", "task": "auto-select" }
  },
  "completed": {
    "930037": { "by": "external-ai", "at": "2026-01-10T21:55:00Z", "slug": "ai-inference-scaling" }
  },
  "lastUpdated": "2026-01-10T21:45:11Z"
}
```

---

## Quality Standards (2026)

### Required Checklist

| 항목 | 기준 |
|------|------|
| 글자 수 | 2,000자 이상 |
| verificationScore | 0.6 이상 |
| FAQ | 3개 이상 |
| 출처 | Tier S/A 2개 이상 |
| 금지 표현 | 0개 |
| 커버 이미지 | 필수 (자동 생성) |

### Article Structure
```
1. 도입부 (2-3문장): 핵심 인사이트 + 왜 중요한지
2. ## 현황: 조사된 사실과 데이터 (2-3문단)
3. ## 분석: 의미와 영향 (2문단)
4. ## 실전 적용: 독자가 활용할 수 있는 방법 (1-2문단)
5. ## FAQ: 질문 3개 (Q&A 형식)
6. ## 결론: 요약 + 행동 제안 (1문단)
7. ## 참고 자료: 모든 출처 링크 모음
```

### Citation Rules (IMPORTANT)
- ❌ 본문에 `[Title](URL)` 형식 인라인 인용 금지
- ✅ 본문은 깔끔하게, 출처 없이 작성
- ✅ 모든 출처는 글 마지막 "참고 자료" 섹션에만 모아서 표기

### Banned Expressions

"쉽게", "간단하게", "효과적으로", "다양한", "일반적으로", "대등한", "탁월한"
→ 구체적 수치로 대체

### Time Verification (CRITICAL)

모든 "출시 예정" 표현에 대해 현재 상태 확인:
- GPT-5, GPT-5.2, o3, o3-pro: **이미 출시됨**
- Claude Opus 4.5: **이미 출시됨**
- Gemini 3: **이미 출시됨**

---

## Image Handling

### 자동 생성 (기본)
```yaml
coverImage: "/images/posts/{slug}.jpeg"
```

- Gemini gemini-3-pro-image-preview 모델 사용
- 제목/태그 기반 프롬프트 생성
- 모던 테크 스타일, 다크 그라디언트

### Placeholder (이미지 없을 때)
태그 기반 그라디언트 + 아이콘 자동 표시:
- openai → smart_toy (파란색 계열)
- anthropic → psychology (보라색 계열)
- news → newspaper (초록색 계열)
- ai → memory (청록색 계열)

---

## MDX Frontmatter

```yaml
---
title: "글 제목"
date: "2026-01-10"  # 뉴스 발생일
excerpt: "150자 요약"
tags: ["AI", "OpenAI"]
category: "Technology"
author: "AI Onda"
sourceUrl: "https://..."
sourceId: "930644"
alternateLocale: "/en/posts/{slug}"
verificationScore: 0.85
coverImage: "/images/posts/{slug}.jpeg"
---
```

---

## Error Recovery

### Retry Strategy

| 단계 | 최대 재시도 | 대기 시간 |
|------|------------|----------|
| Verify | 3회 | 10초 |
| Translate | 3회 | 10초 |
| Image Gen | 3회 | 15초 |

### Work Queue Timeout

- 24시간 이상 claimed → 자동 해제
- `cleanupStaleClaims()` 매 실행 시 호출
- `forceReleaseAllClaims()` 긴급 복구용

---

## Environment Variables

### GitHub Secrets (Required)
```
GOOGLE_AI_API_KEY    # Gemini API (검증, 번역, 이미지 생성)
```

### Local (.env.local)
```
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-3-flash-preview
MIN_QUALITY_SCORE=30
MAX_POSTS=3
```

---

## File Paths

```
apps/web/content/posts/ko/{slug}.mdx     # 한국어 포스트
apps/web/content/posts/en/{slug}.mdx     # 영어 포스트
apps/web/public/images/posts/{slug}.*    # 커버 이미지
data/raw/{id}.json                       # 원본 데이터
data/selected/{id}.json                  # 선별된 데이터
data/verified/{id}.json                  # 검증된 데이터
data/work-queue.json                     # 작업 큐
.github/workflows/auto-update.yml        # 자동화 워크플로우
```

---

## Important Notes

1. **완전 자동화**: GitHub Actions가 하루 4회 자동 실행
2. **품질 게이팅**: 품질 점수 25 이상만 선별
3. **이미지 필수**: 모든 포스트에 커버 이미지 자동 생성
4. **에러 복구**: 각 단계 3회 재시도, 타임아웃 자동 해제
5. **Rate Limiting**: 크롤링 1초 딜레이 필수

---

## Reference Docs

- [Architecture](docs/ARCHITECTURE.md) - 전체 아키텍처
- [태그 유틸](apps/web/lib/tag-utils.ts) - 태그 색상/아이콘
- [Work Queue](scripts/lib/work-queue.ts) - 작업 큐 관리

<!-- INFRASTRUCTURE_AUTOGEN_START -->
## Available Infrastructure

**이 프로젝트에서 사용 가능한 인프라입니다. 중복 구현을 피하세요.**

### 핵심 인프라
| 서비스 | URL | 용도 |
|--------|-----|------|
| Supabase | localhost:54322 | PostgreSQL + pgvector |
| Redis | localhost:6379 | 캐싱, 세션, 큐 |
| memU | http://localhost:8100 | AI 메모리, 중복 체크 |
| Coolify | http://localhost:8000 | 컨테이너 배포 |
| n8n | http://localhost:8081 | 워크플로우 자동화 |

### memU API 엔드포인트
- `POST /memorize` - 콘텐츠 저장
- `POST /retrieve` - 메모리 검색
- `POST /check-similar` - 중복 체크
- `GET/POST/PUT/DELETE /items` - CRUD

### 이 프로젝트 정보
- **슬러그**: aionda
- **역할**: frontend
- **할당 포트**: 3204

### 환경변수 관리
**공통 API 키는 global.env에서 복사하세요:**
```bash
cat ~/.config/claude-projects/global.env
```

포함된 키: GEMINI_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY, SUPABASE_*, NAVER_*, SLACK_BOT_TOKEN

### ⚠️ 주의사항
- **PORT 하드코딩 금지** - `.env`의 PORT 사용
- **API 키 직접 입력 금지** - global.env에서 복사
- **새 DB 생성 금지** - Supabase 사용
- **중복 체크** - memU `/check-similar` 사용

### 참조 문서
- 프로젝트 목록: `/home/kkaemo/projects/PROJECTS_OVERVIEW.md`
- 포트 맵: `/home/kkaemo/projects/ROUTING.md`
<!-- INFRASTRUCTURE_AUTOGEN_END -->
