# Content Quality (Aionda)

이 문서는 **콘텐츠 품질을 “시스템적으로” 올리고 유지**하기 위한 도구/규칙/운영 방법을 정리합니다.

## 품질의 정의

- **사실성**: 글의 핵심 주장(수치/일정/벤치마크/정책)은 근거가 있어야 합니다.
- **정량 근거**: 숫자/퍼센트/가격/기간은 Sources snippet에서 확인 가능한 근거가 있을 때만 사용합니다. 없으면 정성 표현으로 바꿉니다.
- **정직함**: 확인되지 않은 내용은 단정하지 않고, 불확실성을 명확히 표시합니다.
- **저작권/출처**: 외부 글을 “가공해서 재게시”하지 않고, 요약+링크(+짧은 인용)로만 활용합니다. (Field Notes 규칙: `docs/FIELD_NOTES.md`)
- **출처 품질**: 불안정한 리다이렉트 링크/저신뢰 출처를 지양합니다.
- **탐색성**: 최소 1개 이상의 핵심 카테고리(agi/llm/robotics/hardware)로 분류되어야 합니다.
- **언어 UX**: 번역이 없는 글은 404 대신 안내(브리지 페이지)로 처리합니다.

## 현황 스냅샷 (2026-01-29 기준)

아래 수치는 “현재 레거시 포함 전체 상태”를 빠르게 파악하기 위한 스냅샷입니다.

- 포스트 파일: 906 (ko=468, en=438)
- Field Notes: 2 (희소함 → 차별화 포인트)
- 시리즈 태그(3종) 적용: 24/906 (대부분 미적용)
- Lint 경고(대표):
  - `missing_tldr` 696, `checklist_missing` 737, `example_missing` 722
  - `missing_sources` 82, `absolute_language` 292, `hype` 170
- 태그 폭발: unique tags 1439 (정규화/축약 필요)

> 측정: `pnpm -s tsx scripts/series-audit.ts`, `pnpm content:audit -- --format=md`, `pnpm content:lint:all`

## “읽고 싶은 글”을 늘리는 우선순위 (기능 추가 없이)

1) **Field Notes(직접 사용/실험) 비중을 의도적으로 늘리기**
- 독자가 가장 신뢰/재방문하는 유형(고유 경험 + 재현 가능한 환경/세팅 + 실패/트레이드오프).
- 외부 글을 “우리 글처럼” 재가공하지 않고, 참고는 요약+링크(+짧은 인용)만.

2) **신규 글은 구조 규칙을 “고정 구성”으로 통일**
- 세 줄 요약(3불릿) + 예시 1개(“예:”/“Example:”) + 실전 체크리스트(정확히 3불릿) + 출처 섹션.
- 레거시 전체를 당장 고치기보다, 신규/상위 트래픽 후보부터 점진 보정.

3) **탐색성: 태그/시리즈를 최소한으로 수렴**
- 신규 글은 시리즈 3종 중 1개를 반드시 선택(`k-ai-pulse|explainer|deep-dive`).
- 태그는 “핵심 1~3개” 중심으로 정규화(동의어/표기 흔들림 최소화).

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

### 4) Series 분류 시뮬레이션 (휴리스틱 점검)

발행 전에 “시리즈 3종” 분류가 한쪽으로 치우치지 않는지 빠르게 확인합니다. (AI 호출 없음)

```bash
pnpm -s tsx scripts/series-simulate.ts --limit=60
```

### 5) Series 태그 현황 점검 (발행된 글 기준)

실제 `apps/web/content/posts/`에 있는 글들이 시리즈 태그를 얼마나 갖고 있는지(레거시 포함) 확인합니다. (AI 호출 없음)

```bash
pnpm -s tsx scripts/series-audit.ts
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

## Publish Gate의 자동 복구(Self-heal)

`content:gate:publish`는 “한 번 실패하면 cron이 계속 막히는 문제”를 피하기 위해, 검증 단계에서 **제한적 자동 복구**를 수행합니다.

- 대상 파일: 기본적으로 변경/신규 포스트 + `.vc/last-written.json`의 “방금 생성된 포스트”
- 검증 실패 시:
  - **Hard failure(우선순위 high + verified=false)**는 `pnpm content:repair`로 최대 몇 번(제한된 횟수) 자동 보정 후 재검증합니다.
  - **Transient failure(타임아웃/검색 실패 등)**로만 실패하면 짧은 backoff 후 제한된 횟수 재시도합니다.
- 그래도 실패하면:
  - 새로 생성된(untracked) 글은 `.vc/candidate-pool/<timestamp>/`로 이동하고 `manifest.json`에 이유/리포트 경로를 남깁니다.
  - 남아있는 글만 다시 검증하여, 자동화가 “영구 실패”로 굳지 않게 합니다.

## 네트워크 내구성(타임아웃/재시도)

프로덕션 자동화는 외부 API(Gemini/Google Search, 이미지 생성, memU)를 호출하므로, 기본적으로 **타임아웃 + 제한적 재시도**가 적용되어 있습니다.

- Gemini 호출: 타임아웃/Abort, 429(rate limit), 5xx, 네트워크 오류는 backoff 재시도합니다.
- 이미지 생성(SiliconFlow): 요청/다운로드에 타임아웃을 두고, 429/5xx/네트워크 오류는 제한적으로 재시도합니다(실패 시 로컬 fallback 가능).
- memU: 짧은 재시도(1회) + 타임아웃으로 “일시 장애”에 덜 민감하게 동작합니다.

## 구현 포인트 (코드 위치)

- 카테고리 태깅(런타임 파생): `apps/web/lib/posts.ts`
- 리다이렉트 URL 정규화(파이프라인): `scripts/lib/url-normalize.ts`, `scripts/lib/gemini.ts`
- 번역 미존재 UX(브리지 페이지): `apps/web/app/[locale]/posts/[slug]/page.tsx`
- 프롬프트 규칙 강화: `scripts/prompts/structure.ts`, `scripts/prompts/topics.ts`
- Vale 룰(절대 표현): `styles/SingularityBlog/Absolutes.yml`
