# Singularity Blog - Claude Code Context

## Project Overview

This is a tech blog that curates AI/technology content from the Korean DC Inside "thesingularity" gallery, verifies information, translates to English, and publishes globally.

## Key Directories

```
/home/kkaemo/projects/singularity-blog/
├── apps/web/           # Next.js 14 blog site
├── packages/crawler/   # Crawling module
├── scripts/            # CLI tools (crawl, verify, translate)
├── data/
│   ├── raw/            # Crawled posts (JSON)
│   ├── selected/       # Curated posts
│   └── verified/       # Fact-checked posts
├── docs/               # Documentation
└── specs/              # Technical specifications
```

## Common Tasks

### Crawling
```bash
pnpm crawl              # Crawl latest posts
pnpm crawl --pages=5    # Crawl 5 pages
```
Or use: `/singularity-crawl`

### Selection
```bash
pnpm select             # Interactive post selection
```
Or use: `/singularity-select`

### Verification
```bash
pnpm verify             # Verify selected posts
pnpm verify --id=123    # Verify specific post
```
Or use: `/singularity-verify`

### Translation
```bash
pnpm translate          # Translate verified posts
```
Or use: `/singularity-translate`

### Publishing
```bash
pnpm generate-post      # Generate MDX files
pnpm dev                # Preview locally
git push                # Deploy to Vercel
```
Or use: `/singularity-publish`

## Data Schemas

### Raw Post (`data/raw/*.json`)
```json
{
  "id": "123456",
  "title": "Post title",
  "category": "정보/뉴스",
  "author": "nickname",
  "date": "2025.01.10",
  "content": "<html>",
  "contentText": "plain text",
  "views": 1234,
  "likes": 56,
  "url": "https://..."
}
```

### Verified Post (`data/verified/*.json`)
```json
{
  "postId": "123456",
  "claims": [...],
  "overallScore": 0.85,
  "recommendation": "publish",
  "title_en": "English title",
  "content_en": "Translated content"
}
```

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Content**: MDX with next-mdx-remote
- **i18n**: next-intl (English primary, Korean secondary)
- **Styling**: Tailwind CSS
- **Crawling**: Cheerio (static) / Playwright (dynamic)
- **AI**: Claude API
- **Deployment**: Vercel

## Important Notes

1. **Rate Limiting**: Always use 1-second delay between requests when crawling
2. **Verification**: Check official sources first (company blogs, docs)
3. **Translation**: Preserve code blocks, URLs, product names
4. **i18n**: English is primary language, Korean is secondary

## Subagents Available

- `singularity-crawler`: Crawling specialist
- `singularity-verifier`: Fact-checking specialist
- `singularity-translator`: Translation specialist

## MCP Servers

- `puppeteer`: For dynamic page crawling
- `filesystem`: Enhanced file operations

## Relevant Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [Workflow](./docs/WORKFLOW.md)
- [Crawling](./docs/CRAWLING.md)
- [Verification](./docs/VERIFICATION.md)
- [Translation](./docs/TRANSLATION.md)
