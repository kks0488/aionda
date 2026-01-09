# Data Schema Specification

This document defines the data structures used throughout the Singularity Blog pipeline.

## Overview

Data flows through the following stages:
```
Raw → Selected → Verified → Published
```

Each stage has a corresponding JSON schema.

---

## 1. Raw Post Schema

**Location**: `data/raw/{postId}.json`

**Description**: Crawled post data from DC Inside gallery

### Schema

```typescript
interface RawPost {
  // Identification
  id: string;                    // Post ID from DC Inside
  url: string;                   // Full URL to original post

  // Metadata
  title: string;                 // Post title (Korean)
  category: string;              // Category label (e.g., "정보/뉴스", "AI활용")
  author: string;                // Author nickname
  authorId?: string;             // Author ID if available
  date: string;                  // Original date string from site
  dateISO?: string;              // Parsed ISO 8601 date

  // Content
  content: string;               // HTML content
  contentText: string;           // Plain text content (stripped HTML)

  // Media
  images: ImageRef[];            // Embedded images

  // Engagement
  views: number;                 // View count
  likes: number;                 // Like/recommend count
  comments: number;              // Comment count

  // System
  crawledAt: string;             // ISO 8601 timestamp when crawled
  crawlerVersion?: string;       // Version of crawler used
}

interface ImageRef {
  url: string;                   // Original image URL
  localPath?: string;            // Downloaded local path
  alt?: string;                  // Alt text if available
}
```

### Example

```json
{
  "id": "123456",
  "url": "https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=123456",
  "title": "GPT-5 성능 분석",
  "category": "정보/뉴스",
  "author": "AI연구자",
  "authorId": "researcher123",
  "date": "2025.01.10 03:55",
  "dateISO": "2025-01-10T03:55:00+09:00",
  "content": "<p>오늘 발표된 GPT-5의...</p>",
  "contentText": "오늘 발표된 GPT-5의...",
  "images": [
    {
      "url": "https://dcimg.dcinside.com/...",
      "localPath": "data/images/123456_1.jpg",
      "alt": "benchmark chart"
    }
  ],
  "views": 2345,
  "likes": 89,
  "comments": 23,
  "crawledAt": "2025-01-10T10:30:00.000Z",
  "crawlerVersion": "1.0.0"
}
```

---

## 2. Selected Post Schema

**Location**: `data/selected/{postId}.json`

**Description**: Curated posts approved for processing

### Schema

```typescript
interface SelectedPost extends RawPost {
  // Selection metadata
  selectedAt: string;            // ISO 8601 timestamp when selected
  selectedBy: string;            // Who selected (user/auto)
  selectionReason?: string;      // Why this post was selected

  // Priority
  priority: 'high' | 'medium' | 'low';

  // Tags (preliminary)
  suggestedTags: string[];
}
```

### Example

```json
{
  "id": "123456",
  "title": "GPT-5 성능 분석",
  "...": "...inherited from RawPost...",
  "selectedAt": "2025-01-10T11:00:00.000Z",
  "selectedBy": "manual",
  "selectionReason": "Detailed benchmark analysis with sources",
  "priority": "high",
  "suggestedTags": ["gpt-5", "benchmark", "openai"]
}
```

---

## 3. Verified Post Schema

**Location**: `data/verified/{postId}.json`

**Description**: Fact-checked posts with verification reports

### Schema

```typescript
interface VerifiedPost extends SelectedPost {
  // Verification metadata
  verifiedAt: string;            // ISO 8601 timestamp
  verificationDuration: number;  // Time taken in ms

  // Claims and verification
  claims: Claim[];

  // Summary
  summary: VerificationSummary;

  // Recommendation
  recommendation: 'publish' | 'publish_with_corrections' | 'needs_review' | 'reject';

  // Suggested edits
  suggestedEdits: SuggestedEdit[];

  // Translation (if completed)
  translation?: Translation;
}

interface Claim {
  id: string;                    // Unique claim ID
  originalText: string;          // Original claim text (Korean)
  type: ClaimType;               // Type of claim
  verified: boolean;             // Whether claim is verified
  confidence: number;            // 0-1 confidence score
  sources: Source[];             // Supporting/contradicting sources
  correctedText?: string;        // Corrected version if needed
  notes: string;                 // Verification notes
}

type ClaimType =
  | 'release_date'
  | 'benchmark'
  | 'pricing'
  | 'feature'
  | 'company_statement'
  | 'comparison'
  | 'technical_spec';

interface Source {
  url: string;                   // Source URL
  title: string;                 // Page title
  snippet: string;               // Relevant text snippet
  relevance: number;             // 0-1 relevance score
  publishDate?: string;          // Publication date if available
  sourceType: SourceType;        // Type of source
}

type SourceType =
  | 'official_blog'
  | 'documentation'
  | 'press_release'
  | 'tech_news'
  | 'research_paper'
  | 'general_news'
  | 'community';

interface VerificationSummary {
  totalClaims: number;
  verifiedClaims: number;
  unverifiedClaims: number;
  overallScore: number;          // 0-1 weighted score
}

interface SuggestedEdit {
  original: string;              // Original text
  suggested: string;             // Suggested replacement
  reason: string;                // Why this edit is suggested
}

interface Translation {
  title_en: string;              // English title
  title_ko: string;              // Korean title (original)
  content_en: string;            // English content
  content_ko: string;            // Korean content (original)
  translatedAt: string;          // ISO 8601 timestamp
  glossaryUsed: string[];        // Technical terms from glossary
}
```

### Example

```json
{
  "id": "123456",
  "...": "...inherited from SelectedPost...",
  "verifiedAt": "2025-01-10T12:00:00.000Z",
  "verificationDuration": 45000,
  "claims": [
    {
      "id": "claim_1",
      "originalText": "GPT-5가 MMLU에서 97.3%를 달성",
      "type": "benchmark",
      "verified": true,
      "confidence": 0.92,
      "sources": [
        {
          "url": "https://openai.com/blog/gpt-5",
          "title": "Introducing GPT-5",
          "snippet": "GPT-5 achieves 97.3% on MMLU benchmark",
          "relevance": 0.98,
          "publishDate": "2025-01-08",
          "sourceType": "official_blog"
        }
      ],
      "notes": "Confirmed by official OpenAI blog post"
    }
  ],
  "summary": {
    "totalClaims": 5,
    "verifiedClaims": 4,
    "unverifiedClaims": 1,
    "overallScore": 0.85
  },
  "recommendation": "publish_with_corrections",
  "suggestedEdits": [
    {
      "original": "다음 주 출시 예정",
      "suggested": "출시일 미정 (공식 발표 없음)",
      "reason": "No official release date announced"
    }
  ],
  "translation": {
    "title_en": "GPT-5 Performance Analysis",
    "title_ko": "GPT-5 성능 분석",
    "content_en": "The newly announced GPT-5...",
    "content_ko": "오늘 발표된 GPT-5의...",
    "translatedAt": "2025-01-10T13:00:00.000Z",
    "glossaryUsed": ["benchmark", "language model", "inference"]
  }
}
```

---

## 4. Published Post Schema (MDX Frontmatter)

**Location**: `apps/web/content/posts/{locale}/{slug}.mdx`

**Description**: Final MDX blog post with frontmatter

### Schema

```typescript
interface PostFrontmatter {
  // Required
  title: string;                 // Post title
  slug: string;                  // URL slug
  date: string;                  // Publication date (ISO 8601)
  locale: 'en' | 'ko';           // Content language

  // Metadata
  description: string;           // SEO description
  tags: string[];                // Post tags
  author: string;                // Author name

  // Source
  sourceId: string;              // Original post ID
  sourceUrl: string;             // Original post URL

  // Verification
  verificationScore: number;     // 0-1 score
  verifiedAt: string;            // When verified

  // i18n
  alternateLocale?: string;      // Path to alternate language version

  // SEO
  ogImage?: string;              // OG image path
  canonical?: string;            // Canonical URL

  // Status
  draft?: boolean;               // Is draft (not published)
}
```

### Example MDX

```mdx
---
title: "GPT-5 Performance Analysis"
slug: "gpt-5-performance-analysis"
date: "2025-01-10"
locale: "en"
description: "In-depth analysis of GPT-5's benchmark performance and capabilities"
tags: ["gpt-5", "openai", "benchmark", "ai"]
author: "Singularity Blog"
sourceId: "123456"
sourceUrl: "https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=123456"
verificationScore: 0.85
verifiedAt: "2025-01-10T12:00:00.000Z"
alternateLocale: "/ko/posts/gpt-5-performance-analysis"
ogImage: "/og/gpt-5-performance-analysis.png"
---

# GPT-5 Performance Analysis

The newly announced GPT-5 demonstrates significant improvements...

## Key Benchmarks

| Benchmark | GPT-4 | GPT-5 |
|-----------|-------|-------|
| MMLU      | 86.4% | 97.3% |

## Verification Notes

- ✅ MMLU benchmark score verified via [OpenAI Blog](https://openai.com/blog/gpt-5)
- ⚠️ Release date unconfirmed (original claim corrected)

## Sources

- [OpenAI Official Blog](https://openai.com/blog/gpt-5)
- [TechCrunch Coverage](https://techcrunch.com/...)
```

---

## 5. Configuration Schema

**Location**: `.claude/settings.json`

See [MCP-SETUP.md](./docs/MCP-SETUP.md) for full configuration schema.

---

## Validation

### TypeScript Types

All schemas are available as TypeScript types in:
```
packages/types/src/
├── raw-post.ts
├── selected-post.ts
├── verified-post.ts
├── frontmatter.ts
└── index.ts
```

### JSON Schema Validation

```bash
# Validate a raw post
pnpm validate:raw data/raw/123456.json

# Validate a verified post
pnpm validate:verified data/verified/123456.json
```

### Zod Schema

```typescript
// packages/types/src/schemas.ts
import { z } from 'zod';

export const RawPostSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string().min(1),
  category: z.string(),
  author: z.string(),
  date: z.string(),
  content: z.string(),
  contentText: z.string(),
  images: z.array(z.object({
    url: z.string().url(),
    localPath: z.string().optional(),
    alt: z.string().optional(),
  })),
  views: z.number().int().min(0),
  likes: z.number().int().min(0),
  comments: z.number().int().min(0),
  crawledAt: z.string().datetime(),
});
```
