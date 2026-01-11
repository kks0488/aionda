# Deployment Guide

This document describes how to deploy the Singularity Blog to production.

## Overview

The blog is deployed to Vercel with automatic deployments triggered by Git pushes.

## Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- GitHub account
- Vercel account (free tier works)
- (Optional) Custom domain

## Initial Setup

### 1. Create GitHub Repository

```bash
# Initialize git repository
cd /home/kkaemo/projects/singularity-blog
git init

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build
.next/
out/
dist/

# Environment
.env
.env.local
.env.*.local

# Data (optional - keep if you want version control)
# data/raw/
# data/selected/
# data/verified/

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Vercel
.vercel
EOF

# Initial commit
git add .
git commit -m "Initial commit: Singularity Blog"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/singularity-blog.git
git branch -M main
git push -u origin main
```

### 2. Connect to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (first time)
cd apps/web
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - Project name: singularity-blog
# - Directory: ./
# - Override settings? No
```

#### Option B: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import Git Repository → Select `singularity-blog`
4. Configure Project:
   - Framework Preset: Next.js
   - Root Directory: `apps/web`
   - Build Command: `pnpm build`
   - Output Directory: `.next`
5. Click "Deploy"

### 3. Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Claude API key for verification/translation | Yes |
| `NEXT_PUBLIC_SITE_URL` | Your site URL (e.g., https://singularity-blog.vercel.app) | Yes |
| `NEXT_PUBLIC_GA_ID` | Google Analytics ID | No |

```bash
# Or via CLI
vercel env add ANTHROPIC_API_KEY production
vercel env add NEXT_PUBLIC_SITE_URL production
```

## Deployment Workflow

### Automatic Deployments

Every push to `main` branch triggers automatic deployment:

```
Push to main → Vercel Build → Deploy to Production
```

### Preview Deployments

Pull requests get preview deployments:

```
Create PR → Vercel Preview Build → Unique Preview URL
```

### Manual Deployment

```bash
# Deploy current state
vercel

# Deploy to production
vercel --prod
```

## Build Configuration

### `vercel.json`

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["icn1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

### `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: ['gall.dcinside.com'],
  },
  experimental: {
    mdxRs: true,
  },
};

module.exports = nextConfig;
```

## GitHub Actions

### Auto-Deploy on Push

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Build
        run: pnpm build
        working-directory: apps/web

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### Manual Crawl Workflow

```yaml
# .github/workflows/crawl.yml
name: Manual Crawl

on:
  workflow_dispatch:  # Manual trigger

jobs:
  crawl:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Run crawler
        run: pnpm crawl --pages=3

      - name: Commit new posts
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "actions@github.com"
          git add data/raw/
          git diff --staged --quiet || git commit -m "chore: daily crawl $(date +%Y-%m-%d)"
          git push
```

## Custom Domain

### Setup

1. Go to Vercel Dashboard → Project → Settings → Domains
2. Add your domain (e.g., `singularity.yourdomain.com`)
3. Configure DNS:

| Type | Name | Value |
|------|------|-------|
| CNAME | singularity | cname.vercel-dns.com |

Or for apex domain:
| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |

### SSL Certificate

Vercel automatically provisions SSL certificates for custom domains.

## Monitoring

### Vercel Analytics

Enable in Vercel Dashboard → Project → Analytics:

```typescript
// apps/web/app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Speed Insights

```typescript
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## Rollback

### Via Dashboard

1. Go to Vercel Dashboard → Project → Deployments
2. Find the deployment to rollback to
3. Click "..." → "Promote to Production"

### Via CLI

```bash
# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback [deployment-url]
```

## Troubleshooting

### Build Failures

**Problem**: pnpm install fails
```bash
# Solution: Check pnpm version
pnpm --version

# Update lockfile if needed
pnpm install --no-frozen-lockfile
```

**Problem**: MDX build errors
```bash
# Solution: Check MDX syntax in content files
pnpm build 2>&1 | grep -A 5 "Error"
```

### Runtime Errors

**Problem**: API routes returning 500
```bash
# Check Vercel function logs
vercel logs [deployment-url]
```

**Problem**: Missing environment variables
```bash
# List env vars
vercel env ls

# Pull env vars locally for testing
vercel env pull .env.local
```

### Performance Issues

1. Enable Vercel Analytics to identify slow pages
2. Check image optimization settings
3. Review API route cold starts
4. Consider ISR (Incremental Static Regeneration) for frequently updated pages

## Security

### Secrets Management

- Never commit API keys to Git
- Use Vercel environment variables
- Rotate keys periodically

### Headers

Security headers are configured in `vercel.json`:
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

### API Protection

For sensitive API routes:

```typescript
// apps/web/app/api/admin/route.ts
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const headersList = headers();
  const apiKey = headersList.get('x-api-key');

  if (apiKey !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Handle request
}
```
