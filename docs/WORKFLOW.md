# Workflow Guide

This document describes how Aionda produces and publishes posts (production workflow).

## Overview

Two modes are supported:

1. **Automatic publishing (production)**: hourly cron runs `scripts/auto-publish.sh`
2. **Manual run**: run the publish pipeline by hand (recommended for debugging)

Production pipeline (publish mode):

```
DC + RSS crawl → topic extraction → research (SearchMode) → write (ko+en) → content gate (strict+verify) → cover images → build → commit/push
```

For operational troubleshooting (status/logs/candidate pool), see `docs/AUTOMATION.md`.

## Automatic publishing (cron)

`scripts/auto-publish.sh` is designed for unattended cron execution.

```bash
crontab -l
# 0 * * * * /home/kkaemo/projects/aionda/scripts/auto-publish.sh
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
