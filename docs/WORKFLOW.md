# Workflow Guide

This document describes how Aionda produces and publishes posts (production workflow).

## Overview

Two modes are supported:

1. **Automatic publishing (production)**: hourly cron runs `scripts/auto-publish.sh`
2. **Manual run**: run the publish pipeline by hand (recommended for debugging)

## Field Notes (사용기/리뷰)

Field Notes는 “현장 사용기/워크플로우 회고”를 위한 운영 방식입니다.

- 분류: 시리즈 3종(`k-ai-pulse|explainer|deep-dive`) 중 1개 + `field-notes` 태그
- 표기: `byline`(작성/편집) + `## 공개`(Disclosure) + `## 환경` 섹션 권장
- 외부 글은 “가공해서 재게시”하지 않고 요약+링크(+짧은 인용)로만 활용

상세 규칙: `docs/FIELD_NOTES.md`

Production pipeline (publish mode):

```
DC + RSS crawl → topic extraction → research (SearchMode) → write (ko+en) → content gate (strict+verify) → cover images → build → commit/push
```

For operational troubleshooting (status/logs/candidate pool), see `docs/AUTOMATION.md`.

## Automatic publishing (cron)

`scripts/auto-publish.sh` is designed for unattended cron execution.

```bash
crontab -l
# Recommended: run from a dedicated clean clone (e.g., /home/kkaemo/aionda-publisher)
# 0 * * * * /home/kkaemo/aionda-publisher/scripts/auto-publish.sh
```

## Manual run (publish pipeline)

### One-shot (recommended)

```bash
pnpm pipeline:publish
```

### Step-by-step (debug-friendly)

```bash
# 1) Crawl sources
pnpm crawl --pages=2
pnpm crawl-rss

# 2) Extract + research topics
pnpm extract-topics --limit=3
pnpm research-topic --limit=3

# 3) Write posts (creates ko/en MDX under apps/web/content/posts)
pnpm write-article

# 4) Production quality gate (strict lint + factual verification)
pnpm content:gate:publish

# 5) Cover images (requires ENABLE_IMAGE_GENERATION=true)
ENABLE_IMAGE_GENERATION=true pnpm generate-image

# 6) Build
pnpm build
```

### Optional: series heuristic sanity-check (no AI calls)

```bash
pnpm -s tsx scripts/series-simulate.ts --limit=60
```

## Outputs (key locations)

```text
data/raw/                    # DC crawl output (local only)
data/official/ data/news/    # RSS/official crawl output (local only)
data/topics/ data/researched/# topic extraction + research output (local only)
apps/web/content/posts/      # published MDX (tracked)
apps/web/public/images/posts/# cover images (tracked)
.vc/                         # local reports + candidate pool (gitignored)
```

## Legacy/manual pipeline (kept for compatibility)

Older scripts still exist (`pnpm select`, `pnpm verify`, `pnpm translate`, `pnpm generate-post`), but the production publish path is `pipeline:publish` / `auto-publish.sh`.
