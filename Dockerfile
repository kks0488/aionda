# syntax=docker.io/docker/dockerfile:1

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN corepack enable pnpm

# Copy workspace configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN corepack enable pnpm

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the application
WORKDIR /app/apps/web
RUN pnpm run build

# Deploy using pnpm to get flat node_modules (--legacy for pnpm v10+)
WORKDIR /app
RUN pnpm --filter web deploy --prod --legacy /deployed

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/apps/web/public ./public

# Copy standalone output components
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/server.js ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/package.json ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone/content ./content

# Copy node_modules from pnpm deploy (flat structure, no symlinks)
COPY --from=builder --chown=nextjs:nodejs /deployed/node_modules ./node_modules

# Copy static files
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application
CMD ["node", "server.js"]
