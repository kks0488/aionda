# Internal API Design

This document describes the internal APIs used in the Singularity Blog project.

## Overview

The project uses two types of APIs:
1. **CLI Scripts API**: Functions called by command-line scripts
2. **Next.js API Routes**: HTTP endpoints for the blog site

---

## Part 1: CLI Scripts API

### Crawler Module (`packages/crawler`)

#### `fetchPostList(options)`

Fetches list of posts from gallery.

```typescript
interface FetchOptions {
  page?: number;          // Page number (default: 1)
  category?: string;      // Category filter
  delay?: number;         // Request delay in ms (default: 1000)
}

interface PostListItem {
  id: string;
  title: string;
  category: string;
  author: string;
  date: string;
  views: number;
  likes: number;
  comments: number;
}

async function fetchPostList(options?: FetchOptions): Promise<PostListItem[]>
```

**Example:**
```typescript
const posts = await fetchPostList({ page: 1, category: '정보/뉴스' });
// Returns: [{ id: '123456', title: '...', ... }, ...]
```

#### `fetchPostDetail(postId)`

Fetches full content of a single post.

```typescript
interface PostDetail {
  id: string;
  title: string;
  author: string;
  date: string;
  content: string;        // HTML content
  contentText: string;    // Plain text
  images: ImageRef[];
  url: string;
}

async function fetchPostDetail(postId: string): Promise<PostDetail>
```

**Example:**
```typescript
const detail = await fetchPostDetail('123456');
// Returns: { id: '123456', content: '<p>...</p>', ... }
```

---

### Verifier Module (`scripts/verify`)

#### `extractClaims(content)`

Extracts factual claims from post content using Claude.

```typescript
interface Claim {
  text: string;           // Claim text
  type: ClaimType;        // Claim category
  entities: string[];     // Mentioned entities
  searchQueries: string[];// Suggested search queries
}

async function extractClaims(content: string): Promise<Claim[]>
```

**Example:**
```typescript
const claims = await extractClaims('GPT-5가 MMLU에서 97%를 달성...');
// Returns: [{ text: 'GPT-5가 MMLU에서 97%를 달성', type: 'benchmark', ... }]
```

#### `verifyClaim(claim)`

Verifies a single claim using web search.

```typescript
interface VerificationResult {
  verified: boolean;
  confidence: number;     // 0-1
  sources: Source[];
  correctedText?: string;
  notes: string;
}

async function verifyClaim(claim: Claim): Promise<VerificationResult>
```

**Example:**
```typescript
const result = await verifyClaim(claim);
// Returns: { verified: true, confidence: 0.92, sources: [...] }
```

#### `generateReport(post, verifiedClaims)`

Generates a complete verification report.

```typescript
interface VerificationReport {
  postId: string;
  verifiedAt: string;
  claims: VerifiedClaim[];
  summary: {
    totalClaims: number;
    verifiedClaims: number;
    overallScore: number;
  };
  recommendation: string;
}

function generateReport(post: SelectedPost, claims: VerifiedClaim[]): VerificationReport
```

---

### Translator Module (`scripts/translate`)

#### `translatePost(post)`

Translates a verified post from Korean to English.

```typescript
interface TranslatedPost {
  title_en: string;
  title_ko: string;
  content_en: string;
  content_ko: string;
  glossaryUsed: string[];
}

async function translatePost(post: VerifiedPost): Promise<TranslatedPost>
```

**Example:**
```typescript
const translated = await translatePost(verifiedPost);
// Returns: { title_en: 'GPT-5 Analysis', content_en: '...', ... }
```

#### `applyGlossary(text, glossary)`

Applies technical term glossary to translation.

```typescript
type Glossary = Record<string, string>;

function applyGlossary(text: string, glossary: Glossary): string
```

---

### Post Generator (`scripts/generate-post`)

#### `generateMDX(post)`

Generates MDX file content from verified/translated post.

```typescript
interface MDXOutput {
  frontmatter: PostFrontmatter;
  content: string;
  fullContent: string;    // Frontmatter + content
}

function generateMDX(post: VerifiedPost): MDXOutput
```

#### `generateSlug(title)`

Generates URL-safe slug from title.

```typescript
function generateSlug(title: string): string

// Example
generateSlug('GPT-5 Performance Analysis') // => 'gpt-5-performance-analysis'
```

#### `generateOGImage(post)`

Generates OG image for social sharing.

```typescript
interface OGImageResult {
  path: string;           // Path to generated image
  url: string;            // Public URL
}

async function generateOGImage(post: VerifiedPost): Promise<OGImageResult>
```

---

## Part 2: Next.js API Routes

### Base URL

```
Development: http://localhost:3000/api
Production:  https://singularity-blog.vercel.app/api
```

### Routes Overview

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/posts` | List all posts |
| GET | `/api/posts/[slug]` | Get single post |
| GET | `/api/og` | Generate OG image |
| POST | `/api/revalidate` | Trigger ISR revalidation |

---

### `GET /api/posts`

Returns list of published posts.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `locale` | `'en' \| 'ko'` | Filter by locale (default: 'en') |
| `tag` | `string` | Filter by tag |
| `limit` | `number` | Max results (default: 10) |
| `offset` | `number` | Pagination offset |

**Response:**
```typescript
interface PostsResponse {
  posts: PostSummary[];
  total: number;
  hasMore: boolean;
}

interface PostSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  locale: string;
}
```

**Example:**
```bash
GET /api/posts?locale=en&tag=gpt-5&limit=5

{
  "posts": [
    {
      "slug": "gpt-5-performance-analysis",
      "title": "GPT-5 Performance Analysis",
      "description": "In-depth analysis of GPT-5...",
      "date": "2025-01-10",
      "tags": ["gpt-5", "openai"],
      "locale": "en"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

---

### `GET /api/posts/[slug]`

Returns full post content.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `slug` | `string` | Post slug |

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `locale` | `'en' \| 'ko'` | Content locale (default: 'en') |

**Response:**
```typescript
interface PostResponse {
  slug: string;
  title: string;
  content: string;        // MDX content
  date: string;
  tags: string[];
  locale: string;
  verificationScore: number;
  sourceUrl: string;
  alternateLocale?: string;
}
```

**Example:**
```bash
GET /api/posts/gpt-5-performance-analysis?locale=en

{
  "slug": "gpt-5-performance-analysis",
  "title": "GPT-5 Performance Analysis",
  "content": "# GPT-5 Performance Analysis\n\n...",
  "date": "2025-01-10",
  "tags": ["gpt-5", "openai"],
  "locale": "en",
  "verificationScore": 0.85,
  "sourceUrl": "https://gall.dcinside.com/...",
  "alternateLocale": "/ko/posts/gpt-5-performance-analysis"
}
```

---

### `GET /api/og`

Generates Open Graph image for social sharing.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `title` | `string` | Post title |
| `date` | `string` | Post date |
| `tags` | `string` | Comma-separated tags |

**Response:**
- Content-Type: `image/png`
- Returns PNG image (1200x630)

**Example:**
```bash
GET /api/og?title=GPT-5%20Analysis&date=2025-01-10&tags=gpt-5,openai

# Returns PNG image
```

**Implementation:**
```typescript
// apps/web/app/api/og/route.tsx
import { ImageResponse } from 'next/og';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'Singularity Blog';
  const date = searchParams.get('date') || '';
  const tags = searchParams.get('tags')?.split(',') || [];

  return new ImageResponse(
    (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#0f172a',
        padding: 60,
      }}>
        <h1 style={{ color: 'white', fontSize: 64 }}>{title}</h1>
        <p style={{ color: '#94a3b8', fontSize: 32 }}>{date}</p>
        <div style={{ display: 'flex', gap: 12 }}>
          {tags.map(tag => (
            <span key={tag} style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 8,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

---

### `POST /api/revalidate`

Triggers ISR revalidation for updated content.

**Headers:**
| Header | Description |
|--------|-------------|
| `x-revalidate-token` | Secret token for authentication |

**Request Body:**
```typescript
interface RevalidateRequest {
  paths: string[];        // Paths to revalidate
}
```

**Response:**
```typescript
interface RevalidateResponse {
  revalidated: boolean;
  paths: string[];
}
```

**Example:**
```bash
POST /api/revalidate
Content-Type: application/json
x-revalidate-token: secret123

{
  "paths": ["/en/posts/gpt-5-analysis", "/ko/posts/gpt-5-analysis"]
}

# Response
{
  "revalidated": true,
  "paths": ["/en/posts/gpt-5-analysis", "/ko/posts/gpt-5-analysis"]
}
```

---

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;         // Error code
    message: string;      // Human-readable message
    details?: any;        // Additional details
  };
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_PARAMS` | 400 | Invalid parameters |
| `UNAUTHORIZED` | 401 | Authentication required |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Example Error

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Post not found",
    "details": {
      "slug": "non-existent-post",
      "locale": "en"
    }
  }
}
```

---

## Rate Limiting

### CLI Scripts
- Crawler: 1 request per second to DC Inside
- Verifier: 10 requests per minute to web search

### API Routes
- OG Image: 100 requests per minute
- Posts API: 1000 requests per minute
- Revalidate: 10 requests per minute

### Implementation

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    throw new RateLimitError(limit, remaining);
  }
}
```
