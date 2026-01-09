# Crawling Guide

This document details the web crawling system for collecting posts from DC Inside "thesingularity" gallery.

## Target Website

**URL**: `https://gall.dcinside.com/mgallery/board/lists?id=thesingularity`

**Type**: Minor Gallery (마이너 갤러리)

**Content**: AI, technology, and singularity-related discussions

## Page Structure Analysis

### Gallery List Page

```
URL Pattern: /mgallery/board/lists?id=thesingularity&page={n}
```

**HTML Structure**:
```html
<table class="gall_list">
  <tbody class="gall_list">
    <tr class="ub-content us-post">
      <td class="gall_num">123456</td>
      <td class="gall_tit">
        <a href="/mgallery/board/view/?id=thesingularity&no=123456">
          <em class="icon_txt">[정보/뉴스]</em>
          제목 텍스트
        </a>
        <a class="reply_numbox">[12]</a>
      </td>
      <td class="gall_writer">
        <span class="nickname">닉네임</span>
      </td>
      <td class="gall_date">01.10</td>
      <td class="gall_count">1234</td>
      <td class="gall_recommend">56</td>
    </tr>
  </tbody>
</table>
```

### Post Detail Page

```
URL Pattern: /mgallery/board/view/?id=thesingularity&no={postId}
```

**HTML Structure**:
```html
<div class="view_content_wrap">
  <header class="view_head">
    <h3 class="title">제목</h3>
    <div class="gall_date">2025.01.10 03:55</div>
  </header>
  <div class="write_div">
    <!-- Post content -->
  </div>
</div>
```

## Crawling Implementation

### Technology Choice

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Cheerio** | Fast, lightweight | No JS rendering | Use for static content |
| **Playwright** | Full browser, JS support | Slower, resource-heavy | Use for dynamic content |
| **Puppeteer** | Similar to Playwright | Less cross-browser | Alternative to Playwright |

**Recommendation**: Start with Cheerio; fall back to Playwright if needed.

### Fetcher Implementation

```typescript
// packages/crawler/src/fetcher.ts

import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://gall.dcinside.com';
const GALLERY_ID = 'thesingularity';

interface FetchOptions {
  page?: number;
  delay?: number;
}

export async function fetchPostList(options: FetchOptions = {}) {
  const { page = 1, delay = 1000 } = options;

  const url = `${BASE_URL}/mgallery/board/lists?id=${GALLERY_ID}&page=${page}`;

  // Rate limiting
  await sleep(delay);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    }
  });

  return parsePostList(response.data);
}

export async function fetchPostDetail(postId: string) {
  const url = `${BASE_URL}/mgallery/board/view/?id=${GALLERY_ID}&no=${postId}`;

  await sleep(1000);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    }
  });

  return parsePostDetail(response.data, postId);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Parser Implementation

```typescript
// packages/crawler/src/parser.ts

import * as cheerio from 'cheerio';

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

export function parsePostList(html: string): PostListItem[] {
  const $ = cheerio.load(html);
  const posts: PostListItem[] = [];

  $('tr.ub-content.us-post').each((_, element) => {
    const $row = $(element);

    // Skip notice posts
    if ($row.find('.icon_notice').length > 0) return;

    const id = $row.find('.gall_num').text().trim();
    const $title = $row.find('.gall_tit a').first();
    const category = $title.find('em.icon_txt').text().replace(/[\[\]]/g, '').trim();
    const title = $title.text().replace(category, '').trim();
    const author = $row.find('.gall_writer .nickname').text().trim();
    const date = $row.find('.gall_date').text().trim();
    const views = parseInt($row.find('.gall_count').text()) || 0;
    const likes = parseInt($row.find('.gall_recommend').text()) || 0;
    const comments = parseInt($row.find('.reply_numbox').text().replace(/[\[\]]/g, '')) || 0;

    if (id && title) {
      posts.push({
        id,
        title,
        category,
        author,
        date,
        views,
        likes,
        comments
      });
    }
  });

  return posts;
}

interface PostDetail {
  id: string;
  title: string;
  author: string;
  date: string;
  content: string;
  contentText: string;
  images: string[];
  url: string;
}

export function parsePostDetail(html: string, postId: string): PostDetail {
  const $ = cheerio.load(html);

  const title = $('.title').first().text().trim();
  const author = $('.gall_writer .nickname').first().text().trim();
  const date = $('.gall_date').first().text().trim();

  const $content = $('.write_div');
  const content = $content.html() || '';
  const contentText = $content.text().trim();

  const images: string[] = [];
  $content.find('img').each((_, img) => {
    const src = $(img).attr('src');
    if (src) images.push(src);
  });

  return {
    id: postId,
    title,
    author,
    date,
    content,
    contentText,
    images,
    url: `https://gall.dcinside.com/mgallery/board/view/?id=thesingularity&no=${postId}`
  };
}
```

### Main Crawler Script

```typescript
// scripts/crawl.ts

import { fetchPostList, fetchPostDetail } from '../packages/crawler/src/fetcher';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = './data/raw';

async function main() {
  // Ensure data directory exists
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Parse CLI arguments
  const pages = parseInt(process.argv.find(a => a.startsWith('--pages='))?.split('=')[1] || '1');

  console.log(`Crawling ${pages} page(s)...`);

  let newPosts = 0;

  for (let page = 1; page <= pages; page++) {
    console.log(`\nPage ${page}:`);

    const posts = await fetchPostList({ page });

    for (const post of posts) {
      const filePath = join(DATA_DIR, `${post.id}.json`);

      // Skip if already crawled
      if (existsSync(filePath)) {
        console.log(`  Skip: ${post.id} (exists)`);
        continue;
      }

      // Fetch full content
      const detail = await fetchPostDetail(post.id);

      const fullPost = {
        ...post,
        ...detail,
        crawledAt: new Date().toISOString()
      };

      writeFileSync(filePath, JSON.stringify(fullPost, null, 2), 'utf-8');
      console.log(`  New: ${post.id} - ${post.title.substring(0, 30)}...`);
      newPosts++;
    }
  }

  console.log(`\nDone! ${newPosts} new post(s) crawled.`);
}

main().catch(console.error);
```

## Rate Limiting & Ethics

### Rate Limiting Rules

| Rule | Value | Reason |
|------|-------|--------|
| Request delay | 1 second | Prevent server overload |
| Max pages/session | 10 | Reasonable batch size |
| Retry delay | 5 seconds | Allow server recovery |
| Max retries | 3 | Avoid infinite loops |

### Implementation

```typescript
const rateLimiter = {
  lastRequest: 0,
  minDelay: 1000,

  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;

    if (elapsed < this.minDelay) {
      await sleep(this.minDelay - elapsed);
    }

    this.lastRequest = Date.now();
  }
};
```

### Ethical Guidelines

1. **Respect robots.txt**: Check and follow site's crawling rules
2. **Identify yourself**: Use descriptive User-Agent
3. **Limit frequency**: Don't overwhelm the server
4. **Cache results**: Don't re-crawl same content
5. **Handle errors gracefully**: Don't retry aggressively
6. **Content usage**: Attribute original sources

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 403 Forbidden | IP blocked or cookies required | Use Puppeteer, add delays |
| 404 Not Found | Post deleted | Log and skip |
| 503 Service Unavailable | Server overload | Wait and retry |
| Network timeout | Slow connection | Increase timeout |

### Error Handling Implementation

```typescript
async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { timeout: 10000 });
      return response.data;
    } catch (error) {
      if (i === retries - 1) throw error;

      console.log(`Retry ${i + 1}/${retries} after error: ${error.message}`);
      await sleep(5000 * (i + 1)); // Exponential backoff
    }
  }
  throw new Error('Max retries exceeded');
}
```

## Output Format

### JSON Schema

```json
{
  "id": "123456",
  "title": "Post title",
  "category": "정보/뉴스",
  "author": "nickname",
  "date": "2025.01.10 03:55",
  "views": 1234,
  "likes": 56,
  "comments": 12,
  "content": "<p>HTML content...</p>",
  "contentText": "Plain text content...",
  "images": [
    "https://image-url-1.jpg",
    "https://image-url-2.jpg"
  ],
  "url": "https://gall.dcinside.com/...",
  "crawledAt": "2025-01-10T10:30:00.000Z"
}
```

### File Naming

```
data/raw/{postId}.json

Example:
data/raw/123456.json
data/raw/123457.json
```

## Puppeteer Fallback

If Cheerio fails due to JavaScript rendering:

```typescript
// packages/crawler/src/fetcher-puppeteer.ts

import puppeteer from 'puppeteer';

export async function fetchWithPuppeteer(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 ...');
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Wait for content to load
    await page.waitForSelector('.gall_list', { timeout: 10000 });

    return await page.content();
  } finally {
    await browser.close();
  }
}
```
