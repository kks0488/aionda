# AI온다 (aionda) Blog - Claude Code Context

## Mission

> **"한국 AI 커뮤니티의 집단지성을 전문적인 콘텐츠로 정제하여 세계에 전파한다"**

**중요: 우리는 갤러리 글을 그대로 복사하는 것이 아닙니다.**

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
```

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
│   ├── auto-select.ts           # 품질 점수 기반 자동 선별
│   ├── verify.ts                # AI 사실 검증
│   ├── translate.ts             # 한→영 번역
│   ├── generate-post.ts         # MDX 생성
│   ├── generate-image.ts        # 커버 이미지 생성
│   └── lib/
│       └── work-queue.ts        # 작업 큐 관리 (24시간 타임아웃)
├── data/
│   ├── raw/                     # 수집된 글 (440+)
│   ├── selected/                # 선별된 글
│   ├── verified/                # 검증된 글
│   └── work-queue.json          # 작업 상태 관리
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
- **AI**: Gemini API (검증, 번역, 이미지 생성)
- **Image Gen**: gemini-3-pro-image-preview
- **Automation**: GitHub Actions (하루 4회 cron)
- **Deployment**: Vercel (자동 배포)

---

## Automated Pipeline

```
DC Inside Gallery
      ↓ (5 pages, 1s delay)
data/raw/*.json
      ↓ (quality score ≥ 25, max 3/run)
data/selected/*.json
      ↓ (Gemini verification, 3 retries)
data/verified/*.json
      ↓ (Gemini translation)
content/posts/ko/*.mdx + en/*.mdx
      ↓ (Gemini image, 3 retries)
public/images/posts/*
      ↓ (Next.js build)
      ↓ (git commit + push)
Vercel Auto-Deploy
```

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
# 크롤링
pnpm crawl              # 최신 글 수집
pnpm crawl --pages=5    # 5페이지 수집

# 자동 선별
pnpm auto-select        # 품질 점수 기반 자동 선별

# 검증
pnpm verify             # 선별된 글 검증

# 번역
pnpm translate          # 검증된 글 번역

# 포스트 생성
pnpm generate-post      # MDX 파일 생성

# 이미지 생성
pnpm generate-image     # 커버 이미지 생성

# 빌드 & 배포
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
| 출처 | 3개 이상 |
| 금지 표현 | 0개 |
| 커버 이미지 | 필수 (자동 생성) |

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
ANTHROPIC_API_KEY    # Claude API (검증, 번역용)
GOOGLE_AI_API_KEY    # Gemini API (이미지 생성용)
```

### Local (.env.local)
```
GEMINI_API_KEY=AIza...
MIN_QUALITY_SCORE=25
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
