# Claude Code Skills

This document describes the custom Claude Code skills available for this project.

## Overview

Skills are slash commands that trigger predefined prompts in Claude Code. They streamline common operations in the content pipeline.

## Installation

Skills are defined in `~/.claude/skills/` directory:

```bash
# Copy skills to Claude config
cp -r .claude/skills/* ~/.claude/skills/
```

Or add to project-level `.claude/skills/`:
```
singularity-blog/.claude/skills/
├── singularity-crawl.md
├── singularity-select.md
├── singularity-verify.md
├── singularity-translate.md
└── singularity-publish.md
```

---

## Skill: /singularity-crawl

**Purpose:** Execute gallery crawling to collect new posts

### Usage
```
/singularity-crawl
/singularity-crawl pages=1-5
/singularity-crawl category=정보/뉴스
```

### Skill Definition
```markdown
# singularity-crawl.md

---
name: singularity-crawl
description: Crawl posts from DC Inside Singularity gallery
---

## Task
Crawl the latest posts from DC Inside "thesingularity" gallery.

## Instructions
1. Use WebFetch to access https://gall.dcinside.com/mgallery/board/lists?id=thesingularity
2. Parse the post list to extract: id, title, author, date, category, views, likes
3. For each new post (not in data/raw/), fetch the full content
4. Save each post as JSON in data/raw/{postId}.json

## Parameters
- pages: Page range to crawl (default: 1)
- category: Filter by category (optional)

## Output
Report number of new posts crawled and saved.
```

### What It Does
1. Fetches gallery listing page(s)
2. Extracts post metadata
3. Fetches full content for new posts
4. Saves structured JSON to `data/raw/`

---

## Skill: /singularity-select

**Purpose:** Interactive post selection interface

### Usage
```
/singularity-select
/singularity-select filter=정보/뉴스
```

### Skill Definition
```markdown
# singularity-select.md

---
name: singularity-select
description: Select posts for blog publication
---

## Task
Present available posts for selection and move selected ones to data/selected/.

## Instructions
1. Read all JSON files in data/raw/
2. Display posts in a formatted list with: title, category, views, likes, date
3. Use AskUserQuestion to let user select posts
4. Move selected posts to data/selected/

## Parameters
- filter: Category filter (optional)
- sort: Sort by "date", "views", or "likes" (default: date)

## Output
List of selected posts moved to data/selected/.
```

### What It Does
1. Lists available posts from `data/raw/`
2. Presents selection interface
3. Moves chosen posts to `data/selected/`

---

## Skill: /singularity-verify

**Purpose:** Run AI-powered fact-checking on selected posts

### Usage
```
/singularity-verify
/singularity-verify id=123456
```

### Skill Definition
```markdown
# singularity-verify.md

---
name: singularity-verify
description: Verify facts in selected posts using AI and web search
---

## Task
Fact-check claims in selected posts and generate verification reports.

## Instructions
1. Read posts from data/selected/
2. For each post:
   a. Extract factual claims from content
   b. Use WebSearch to find sources for each claim
   c. Compare claims with authoritative sources
   d. Calculate confidence score
3. Generate verification report
4. Save to data/verified/{postId}.json

## Parameters
- id: Specific post ID to verify (optional, defaults to all)

## Output
Verification report with:
- List of claims and their verification status
- Source URLs
- Overall confidence score
- Recommendation (publish/revise/reject)
```

### What It Does
1. Extracts claims from post content
2. Searches web for verification
3. Compares with official sources
4. Generates verification report

---

## Skill: /singularity-translate

**Purpose:** Translate verified posts from Korean to English

### Usage
```
/singularity-translate
/singularity-translate id=123456
```

### Skill Definition
```markdown
# singularity-translate.md

---
name: singularity-translate
description: Translate verified posts to English
---

## Task
Translate Korean posts to English while maintaining technical accuracy.

## Instructions
1. Read posts from data/verified/
2. For each post:
   a. Preserve code blocks, URLs, and product names
   b. Translate title and content to English
   c. Apply technical term glossary
   d. Maintain professional tone
3. Save translated content alongside original

## Glossary
- 특이점 → Singularity
- 언어모델 → Language Model
- 벤치마크 → Benchmark
- 출시 → Release
- 성능 → Performance

## Parameters
- id: Specific post ID to translate (optional)

## Output
Translated post data with both Korean and English versions.
```

### What It Does
1. Reads verified posts
2. Translates content maintaining technical accuracy
3. Preserves code and links
4. Applies consistent terminology

---

## Skill: /singularity-publish

**Purpose:** Generate and publish MDX blog posts

### Usage
```
/singularity-publish
/singularity-publish id=123456
```

### Skill Definition
```markdown
# singularity-publish.md

---
name: singularity-publish
description: Generate MDX posts and prepare for deployment
---

## Task
Generate MDX files from translated posts and prepare for blog publication.

## Instructions
1. Read translated posts from data/verified/
2. For each post:
   a. Generate slug from English title
   b. Create MDX frontmatter (title, date, tags, etc.)
   c. Format content with verification notes
   d. Generate OG image metadata
3. Save to apps/web/content/posts/en/ and /ko/
4. Report generated files

## Parameters
- id: Specific post ID to publish (optional)

## Output
List of generated MDX files ready for deployment.
```

### What It Does
1. Generates MDX from translated content
2. Creates proper frontmatter
3. Adds verification notes
4. Saves to content directory

---

## Skill Configuration

### Project-Level Settings (`.claude/settings.json`)
```json
{
  "skills": {
    "enabled": true,
    "directory": ".claude/skills"
  }
}
```

### Skill File Format
```markdown
# skill-name.md

---
name: skill-name
description: Brief description
---

## Task
What this skill accomplishes

## Instructions
Step-by-step instructions for Claude

## Parameters
Available parameters

## Output
Expected output format
```

---

## Best Practices

1. **Run in Order**: Crawl → Select → Verify → Translate → Publish
2. **Review Verification**: Always check verification reports before publishing
3. **Preview Locally**: Use `pnpm dev` to preview before deploying
4. **Batch Processing**: Skills process all eligible posts by default
5. **Single Post**: Use `id=` parameter for specific posts
