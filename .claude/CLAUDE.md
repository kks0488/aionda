# Singularity Blog - Claude Code Context

## Project Overview

This is a tech blog that curates AI/technology content from the Korean DC Inside "thesingularity" gallery, verifies information, translates to English, and publishes globally.

## Key Directories

```
/home/kkaemo/projects/singularity-blog/
├── apps/web/           # Next.js 14 blog site
├── packages/crawler/   # Crawling module
├── scripts/            # CLI tools (crawl, verify, translate)
├── data/
│   ├── raw/            # Crawled posts (JSON)
│   ├── selected/       # Curated posts
│   └── verified/       # Fact-checked posts
├── docs/               # Documentation
└── specs/              # Technical specifications
```

## Common Tasks

### Crawling
```bash
pnpm crawl              # Crawl latest posts
pnpm crawl --pages=5    # Crawl 5 pages
```
Or use: `/singularity-crawl`

### Selection
```bash
pnpm select             # Interactive post selection
```
Or use: `/singularity-select`

### Verification
```bash
pnpm verify             # Verify selected posts
pnpm verify --id=123    # Verify specific post
```
Or use: `/singularity-verify`

### Translation
```bash
pnpm translate          # Translate verified posts
```
Or use: `/singularity-translate`

### Publishing
```bash
pnpm generate-post      # Generate MDX files
pnpm dev                # Preview locally
git push                # Deploy to Vercel
```
Or use: `/singularity-publish`

## Data Schemas

### Raw Post (`data/raw/*.json`)
```json
{
  "id": "123456",
  "title": "Post title",
  "category": "정보/뉴스",
  "author": "nickname",
  "date": "2025.01.10",
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
  "postId": "123456",
  "claims": [...],
  "overallScore": 0.85,
  "recommendation": "publish",
  "title_en": "English title",
  "content_en": "Translated content"
}
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Content**: MDX with next-mdx-remote
- **i18n**: next-intl (English primary, Korean secondary)
- **Styling**: Tailwind CSS
- **Crawling**: Cheerio (static) / Playwright (dynamic)
- **AI**: Claude API
- **Deployment**: Vercel

## Important Notes

1. **Rate Limiting**: Always use 1-second delay between requests when crawling
2. **Verification**: Check official sources first (company blogs, docs)
3. **Translation**: Preserve code blocks, URLs, product names
4. **i18n**: English is primary language, Korean is secondary

## Subagents Available

- `singularity-crawler`: Crawling specialist
- `singularity-verifier`: Fact-checking specialist
- `singularity-translator`: Translation specialist

## MCP Servers

- `puppeteer`: For dynamic page crawling
- `filesystem`: Enhanced file operations

## Relevant Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Workflow](./docs/WORKFLOW.md)
- [Crawling](./docs/CRAWLING.md)
- [Verification](./docs/VERIFICATION.md)
- [Translation](./docs/TRANSLATION.md)

---

# 외부 AI 작업 프로세스 (API 비용 없이 직접 작업)

외부 AI(Claude Code, ChatGPT 등)가 **직접 글을 수집하고 MDX를 생성**하는 프로세스입니다.

## 작업 명령어

### `/external-ai` - 외부 AI 글 생성 모드

이 명령어를 실행하면:
1. `data/raw/*.json`에서 수집된 글 목록 확인
2. 품질 높은 글 선택 (조회수, 추천수, 카테고리 기준)
3. 웹 검색으로 사실 검증
4. MDX 파일 직접 생성 (ko/en)
5. Git 커밋 및 푸시

## 글 선택 기준

`data/raw/*.json` 파일에서 다음 기준으로 선택:

| 우선순위 | 기준 |
|----------|------|
| 1 | 카테고리: "정보/뉴스", "AI 정보" |
| 2 | 조회수 500 이상 |
| 3 | 추천수 20 이상 |
| 4 | 최신순 (7일 이내) |

## MDX 생성 사양

### 프론트매터 필수 항목
```yaml
---
title: "글 제목"
date: "YYYY-MM-DD"
excerpt: "150자 내외 요약"
tags: ["AI", "Technology", ...]
coverImage: "/images/posts/{slug}.jpeg"
category: "Technology"
author: "AI Onda"
sourceUrl: "원본 DC Inside URL"
alternateLocale: "/en/posts/{slug}" # 또는 /ko/posts/{slug}
---
```

### 파일 저장 경로
- 한국어: `apps/web/content/posts/ko/{slug}.mdx`
- 영어: `apps/web/content/posts/en/{slug}.mdx`

### 슬러그 생성 규칙
- 영어 제목 기반
- 소문자, 하이픈으로 연결
- 예: `openai-gpt-5-rumors-and-facts`

## 품질 체크리스트 (필수 확인)

글 생성 완료 후 반드시 확인:
- [ ] 첫 문단에 [문제 + 해결책 + 근거] 포함
- [ ] 추상적 표현 (쉽게/효과적으로/다양한) 0개
- [ ] 모든 주장에 숫자/데이터/출처 첨부
- [ ] "실패 케이스" 또는 "흔히 하는 실수" 섹션 포함
- [ ] FAQ 3개 이상 포함
- [ ] 섹션 제목이 행동/질문형
- [ ] 2,000자 이상

## 작업 흐름

```
1. data/raw/*.json 확인
   └─ 최신 수집된 글 목록 확인

2. 글 선택
   └─ 선택 기준에 맞는 글 1-3개 선택

3. 사실 검증 (웹 검색)
   └─ 주요 주장/수치 검증
   └─ 공식 출처 확인

4. MDX 생성
   └─ 한국어 버전 작성
   └─ 영어 버전 번역 (동일 구조 유지)

5. 파일 저장
   └─ apps/web/content/posts/ko/{slug}.mdx
   └─ apps/web/content/posts/en/{slug}.mdx

6. 커밋 & 푸시
   └─ git add && git commit && git push
```

## 예시: 작업 시작

```
User: 글 수집해서 MDX 만들어줘

AI 작업:
1. ls data/raw/*.json 으로 최신 글 확인
2. 품질 높은 글 선택
3. 웹 검색으로 사실 검증
4. MDX 파일 생성 (ko/en)
5. 이미지 생성 (pnpm generate-image)
6. git commit & push
```

## 참고 문서

- 품질 가이드: `templates/QUALITY-PROMPT.md`
- 브리프 템플릿: `templates/BRIEF-TEMPLATE.md`
- 외부 AI 가이드: `docs/EXTERNAL_AI.md`
