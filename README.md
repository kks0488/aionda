# Singularity Blog

A global tech blog that curates, verifies, and publishes AI/technology information from the Korean "Singularity is Coming" (특이점이 온다) community.

## Overview

This project automatically crawls posts from DC Inside's "thesingularity" gallery, verifies the information using AI and web search, translates content to English, and publishes it as a multilingual tech blog.

## Features

- **Automated Crawling**: Periodic collection of posts from DC Inside gallery
- **Manual Curation**: CLI tool for selecting noteworthy posts
- **AI Verification**: Fact-checking using Claude API + web search
- **Translation**: Korean → English translation with technical term consistency
- **Multilingual Blog**: English (primary) + Korean (secondary)
- **OG Image Generation**: Automatic thumbnail generation with Satori

## Tech Stack

| Category | Primary | Alternative |
|----------|---------|-------------|
| **Framework** | Next.js 14 (App Router) | Astro |
| **Language** | TypeScript | - |
| **Content** | Contentlayer | Velite, MDX+gray-matter |
| **i18n** | next-intl | Paraglide |
| **Styling** | Tailwind CSS + Typography | - |
| **Crawling** | Cheerio (static) | Playwright (dynamic) |
| **AI** | Claude API (Anthropic) | - |
| **Validation** | Zod | - |
| **OG Image** | @vercel/og (Satori) | - |
| **Package** | pnpm | - |
| **Deployment** | Vercel | - |

> 상세한 기술 스택 비교 및 선택 가이드: [TECH_STACK.md](./docs/TECH_STACK.md)

## Project Structure

```
singularity-blog/
├── apps/web/              # Next.js blog site
├── packages/crawler/      # Crawling module
├── scripts/               # CLI tools
├── data/                  # Crawled & processed data
└── docs/                  # Documentation
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Crawl new posts
pnpm crawl

# Select posts for publishing
pnpm select

# Verify selected posts
pnpm verify

# Generate blog posts
pnpm generate-post
```

## Documentation

- [Tech Stack](./docs/TECH_STACK.md) - Technology choices & alternatives
- [Architecture](./docs/ARCHITECTURE.md) - System architecture overview
- [Workflow](./docs/WORKFLOW.md) - Content pipeline workflow
- [Skills](./docs/SKILLS.md) - Claude Code skills usage
- [Subagents](./docs/SUBAGENTS.md) - Custom subagent descriptions
- [MCP Setup](./docs/MCP-SETUP.md) - MCP server configuration
- [Crawling](./docs/CRAWLING.md) - Crawling logic details
- [Verification](./docs/VERIFICATION.md) - Fact-checking process
- [Translation](./docs/TRANSLATION.md) - Translation guidelines
- [Deployment](./docs/DEPLOYMENT.md) - Deployment guide

## Claude Code Integration

This project includes custom Claude Code integrations:

### Skills (Slash Commands)
- `/singularity-crawl` - Execute gallery crawling
- `/singularity-select` - Post selection interface
- `/singularity-verify` - Run AI verification
- `/singularity-translate` - Execute translation
- `/singularity-publish` - Publish posts

### Subagents
- `singularity-crawler` - Crawling specialist
- `singularity-verifier` - Fact-checking specialist
- `singularity-translator` - Translation specialist

## License

Private project - All rights reserved
