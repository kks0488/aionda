# Content Quality (Aionda)

이 문서는 **콘텐츠 품질을 “시스템적으로” 올리고 유지**하기 위한 도구/규칙/운영 방법을 정리합니다.

## 품질의 정의

- **사실성**: 글의 핵심 주장(수치/일정/벤치마크/정책)은 근거가 있어야 합니다.
- **정직함**: 확인되지 않은 내용은 단정하지 않고, 불확실성을 명확히 표시합니다.
- **출처 품질**: 불안정한 리다이렉트 링크/저신뢰 출처를 지양합니다.
- **탐색성**: 최소 1개 이상의 핵심 카테고리(agi/llm/robotics/hardware)로 분류되어야 합니다.
- **언어 UX**: 번역이 없는 글은 404 대신 안내(브리지 페이지)로 처리합니다.

## 도구 (Scripts)

### 1) Audit (현황 리포트)

전체 현황을 빠르게 요약합니다.

```bash
pnpm content:audit -- --out=.vc/content-audit.json
pnpm content:audit -- --format=md --out=.vc/content-audit.md
```

`.vc/`는 Git에 포함되지 않도록 `.gitignore`에 제외되어 있습니다(로컬 리포트용).

### 2) Redirect 링크 정리 (출처 링크 품질)

`vertexaisearch.cloud.google.com/grounding-api-redirect/*` 같은 **불안정한 리다이렉트 URL**을
실제 원문 URL로 치환합니다.

```bash
pnpm content:fix-redirects
```

### 3) Frontmatter 정합성 (slug/locale/alternateLocale)

레거시 포스트에 `slug`, `locale`을 보강하고,
짝이 없는 번역 링크(`alternateLocale`)는 제거합니다.

```bash
pnpm content:fix-frontmatter
```

## Lint (빠른 품질 경고)

외부 바이너리 없이, repo-local 규칙으로 빠르게 경고를 확인합니다.

```bash
# 기본: 변경/신규 포스트만
pnpm content:lint

# 전체 포스트 검사(출력량 큼)
pnpm content:lint:all

# 경고도 실패 처리
pnpm content:lint -- --strict
```

현재는 **기존 레거시 콘텐츠가 많아** 기본 모드는 “에러만 실패”로 설정되어 있습니다.

## Gate (파이프라인용)

파이프라인 종료 전에 **정규화(고정 스크립트) + Lint**를 한 번에 수행합니다.

```bash
# 에러만 실패
pnpm content:gate

# 경고도 실패(더 엄격)
pnpm content:gate:strict
```

`pnpm pipeline`은 기본으로 `content:gate`를 포함합니다. 더 엄격하게는 `pnpm pipeline:strict`를 사용하세요.

## Verify (사실 주장 검증, 느리지만 강력)

변경/신규 포스트의 **검증 가능한 주장(claim)** 을 추출하고, SearchMode(구글 검색 도구)를 통해 재검증합니다.
풀오토 발행이라면 이 단계를 켜는 것이 안전합니다(비용/시간은 증가).

```bash
pnpm content:verify
```

## Publish Gate (권장: 풀오토 발행용)

엄격 게이트 + 사실 주장 검증까지 포함합니다.

```bash
pnpm content:gate:publish
```

자동 발행은 `pnpm pipeline:publish`를 사용하세요(토픽 1개 중심으로 제한 + publish gate 포함).

## 구현 포인트 (코드 위치)

- 카테고리 태깅(런타임 파생): `apps/web/lib/posts.ts`
- 리다이렉트 URL 정규화(파이프라인): `scripts/lib/url-normalize.ts`, `scripts/lib/gemini.ts`
- 번역 미존재 UX(브리지 페이지): `apps/web/app/[locale]/posts/[slug]/page.tsx`
- 프롬프트 규칙 강화: `scripts/prompts/structure.ts`, `scripts/prompts/topics.ts`
- Vale 룰(절대 표현): `styles/SingularityBlog/Absolutes.yml`
