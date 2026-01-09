# Custom Subagents

This document describes the custom subagents configured for the Singularity Blog project.

## Overview

Subagents are specialized Claude Code agents optimized for specific tasks. They have access to specific tools and follow predefined instructions for their domain.

## Configuration

Subagents are defined in `.claude/settings.json`:

```json
{
  "subagents": {
    "singularity-crawler": {
      "description": "Specialized agent for crawling DC Inside gallery",
      "tools": ["WebFetch", "Bash", "Write", "Read"],
      "instructions": "..."
    },
    "singularity-verifier": {
      "description": "Fact-checking specialist using AI and web search",
      "tools": ["WebSearch", "WebFetch", "Read", "Write"],
      "instructions": "..."
    },
    "singularity-translator": {
      "description": "Korean to English translation specialist",
      "tools": ["Read", "Write", "Edit"],
      "instructions": "..."
    }
  }
}
```

---

## Subagent: singularity-crawler

### Purpose
Specialized for crawling posts from DC Inside "thesingularity" gallery.

### Available Tools
| Tool | Usage |
|------|-------|
| WebFetch | Fetch gallery pages and post content |
| Bash | Run helper scripts, file operations |
| Write | Save crawled data as JSON |
| Read | Check existing data, avoid duplicates |

### Instructions
```
You are a web crawling specialist for DC Inside gallery.

Target: https://gall.dcinside.com/mgallery/board/lists?id=thesingularity

Tasks:
1. Fetch the gallery listing page
2. Parse HTML to extract post list
3. For each post, extract:
   - Post ID (from URL)
   - Title
   - Author (nickname)
   - Date/time
   - Category (말머리)
   - View count
   - Like count
   - Comment count
4. Fetch individual post pages for full content
5. Extract post body, images, and embedded content
6. Save as structured JSON to data/raw/{postId}.json

Important:
- Check data/raw/ first to avoid re-crawling existing posts
- Respect rate limits (1 request per second)
- Handle pagination for multi-page crawls
- Preserve Korean text encoding (UTF-8)
```

### Usage
```
The Task tool will automatically use this subagent when:
- User requests gallery crawling
- /singularity-crawl skill is invoked
- Crawling-related tasks are detected
```

### Example Output
```json
{
  "id": "123456",
  "title": "GPT-5 출시 예정 소식",
  "author": "닉네임",
  "authorId": "user123",
  "date": "2025-01-10T03:55:00+09:00",
  "category": "정보/뉴스",
  "content": "<p>본문 내용...</p>",
  "contentText": "본문 내용...",
  "images": [
    {
      "url": "https://...",
      "localPath": "data/images/123456_1.jpg"
    }
  ],
  "views": 1234,
  "likes": 56,
  "comments": 12,
  "url": "https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=123456",
  "crawledAt": "2025-01-10T10:30:00Z"
}
```

---

## Subagent: singularity-verifier

### Purpose
Fact-checking specialist that verifies claims using AI reasoning and web search.

### Available Tools
| Tool | Usage |
|------|-------|
| WebSearch | Search for sources to verify claims |
| WebFetch | Fetch and analyze source pages |
| Read | Read post data to verify |
| Write | Save verification reports |

### Instructions
```
You are a fact-checking specialist for AI/technology content.

Tasks:
1. Read post content from data/selected/
2. Identify factual claims in the content:
   - Product announcements
   - Release dates
   - Benchmark scores
   - Pricing information
   - Technical specifications
   - Company statements
3. For each claim:
   a. Formulate search queries
   b. Use WebSearch to find sources
   c. Prioritize official sources:
      - Company blogs (openai.com, anthropic.com, etc.)
      - Press releases
      - Official documentation
   d. Compare claim with sources
   e. Assign confidence score (0-1)
4. Generate verification report

Scoring Guidelines:
- 0.9-1.0: Fully verified with official source
- 0.7-0.9: Verified with reliable secondary sources
- 0.5-0.7: Partially verified, some details unconfirmed
- 0.3-0.5: Conflicting information found
- 0.0-0.3: Cannot verify or contradicted by sources

Recommendation Logic:
- overallScore >= 0.7: "publish"
- overallScore >= 0.5: "publish_with_corrections"
- overallScore >= 0.3: "needs_review"
- overallScore < 0.3: "reject"
```

### Usage
```
The Task tool will automatically use this subagent when:
- User requests fact-checking
- /singularity-verify skill is invoked
- Verification-related tasks are detected
```

### Example Output
```json
{
  "postId": "123456",
  "verifiedAt": "2025-01-10T12:00:00Z",
  "claims": [
    {
      "id": "claim_1",
      "text": "OpenAI released GPT-5 on January 8, 2025",
      "type": "release_date",
      "verified": true,
      "confidence": 0.95,
      "sources": [
        {
          "url": "https://openai.com/blog/gpt-5",
          "title": "Introducing GPT-5",
          "snippet": "We're releasing GPT-5 today, January 8, 2025",
          "relevance": 0.98
        }
      ],
      "notes": "Confirmed by official OpenAI blog"
    }
  ],
  "overallScore": 0.85,
  "recommendation": "publish",
  "summary": "3 of 4 claims verified. One claim about pricing needs minor correction."
}
```

---

## Subagent: singularity-translator

### Purpose
Korean to English translation specialist optimized for AI/technology content.

### Available Tools
| Tool | Usage |
|------|-------|
| Read | Read source content |
| Write | Save translated content |
| Edit | Make corrections to translations |

### Instructions
```
You are a professional Korean-English translator specializing in AI and technology content.

Tasks:
1. Read verified post from data/verified/
2. Translate content following guidelines:

Translation Guidelines:
- Maintain technical accuracy
- Use standard English terminology
- Preserve code blocks, URLs, and product names as-is
- Adapt informal Korean to professional English tone
- Add brief context for Korea-specific references

Technical Term Glossary:
- 특이점 → Singularity
- 언어모델/LLM → Language Model/LLM
- 벤치마크 → Benchmark
- 추론 → Inference
- 파인튜닝 → Fine-tuning
- 프롬프트 → Prompt
- 토큰 → Token
- 컨텍스트 → Context
- 할루시네이션 → Hallucination
- 멀티모달 → Multimodal
- 출시 → Release
- 성능 → Performance
- 무료/유료 → Free/Paid
- 구독 → Subscription

Preserve as-is:
- Model names: GPT-4, Claude, Gemini, etc.
- Company names: OpenAI, Anthropic, Google, etc.
- Code snippets and technical commands
- URLs and links
- Numbers and statistics

Output Format:
- title_en: English title
- title_ko: Original Korean title
- content_en: Translated content
- content_ko: Original content
- tags: Extracted tags in English
```

### Usage
```
The Task tool will automatically use this subagent when:
- User requests translation
- /singularity-translate skill is invoked
- Translation-related tasks are detected
```

### Example Output
```json
{
  "postId": "123456",
  "translatedAt": "2025-01-10T14:00:00Z",
  "title_en": "GPT-5 Release Announcement Analysis",
  "title_ko": "GPT-5 출시 소식 분석",
  "content_en": "OpenAI has officially released GPT-5...",
  "content_ko": "OpenAI에서 GPT-5를 공식 출시했습니다...",
  "tags": ["gpt-5", "openai", "release", "ai"],
  "glossaryUsed": ["Language Model", "Benchmark", "Inference"]
}
```

---

## Subagent Selection

Claude Code automatically selects the appropriate subagent based on:

1. **Explicit Skill Invocation**: Skills map directly to subagents
2. **Task Detection**: Keywords in user request trigger specific agents
3. **Context Analysis**: Previous actions inform agent selection

### Keyword Mappings
| Keywords | Subagent |
|----------|----------|
| crawl, fetch, scrape, collect | singularity-crawler |
| verify, fact-check, sources, confirm | singularity-verifier |
| translate, English, 번역 | singularity-translator |

---

## Best Practices

1. **Let Claude Choose**: Usually Claude will select the right subagent automatically
2. **Chain Agents**: Run crawler → verifier → translator in sequence
3. **Review Outputs**: Always review verification and translation results
4. **Provide Context**: When manually invoking, provide relevant context
5. **Handle Errors**: Agents will report issues; address them before continuing
