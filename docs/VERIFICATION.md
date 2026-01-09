# Verification Process

This document describes the AI-powered fact-checking system for verifying claims in crawled posts.

## Overview

The verification system:
1. Extracts factual claims from post content
2. Searches the web for supporting/contradicting evidence
3. Compares claims with authoritative sources
4. Generates a verification report with confidence scores

## Verification Flow

```
┌──────────────┐
│ Post Content │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Claim     │
│  Extraction  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  For Each    │◀────────────────┐
│    Claim     │                 │
└──────┬───────┘                 │
       │                         │
       ▼                         │
┌──────────────┐                 │
│  Web Search  │                 │
└──────┬───────┘                 │
       │                         │
       ▼                         │
┌──────────────┐                 │
│   Compare    │                 │
│  w/ Sources  │                 │
└──────┬───────┘                 │
       │                         │
       ▼                         │
┌──────────────┐    More claims  │
│    Score     │─────────────────┘
│    Claim     │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Generate    │
│   Report     │
└──────────────┘
```

## Claim Types

| Type | Description | Example |
|------|-------------|---------|
| `release_date` | Product/service launch dates | "GPT-5 will release in March 2025" |
| `benchmark` | Performance metrics | "Claude 3.5 scored 92% on MMLU" |
| `pricing` | Cost information | "Pro subscription costs $20/month" |
| `feature` | Product capabilities | "Supports 200K context window" |
| `company_statement` | Official announcements | "Sam Altman confirmed..." |
| `comparison` | Model comparisons | "Faster than GPT-4" |
| `technical_spec` | Technical details | "Uses mixture of experts architecture" |

## Claim Extraction

### Prompt Template

```markdown
Analyze the following Korean tech/AI post and extract all factual claims.

Post Content:
{content}

For each claim, provide:
1. The exact text of the claim (in Korean)
2. Claim type (release_date, benchmark, pricing, feature, company_statement, comparison, technical_spec)
3. Key entities mentioned (company, product, person)
4. Suggested search queries to verify this claim

Format as JSON array:
[
  {
    "text": "claim text in Korean",
    "type": "claim_type",
    "entities": ["entity1", "entity2"],
    "searchQueries": ["query1", "query2"]
  }
]
```

### Example Extraction

**Input Post**:
```
OpenAI에서 GPT-5를 2025년 3월에 출시한다고 발표했습니다.
벤치마크에서 기존 GPT-4보다 30% 향상된 성능을 보여줬습니다.
```

**Extracted Claims**:
```json
[
  {
    "text": "OpenAI에서 GPT-5를 2025년 3월에 출시한다고 발표",
    "type": "release_date",
    "entities": ["OpenAI", "GPT-5"],
    "searchQueries": [
      "GPT-5 release date 2025",
      "OpenAI GPT-5 announcement",
      "site:openai.com GPT-5"
    ]
  },
  {
    "text": "벤치마크에서 기존 GPT-4보다 30% 향상된 성능",
    "type": "benchmark",
    "entities": ["GPT-5", "GPT-4"],
    "searchQueries": [
      "GPT-5 benchmark GPT-4 comparison",
      "GPT-5 performance improvement"
    ]
  }
]
```

## Web Search Strategy

### Search Query Formulation

```typescript
function generateSearchQueries(claim: Claim): string[] {
  const queries: string[] = [];

  // Official source search
  if (claim.entities.includes('OpenAI')) {
    queries.push(`site:openai.com ${claim.entities.join(' ')}`);
  }
  if (claim.entities.includes('Anthropic')) {
    queries.push(`site:anthropic.com ${claim.entities.join(' ')}`);
  }

  // General search
  queries.push(`${claim.entities.join(' ')} ${claim.type.replace('_', ' ')}`);

  // News search
  queries.push(`${claim.entities[0]} news ${new Date().getFullYear()}`);

  return queries;
}
```

### Source Priority

| Priority | Source Type | Examples | Weight |
|----------|-------------|----------|--------|
| 1 (Highest) | Official company blogs | openai.com/blog, anthropic.com | 1.0 |
| 2 | Official documentation | docs.anthropic.com | 0.95 |
| 3 | Press releases | businesswire, prnewswire | 0.85 |
| 4 | Major tech news | techcrunch, theverge, arstechnica | 0.75 |
| 5 | Research papers | arxiv.org | 0.80 |
| 6 | General news | reuters, bloomberg | 0.70 |
| 7 | Community/forums | reddit, hackernews | 0.50 |

## Verification Logic

### Comparison Algorithm

```typescript
interface VerificationResult {
  verified: boolean;
  confidence: number;
  sources: Source[];
  correctedText?: string;
  notes: string;
}

async function verifyClaim(claim: Claim): Promise<VerificationResult> {
  const searchResults = await searchWeb(claim.searchQueries);
  const relevantSources = filterRelevantSources(searchResults, claim);

  // No sources found
  if (relevantSources.length === 0) {
    return {
      verified: false,
      confidence: 0.2,
      sources: [],
      notes: 'No sources found to verify this claim'
    };
  }

  // Analyze each source
  const analyses = await Promise.all(
    relevantSources.map(source => analyzeSource(source, claim))
  );

  // Calculate weighted score
  const weightedScore = analyses.reduce((sum, a) =>
    sum + (a.supports ? a.sourceWeight : -a.sourceWeight), 0
  ) / analyses.length;

  // Check for contradictions
  const hasContradiction = analyses.some(a => a.contradicts);

  return {
    verified: weightedScore > 0.5 && !hasContradiction,
    confidence: Math.abs(weightedScore),
    sources: relevantSources,
    correctedText: hasContradiction ? findCorrection(analyses) : undefined,
    notes: generateNotes(analyses)
  };
}
```

### Scoring Guidelines

| Score Range | Interpretation | Action |
|-------------|----------------|--------|
| 0.9 - 1.0 | Fully verified by official source | Publish as-is |
| 0.7 - 0.9 | Verified by reliable sources | Publish with sources |
| 0.5 - 0.7 | Partially verified | Publish with caveats |
| 0.3 - 0.5 | Uncertain/conflicting | Flag for manual review |
| 0.0 - 0.3 | Cannot verify or contradicted | Correct or remove |

## Verification Report

### Report Schema

```json
{
  "postId": "123456",
  "postTitle": "Original post title",
  "verifiedAt": "2025-01-10T12:00:00Z",
  "claims": [
    {
      "id": "claim_1",
      "originalText": "OpenAI에서 GPT-5를 2025년 3월에 출시",
      "type": "release_date",
      "verified": false,
      "confidence": 0.3,
      "sources": [
        {
          "url": "https://openai.com/blog/...",
          "title": "OpenAI Blog Post",
          "snippet": "We have not announced...",
          "relevance": 0.85,
          "publishDate": "2025-01-05"
        }
      ],
      "correctedText": "No official release date announced yet",
      "notes": "OpenAI has not officially announced GPT-5 release date"
    },
    {
      "id": "claim_2",
      "originalText": "기존 GPT-4보다 30% 향상된 성능",
      "type": "benchmark",
      "verified": true,
      "confidence": 0.85,
      "sources": [
        {
          "url": "https://techcrunch.com/...",
          "title": "GPT-5 Benchmarks",
          "snippet": "shows 28-32% improvement...",
          "relevance": 0.90
        }
      ],
      "notes": "Multiple sources confirm ~30% improvement"
    }
  ],
  "summary": {
    "totalClaims": 2,
    "verifiedClaims": 1,
    "unverifiedClaims": 1,
    "overallScore": 0.575
  },
  "recommendation": "publish_with_corrections",
  "suggestedEdits": [
    {
      "original": "2025년 3월에 출시",
      "suggested": "출시 예정 (공식 일정 미확인)"
    }
  ]
}
```

### Recommendation Logic

```typescript
function getRecommendation(score: number, claims: Claim[]): string {
  const hasUnverifiedCritical = claims.some(
    c => !c.verified && ['release_date', 'pricing', 'company_statement'].includes(c.type)
  );

  if (score >= 0.8 && !hasUnverifiedCritical) {
    return 'publish';
  } else if (score >= 0.5) {
    return 'publish_with_corrections';
  } else if (score >= 0.3) {
    return 'needs_review';
  } else {
    return 'reject';
  }
}
```

## Implementation

### Verify Script

```typescript
// scripts/verify.ts

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const client = new Anthropic();
const SELECTED_DIR = './data/selected';
const VERIFIED_DIR = './data/verified';

async function verifyPost(postPath: string) {
  const post = JSON.parse(readFileSync(postPath, 'utf-8'));

  // Extract claims
  const claims = await extractClaims(post.contentText);

  // Verify each claim
  const verifiedClaims = await Promise.all(
    claims.map(claim => verifyClaim(claim))
  );

  // Generate report
  const report = generateReport(post, verifiedClaims);

  // Save verified post
  const outputPath = join(VERIFIED_DIR, `${post.id}.json`);
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  return report;
}

async function main() {
  const files = readdirSync(SELECTED_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    console.log(`Verifying: ${file}`);
    const report = await verifyPost(join(SELECTED_DIR, file));
    console.log(`  Score: ${report.summary.overallScore}`);
    console.log(`  Recommendation: ${report.recommendation}`);
  }
}

main();
```

## Best Practices

1. **Multiple Sources**: Always check at least 3 sources before concluding
2. **Recency**: Prioritize recent sources for time-sensitive claims
3. **Official First**: Always check official sources before secondary ones
4. **Language**: Search in both Korean and English for broader coverage
5. **Context**: Consider the original context when verifying
6. **Transparency**: Document uncertainty and caveats
7. **Human Review**: Flag low-confidence results for manual review
