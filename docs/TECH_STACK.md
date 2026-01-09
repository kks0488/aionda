# Tech Stack

기술 스택 선택 가이드 및 대안 비교

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      SINGULARITY BLOG                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend          Backend           Infra          AI          │
│  ─────────         ───────           ─────          ──          │
│  Next.js 14        Node.js           Vercel         Claude API  │
│  React 18          TypeScript        GitHub         WebSearch   │
│  Tailwind CSS      pnpm              Actions                    │
│  MDX                                                            │
│  next-intl                                                      │
│                                                                 │
│  Crawling          Content           Image          Data        │
│  ────────          ───────           ─────          ────        │
│  Playwright        Contentlayer      @vercel/og     JSON        │
│  Cheerio           MDX               Satori         Zod         │
│                    gray-matter                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Framework & Runtime

### Next.js 14 (App Router)
**선택 이유:**
- App Router의 서버 컴포넌트로 성능 최적화
- Built-in i18n 라우팅 지원
- Vercel과 최적 통합
- OG Image 생성 내장 (@vercel/og)

| 대안 | 장점 | 단점 | 결론 |
|------|------|------|------|
| Astro | 초고속, 콘텐츠 중심 | React 생태계 제한적 | 블로그 전용이면 고려 |
| Remix | 중첩 라우팅, 폼 처리 | Vercel 통합 약함 | Pass |
| SvelteKit | 빠름, 간결한 문법 | 생태계 작음 | Pass |

### TypeScript
**선택 이유:**
- 타입 안전성으로 데이터 파이프라인 신뢰성 확보
- 에디터 자동완성
- Zod와 연동으로 런타임 검증

---

## 2. Content Management

### Option A: Contentlayer (추천)
```bash
pnpm add contentlayer next-contentlayer
```

**장점:**
- MDX 자동 타입 생성
- 빌드 타임 검증
- Hot reload 지원
- Next.js 공식 지원

**설정 예시:**
```typescript
// contentlayer.config.ts
import { defineDocumentType, makeSource } from 'contentlayer/source-files';

export const Post = defineDocumentType(() => ({
  name: 'Post',
  filePathPattern: `**/*.mdx`,
  contentType: 'mdx',
  fields: {
    title: { type: 'string', required: true },
    date: { type: 'date', required: true },
    tags: { type: 'list', of: { type: 'string' } },
    locale: { type: 'enum', options: ['en', 'ko'], required: true },
  },
}));

export default makeSource({
  contentDirPath: 'content/posts',
  documentTypes: [Post],
});
```

### Option B: Velite
```bash
pnpm add velite
```

**장점:**
- Contentlayer 대안 (유지보수 활발)
- Zod 기반 스키마
- 더 가벼움

### Option C: MDX + gray-matter (수동)
```bash
pnpm add @next/mdx gray-matter next-mdx-remote
```

**장점:**
- 완전한 제어
- 의존성 최소화

**단점:**
- 보일러플레이트 많음

### 결론
> **Contentlayer** 또는 **Velite** 추천. 둘 다 타입 안전하고 DX 좋음.

---

## 3. Internationalization (i18n)

### Option A: next-intl (추천)
```bash
pnpm add next-intl
```

**장점:**
- App Router 완벽 지원
- 메시지 포맷팅 (ICU)
- 타입 안전
- 서버 컴포넌트 지원

**설정 예시:**
```typescript
// i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default
}));
```

### Option B: next-i18next
```bash
pnpm add next-i18next i18next react-i18next
```

**장점:**
- 가장 널리 사용됨
- 문서 풍부

**단점:**
- App Router 지원 미흡
- 설정 복잡

### Option C: Paraglide (inlang)
```bash
pnpm add @inlang/paraglide-js
```

**장점:**
- 빌드 타임 번역 (런타임 오버헤드 없음)
- 타입 안전

**단점:**
- 상대적으로 새로움

### 결론
> **next-intl** 추천. App Router와 가장 잘 맞음.

---

## 4. Styling

### Tailwind CSS (추천)
```bash
pnpm add -D tailwindcss postcss autoprefixer
```

**장점:**
- 빠른 개발
- 번들 크기 최적화
- 다크모드 쉬움

**설정:**
```javascript
// tailwind.config.js
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '65ch',
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
```

### Typography Plugin
```bash
pnpm add -D @tailwindcss/typography
```

MDX 콘텐츠 스타일링에 필수.

---

## 5. Web Crawling

### Option A: Playwright (추천 for 동적 페이지)
```bash
pnpm add playwright
```

**장점:**
- JavaScript 렌더링 완벽 지원
- 멀티 브라우저
- 스크린샷, PDF 생성
- MCP 서버 지원

**사용 예시:**
```typescript
import { chromium } from 'playwright';

async function crawl(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url);
  await page.waitForSelector('.gall_list');
  const html = await page.content();
  await browser.close();
  return html;
}
```

### Option B: Cheerio (정적 페이지용)
```bash
pnpm add cheerio axios
```

**장점:**
- 가볍고 빠름
- jQuery 문법
- 서버사이드 전용

**사용 예시:**
```typescript
import * as cheerio from 'cheerio';
import axios from 'axios';

async function crawl(url: string) {
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);
  return $('.gall_list tr').map((_, el) => ({
    title: $(el).find('.gall_tit a').text(),
  })).get();
}
```

### Option C: Crawlee (Apify)
```bash
pnpm add crawlee
```

**장점:**
- 프로덕션 레벨 크롤러
- 자동 재시도, 프록시 관리
- 큐 시스템 내장

**단점:**
- 러닝 커브
- 오버킬일 수 있음

### 결론
> **Cheerio** 먼저 시도 → 안 되면 **Playwright**로 전환

---

## 6. OG Image Generation

### @vercel/og (추천)
```bash
pnpm add @vercel/og
```

**장점:**
- Vercel Edge에서 동적 생성
- Satori 기반 (JSX → SVG → PNG)
- 한글 폰트 지원

**사용 예시:**
```typescript
// app/api/og/route.tsx
import { ImageResponse } from 'next/og';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'Singularity Blog';

  return new ImageResponse(
    (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        color: 'white',
        fontSize: 60,
      }}>
        {title}
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

### 한글 폰트 설정
```typescript
import { ImageResponse } from 'next/og';

// Pretendard 폰트 로드
const fontData = fetch(
  new URL('../../../assets/Pretendard-Bold.otf', import.meta.url)
).then((res) => res.arrayBuffer());

export async function GET(request: Request) {
  const font = await fontData;

  return new ImageResponse(
    <div style={{ fontFamily: 'Pretendard' }}>한글 제목</div>,
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Pretendard', data: font, style: 'normal' }],
    }
  );
}
```

---

## 7. AI & API

### Claude API (Anthropic)
```bash
pnpm add @anthropic-ai/sdk
```

**용도:**
- 팩트체크 클레임 추출
- 번역 (ko → en)
- 콘텐츠 요약

**사용 예시:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

async function translate(text: string) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Translate to English, preserve technical terms:\n\n${text}`
    }]
  });
  return response.content[0].text;
}
```

### Web Search
Claude Code 내장 WebSearch 도구 사용.

---

## 8. Data Validation

### Zod
```bash
pnpm add zod
```

**용도:**
- 크롤링 데이터 검증
- API 응답 검증
- 환경변수 검증

**사용 예시:**
```typescript
import { z } from 'zod';

const PostSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  category: z.string(),
  views: z.number().int().min(0),
  crawledAt: z.string().datetime(),
});

type Post = z.infer<typeof PostSchema>;

// 검증
const validated = PostSchema.parse(rawData);
```

---

## 9. Package Manager

### pnpm (추천)
```bash
npm install -g pnpm
```

**장점:**
- 디스크 공간 절약 (심볼릭 링크)
- 빠른 설치
- 모노레포 지원 (workspace)

**설정:**
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## 10. Deployment

### Vercel
**장점:**
- Next.js 최적화
- Edge Functions
- 자동 Preview 배포
- Analytics 내장

**설정:**
```json
// vercel.json
{
  "framework": "nextjs",
  "regions": ["icn1"],
  "buildCommand": "pnpm build",
  "outputDirectory": ".next"
}
```

---

## Summary: 최종 스택

| 영역 | 선택 | 대안 |
|------|------|------|
| Framework | **Next.js 14** | Astro |
| Language | **TypeScript** | - |
| Content | **Contentlayer** | Velite, MDX+gray-matter |
| i18n | **next-intl** | Paraglide |
| Styling | **Tailwind CSS** | - |
| Crawling | **Cheerio** + **Playwright** | Crawlee |
| OG Image | **@vercel/og** | - |
| AI | **Claude API** | - |
| Validation | **Zod** | - |
| Package | **pnpm** | - |
| Deploy | **Vercel** | - |

---

## Installation Script

```bash
# 프로젝트 생성
pnpm create next-app@latest singularity-blog --typescript --tailwind --eslint --app --src-dir=false

cd singularity-blog

# 핵심 의존성
pnpm add contentlayer next-contentlayer next-intl @anthropic-ai/sdk zod

# 크롤링
pnpm add cheerio axios playwright

# 개발 의존성
pnpm add -D @tailwindcss/typography @types/node

# Playwright 브라우저 설치
pnpm exec playwright install chromium
```
