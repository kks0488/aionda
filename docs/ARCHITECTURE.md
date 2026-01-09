# System Architecture

## Overview

The Singularity Blog system consists of five main components that work together to transform raw community posts into verified, multilingual blog content.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SINGULARITY BLOG                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ Crawler  │───▶│ Selector │───▶│ Verifier │───▶│Translator│      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│       │               │               │               │             │
│       ▼               ▼               ▼               ▼             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ data/raw │    │data/sel. │    │data/ver. │    │ content/ │      │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘      │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Next.js Blog (apps/web)                   │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │   │
│  │  │   /en   │  │   /ko   │  │  /api   │  │   OG    │        │   │
│  │  │  pages  │  │  pages  │  │  routes │  │  Image  │        │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Crawler (`packages/crawler`)

Responsible for fetching posts from DC Inside gallery.

```
packages/crawler/
├── src/
│   ├── fetcher.ts     # HTTP requests to gallery
│   ├── parser.ts      # HTML parsing logic
│   ├── selector.ts    # CLI for post selection
│   └── index.ts       # Main exports
├── package.json
└── tsconfig.json
```

**Key Functions:**
- `fetchPostList(page: number)` - Get list of posts from a page
- `fetchPostDetail(postId: string)` - Get full post content
- `parsePost(html: string)` - Extract structured data from HTML

### 2. Selector (CLI Tool)

Interactive CLI for manual post curation.

```
$ pnpm select

┌─────────────────────────────────────────┐
│  Post Selection Interface                │
├─────────────────────────────────────────┤
│  [x] GPT-5 rumors analysis              │
│  [ ] Random meme post                   │
│  [x] New Claude features discussion     │
│  [ ] Off-topic post                     │
└─────────────────────────────────────────┘
```

### 3. Verifier (`scripts/verify.ts`)

AI-powered fact-checking module.

**Process:**
1. Extract claims from post content
2. Search web for each claim
3. Compare with authoritative sources
4. Generate verification report

**Output:**
```json
{
  "postId": "12345",
  "claims": [
    {
      "text": "GPT-5 will be released in Q1 2025",
      "verified": false,
      "sources": ["openai.com/blog/..."],
      "confidence": 0.3
    }
  ],
  "overallScore": 0.7
}
```

### 4. Translator (`scripts/translate.ts`)

Korean to English translation pipeline.

**Features:**
- Technical term glossary for consistency
- Context-aware translation
- Preserves code blocks and links
- Maintains formatting

### 5. Blog Site (`apps/web`)

Next.js 14 application with App Router.

```
apps/web/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Post list
│   │   └── posts/
│   │       └── [slug]/
│   │           └── page.tsx   # Post detail
│   ├── api/
│   │   └── og/
│   │       └── route.tsx      # OG image generation
│   └── layout.tsx
├── content/
│   └── posts/
│       ├── en/                # English posts
│       └── ko/                # Korean posts
├── components/
│   ├── PostCard.tsx
│   ├── PostContent.tsx
│   └── LanguageSwitcher.tsx
└── lib/
    ├── mdx.ts                 # MDX processing
    └── i18n.ts                # Internationalization
```

## Data Flow

### 1. Crawling Phase
```
DC Inside Gallery
      │
      ▼
  Fetcher (HTTP GET)
      │
      ▼
  Parser (HTML → JSON)
      │
      ▼
  data/raw/{postId}.json
```

### 2. Selection Phase
```
data/raw/*
      │
      ▼
  CLI Interface
      │
      ▼
  data/selected/{postId}.json
```

### 3. Verification Phase
```
data/selected/*
      │
      ▼
  Claim Extraction (Claude)
      │
      ▼
  Web Search (WebSearch API)
      │
      ▼
  Verification Report
      │
      ▼
  data/verified/{postId}.json
```

### 4. Translation & Publishing Phase
```
data/verified/*
      │
      ▼
  Translation (Claude)
      │
      ▼
  MDX Generation
      │
      ▼
  content/posts/en/{slug}.mdx
  content/posts/ko/{slug}.mdx
```

## Technology Decisions

### Why Next.js 14?
- App Router provides clean routing structure
- Built-in i18n support
- Excellent Vercel integration
- OG image generation with @vercel/og

### Why MDX?
- Markdown simplicity for content
- React components for rich content
- Easy version control with Git

### Why Playwright over Cheerio?
- DC Inside may require JavaScript rendering
- Better handling of dynamic content
- Built-in browser context management

### Why Claude API for Verification?
- Superior reasoning for fact-checking
- Web search integration capability
- Consistent translation quality

## Security Considerations

- Rate limiting on crawler to avoid IP blocks
- No storage of sensitive user data
- Environment variables for API keys
- CORS configuration for API routes

## Performance Optimization

- Static site generation for blog pages
- Incremental static regeneration
- Image optimization with Next.js Image
- CDN caching via Vercel Edge Network
