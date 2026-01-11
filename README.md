# AI온다 (aionda)

> **"한국 AI 커뮤니티의 집단지성을 전문적인 콘텐츠로 정제하여 세계에 전파한다"**

## 우리가 하는 것

| 단계 | 설명 |
|------|------|
| **큐레이션** | 수백 개의 갤러리 글 중 **정말 가치있는 정보**만 선별 |
| **검증** | AI + 웹 검색으로 **사실 여부 확인**, 거짓/과장 정보 필터링 |
| **재구성** | 커뮤니티 글을 **전문적인 블로그 아티클**로 변환 |
| **번역** | 한국어 정보를 **영어로 번역**해서 글로벌 발행 |
| **시각화** | AI 생성 이미지로 **프로페셔널한 외관** 제공 |

**중요: 우리는 갤러리 글을 그대로 복사하는 것이 아닙니다.**

핵심 원칙: `품질 > 양` | `검증 > 속도` | `가치 > 조회수`

---

## Overview

DC Inside "특이점이 온다" 갤러리의 AI 관련 콘텐츠를 자동으로 **큐레이션, 검증, 재구성**하여 글로벌 발행하는 완전 자동화 블로그입니다.

- **하루 3-5개 고품질 글** (양보다 질)
- **하루 4회 자동 실행** (02:00, 08:00, 14:00, 20:00 KST)
- **다단계 품질 필터링** (500자+, 검증점수 0.5+, 쓰레기 제목 거부)
- **AI 생성 커버 이미지** (모든 글에 자동 생성)

## 품질 게이팅 시스템

```
DC Inside Gallery
      ↓ (크롤링)
data/raw/*.json (수백 개)
      ↓ [필터 1: 500자 미만 거부, 쓰레기 제목 거부]
      ↓ [필터 2: 품질 점수 30점 이상]
data/selected/*.json (3개/실행)
      ↓ [필터 3: AI 사실 검증, No-Claims → 저신뢰도]
      ↓ [필터 4: verificationScore 0.5 이상]
data/verified/*.json
      ↓ [필터 5: 이중 제목 검증 (원본 + 구조화)]
content/posts/ (고품질 글만)
      ↓ (AI 이미지 생성)
Vercel Auto-Deploy
```

## Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Content** | MDX with next-mdx-remote |
| **i18n** | next-intl (ko primary, en secondary) |
| **Styling** | Tailwind CSS |
| **Crawling** | Cheerio (axios, 1초 딜레이) |
| **AI** | Gemini API (검증, 번역, 이미지) |
| **Automation** | GitHub Actions (하루 4회) |
| **Deployment** | Vercel (자동 배포) |

## Project Structure

```
aionda/
├── apps/web/              # Next.js 블로그
│   ├── content/posts/     # MDX 포스트 (ko/, en/)
│   └── public/images/     # 커버 이미지
├── packages/crawler/      # 크롤링 모듈
├── scripts/               # 자동화 스크립트
│   ├── auto-select.ts     # 품질 점수 기반 선별
│   ├── verify.ts          # AI 사실 검증
│   ├── translate.ts       # 한→영 번역
│   └── generate-post.ts   # MDX 생성
├── data/                  # 데이터 파이프라인
│   ├── raw/               # 수집된 원본
│   ├── selected/          # 선별된 글
│   └── verified/          # 검증된 글
└── docs/                  # 문서
```

## Quick Start

```bash
# 의존성 설치
pnpm install

# 개발 서버
pnpm dev

# 크롤링
pnpm crawl

# 자동 선별
pnpm auto-select

# 검증
pnpm verify

# 번역
pnpm translate

# 포스트 생성
pnpm generate-post

# 이미지 생성
pnpm generate-image

# 빌드
cd apps/web && pnpm build
```

## Documentation

- [Vision](./docs/VISION.md) - 블로그 철학과 방향
- [Architecture](./docs/ARCHITECTURE.md) - 시스템 아키텍처
- [Claude Context](./.claude/CLAUDE.md) - Claude Code 컨텍스트

## 우리가 하지 않는 것

- ❌ 갤러리 글을 **그대로 복사**해서 올리는 것
- ❌ 품질 검증 없이 **양**만 채우는 것
- ❌ "제목 없음", 한 줄 채팅 같은 **쓰레기 글** 발행
- ❌ 사실 확인 없이 **루머/추측** 전파

---

**AI온다는 "갤러리 글 복사기"가 아닙니다.**

우리는 한국 AI 커뮤니티의 집단지성을 정제하여 세계에 전파합니다.
