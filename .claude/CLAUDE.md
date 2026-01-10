# AI Onda Blog - Claude Code Context

## Project Overview

AI 기술 블로그로, DC Inside "특이점이 온다" 갤러리의 콘텐츠를 큐레이션하여 검증 후 글로벌 발행합니다.

## Key Directories

```
/home/kkaemo/projects/aionda/
├── apps/web/                    # Next.js 14 블로그
│   ├── content/posts/ko/        # 한국어 포스트 (MDX)
│   ├── content/posts/en/        # 영어 포스트 (MDX)
│   ├── public/images/posts/     # 커버 이미지
│   ├── components/              # React 컴포넌트
│   └── lib/                     # 유틸리티
├── data/
│   ├── raw/                     # 수집된 글 (JSON)
│   └── work-queue.json          # 작업 큐
├── docs/                        # 문서
└── .vibe/                       # 작업 로그
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Content**: MDX with next-mdx-remote
- **i18n**: next-intl (ko primary, en secondary)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

---

## 작업 명령어

### `/external-ai` - 콘텐츠 생성 모드

```
1. data/raw/*.json 확인 (수집된 글)
2. 글 선택 (조회수 500+, 추천 20+)
3. 웹 검색으로 사실 검증
4. MDX 생성 (ko/en)
5. 빌드 확인 & 푸시
```

---

## 품질 기준 (2026년 1월)

### 필수 체크리스트

| 항목 | 기준 |
|------|------|
| 글자 수 | 2,000자 이상 |
| verificationScore | 0.6 이상 |
| FAQ | 3개 이상 |
| 실패 케이스 | 1개 이상 |
| 출처 | 3개 이상 |
| 금지 표현 | 0개 |

### 금지 표현

"쉽게", "간단하게", "효과적으로", "다양한", "일반적으로", "대등한", "탁월한"
→ 구체적 수치로 대체

### 시간 검증 (CRITICAL)

모든 "출시 예정" 표현에 대해 현재 상태 확인:
- GPT-5, GPT-5.2, o3, o3-pro: **이미 출시됨**
- Claude Opus 4.5: **이미 출시됨**

---

## 이미지 처리

### 이미지 있을 때
```yaml
coverImage: "/images/posts/{slug}.jpeg"
```

### 이미지 없을 때
**coverImage 필드 생략** → 자동 Placeholder (Gradient + 태그 아이콘)

태그별 아이콘:
- openai → smart_toy
- anthropic → psychology
- news → newspaper
- ai → memory

---

## MDX 프론트매터

```yaml
---
title: "글 제목"
date: "2025-06-10"  # 뉴스 발생일
excerpt: "150자 요약"
tags: ["AI", "OpenAI"]
category: "Technology"
author: "AI Onda"
sourceUrl: "https://..."
alternateLocale: "/en/posts/{slug}"
verificationScore: 0.85
# coverImage: "/images/posts/{slug}.jpeg"  # 이미지 있을 때만
---
```

---

## 파일 경로

```
apps/web/content/posts/ko/{slug}.mdx  # 한국어
apps/web/content/posts/en/{slug}.mdx  # 영어
apps/web/public/images/posts/{slug}.jpeg  # 이미지 (선택)
```

---

## 빌드 & 배포

```bash
cd apps/web && pnpm build  # 빌드 확인
git add . && git commit -m "feat: 새 포스트" && git push
```

---

## 참고 문서

- [외부 AI 가이드](docs/EXTERNAL_AI.md)
- [스킬 상세](~/.claude/skills/external-ai/SKILL.md)
- [태그 유틸](apps/web/lib/tag-utils.ts)
