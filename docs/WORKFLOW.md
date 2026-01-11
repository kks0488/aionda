# Workflow Guide

This document describes the complete workflow from discovering a post to publishing it on the blog.

## Overview

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│  Crawl  │───▶│ Select  │───▶│ Verify  │───▶│Translate│───▶│ Publish │
└─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘
```

## Step 1: Crawling

### Automatic Crawling
```bash
# Crawl latest posts from the gallery
pnpm crawl

# Crawl specific page range
pnpm crawl --pages 1-5

# Crawl with specific category filter
pnpm crawl --category "정보/뉴스"
```

### Using Claude Code Skill
```
/singularity-crawl
```

### Output Location
```
data/raw/
├── 123456.json
├── 123457.json
└── ...
```

### Raw Data Schema
```json
{
  "id": "123456",
  "title": "GPT-5 출시 예정 소식",
  "author": "nickname",
  "date": "2025-01-10T03:55:00Z",
  "category": "정보/뉴스",
  "content": "본문 내용...",
  "images": ["url1", "url2"],
  "views": 1234,
  "likes": 56,
  "comments": 12,
  "url": "https://gall.dcinside.com/..."
}
```

## Step 2: Selection

### Interactive CLI
```bash
pnpm select
```

This opens an interactive interface:
```
┌─────────────────────────────────────────────────────────────┐
│                    Post Selection                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Filter: [All] [정보/뉴스] [AI활용] [자료실]                  │
│  Sort: [Latest] [Views] [Likes]                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [ ] GPT-5 출시 예정 소식                             │   │
│  │     Views: 1234 | Likes: 56 | 2025-01-10            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ [x] Claude 3.5 Opus 벤치마크 분석                    │   │
│  │     Views: 2345 | Likes: 89 | 2025-01-09            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ [ ] 주식 관련 잡담                                   │   │
│  │     Views: 567 | Likes: 12 | 2025-01-09             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  [Space] Toggle | [Enter] Confirm | [Q] Quit                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Using Claude Code Skill
```
/singularity-select
```

### Output Location
```
data/selected/
├── 123457.json  # Selected post
└── ...
```

## Step 3: Verification

### Run Verification
```bash
# Verify all selected posts
pnpm verify

# Verify specific post
pnpm verify --id 123457
```

### Using Claude Code Skill
```
/singularity-verify
```

### Verification Process

1. **Claim Extraction**
   - AI identifies factual claims in the post
   - Tags each claim with category (product release, benchmark, pricing, etc.)

2. **Web Search**
   - Search for each claim using multiple queries
   - Prioritize official sources (company blogs, press releases)

3. **Source Comparison**
   - Compare claim with found sources
   - Calculate confidence score

4. **Report Generation**
   - Generate detailed verification report
   - Flag unverified or disputed claims

### Verification Report Schema
```json
{
  "postId": "123457",
  "verifiedAt": "2025-01-10T10:30:00Z",
  "claims": [
    {
      "id": "claim_1",
      "originalText": "Claude 3.5 Opus achieved 92% on MMLU",
      "verified": true,
      "confidence": 0.95,
      "sources": [
        {
          "url": "https://anthropic.com/...",
          "title": "Anthropic Blog",
          "relevance": 0.98
        }
      ],
      "correctedText": null
    },
    {
      "id": "claim_2",
      "originalText": "Released on January 5, 2025",
      "verified": false,
      "confidence": 0.2,
      "sources": [],
      "correctedText": "Actual release date was January 8, 2025"
    }
  ],
  "overallScore": 0.85,
  "recommendation": "publish_with_corrections"
}
```

### Output Location
```
data/verified/
├── 123457.json
└── ...
```

## Step 4: Translation

### Run Translation
```bash
# Translate all verified posts
pnpm translate

# Translate specific post
pnpm translate --id 123457
```

### Using Claude Code Skill
```
/singularity-translate
```

### Translation Process

1. **Pre-processing**
   - Extract code blocks (preserve as-is)
   - Identify technical terms
   - Mark URLs and links

2. **Translation**
   - Translate main content using Claude
   - Apply glossary for consistent terms
   - Preserve formatting

3. **Post-processing**
   - Restore code blocks
   - Validate links
   - Generate metadata

### Translation Guidelines
- Technical terms: Use standard English equivalents
- Product names: Keep original (GPT-4, Claude, etc.)
- Cultural references: Add brief explanations if needed
- Informal language: Adapt to professional tone

## Step 5: Publishing

### Generate Blog Posts
```bash
# Generate MDX files for all translated posts
pnpm generate-post

# Generate specific post
pnpm generate-post --id 123457
```

### Using Claude Code Skill
```
/singularity-publish
```

### Generated MDX Structure
```mdx
---
title: "Claude 3.5 Opus Benchmark Analysis"
titleKo: "Claude 3.5 Opus 벤치마크 분석"
date: 2025-01-10
author: "Singularity Blog"
tags: ["claude", "benchmark", "ai"]
sourceUrl: "https://gall.dcinside.com/..."
verificationScore: 0.85
---

# Claude 3.5 Opus Benchmark Analysis

Content here...

## Verification Notes

- Claim about MMLU score: ✅ Verified
- Claim about release date: ⚠️ Corrected (actual: Jan 8)

## Sources

- [Anthropic Blog](https://anthropic.com/...)
```

### Output Location
```
apps/web/content/posts/
├── en/
│   └── claude-35-opus-benchmark.mdx
└── ko/
    └── claude-35-opus-benchmark.mdx
```

## Step 6: Preview & Deploy

### Local Preview
```bash
# Start development server
pnpm dev

# Open http://localhost:3000
```

### Deploy
```bash
# Push to main branch
git add .
git commit -m "Add new post: Claude 3.5 Opus Benchmark"
git push

# Vercel automatically deploys
```

## Automation Options

### GitHub Actions
```yaml
# .github/workflows/crawl.yml
name: Manual Crawl
on:
  workflow_dispatch:
jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm crawl
      - run: git add data/raw && git commit -m "Daily crawl" && git push
```

### Manual Triggers
All steps can be triggered manually via:
- CLI commands
- Claude Code skills
- GitHub Actions workflow_dispatch
