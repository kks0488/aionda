# 외부 AI 작업 가이드

이 문서는 외부 AI(Claude Code, ChatGPT 등)를 사용하여 블로그 콘텐츠를 생성하는 가이드입니다.

> **참고**: 상세한 스킬 지침은 `~/.claude/skills/external-ai/SKILL.md`를 참조하세요.

---

## 빠른 시작

### 1. 작업 명령어

```bash
# 외부 AI 모드 활성화
/external-ai
```

### 2. 핵심 작업 흐름

```
1. data/raw/*.json 확인 (수집된 글)
2. 글 선택 (조회수 500+, 추천 20+)
3. 웹 검색으로 사실 검증
4. MDX 생성 (한국어/영어)
5. 빌드 확인 & 푸시
```

---

## 품질 기준 (2026년 1월 업데이트)

### 필수 체크리스트

| 항목 | 기준 | 미충족 시 |
|------|------|----------|
| **글자 수** | 2,000자 이상 | 내용 보강 |
| **verificationScore** | 0.85 이상 | 미확인 정보 삭제 |
| **FAQ** | 3개 이상 | FAQ 추가 |
| **실패 케이스** | 1개 이상 | 섹션 추가 |
| **출처** | 3개 이상 | 출처 추가 |
| **금지 표현** | 0개 | 수치로 대체 |

### 금지 표현

다음 표현은 **구체적 수치로 대체**:

| 금지 | 대체 예시 |
|------|----------|
| "쉽게", "간단하게" | "3단계로", "5분 내에" |
| "효과적으로" | "처리 속도 40% 향상" |
| "다양한", "여러" | "7개의", "15개 이상의" |
| "일반적으로", "보통" | "McKinsey에 따르면 72%가" |
| "대등한", "비슷한" | "MMLU 92.3% vs 91.8%" |

---

## 시간 검증 (CRITICAL)

### 구식 정보 방지

모든 "출시 예정" 표현에 대해 현재 상태 확인 필수:

```bash
# 예시: GPT-5 언급 시
WebSearch: "GPT-5 release date OpenAI official 2026"
→ 이미 출시됨 → "출시될 예정" 표현 사용 금지
```

### 체크리스트

| 표현 | 확인 사항 | 조치 |
|------|-----------|------|
| "출시될 예정" | 이미 출시되었는지 | 출시됨 → "출시된" |
| "o1과 비교" | o1이 최신인지 | o3 출시 → "당시 o1과" |
| "GPT-5 기다림" | GPT-5 출시 여부 | 출시됨 → 맥락 수정 |

---

## 이미지 처리

### 이미지 있는 경우

```yaml
coverImage: "/images/posts/{slug}.jpeg"
```

이미지 파일: `apps/web/public/images/posts/{slug}.jpeg`

### 이미지 없는 경우

**coverImage 필드를 생략**하면 자동으로 Placeholder 표시:
- Gradient 배경 (태그별 색상)
- Material Symbol 아이콘 (태그별 아이콘)

```yaml
# coverImage 생략 시 자동 Placeholder 적용
tags: ["OpenAI", "GPT"]  # 첫 번째 태그로 아이콘 결정
```

### 태그별 아이콘 매핑

| 태그 | 아이콘 | 색상 |
|------|--------|------|
| openai | smart_toy | blue-cyan |
| anthropic | psychology | purple-pink |
| news | newspaper | orange-amber |
| ai | memory | green-emerald |
| tutorial | school | indigo-violet |

---

## MDX 프론트매터

### 필수 필드

```yaml
---
title: "글 제목"
date: "2025-06-10"  # 뉴스/이벤트 발생일
excerpt: "150자 내외 요약"
tags: ["AI", "OpenAI", "GPT"]
category: "Technology"
author: "AI Onda"
sourceUrl: "https://..."
alternateLocale: "/en/posts/{slug}"
verificationScore: 0.85
---
```

### 선택 필드

```yaml
coverImage: "/images/posts/{slug}.jpeg"  # 이미지 있을 때만
sourceId: "123456"  # 갤러리 글 ID
```

---

## 저장 경로

```
apps/web/content/posts/ko/{slug}.mdx  # 한국어
apps/web/content/posts/en/{slug}.mdx  # 영어
apps/web/public/images/posts/{slug}.jpeg  # 이미지
```

---

## 작업 완료 후

```bash
# 빌드 확인
cd apps/web && pnpm build

# 커밋 & 푸시
git add .
git commit -m "feat: 새 포스트 - {제목 요약}"
git push origin main
```

---

## 참고 자료

- **스킬 상세**: `~/.claude/skills/external-ai/SKILL.md`
- **태그 유틸**: `apps/web/lib/tag-utils.ts`
- **포스트 카드**: `apps/web/components/PostCard.tsx`
