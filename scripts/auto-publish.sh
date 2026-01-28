#!/bin/bash
# auto-publish.sh - 매시간 자동 글 발행
# Usage: 0 * * * * /home/kkaemo/projects/aionda/scripts/auto-publish.sh

set -e

cd /home/kkaemo/projects/aionda

LOG_FILE="/home/kkaemo/projects/aionda/logs/auto-publish-$(date +%Y%m%d).log"
mkdir -p /home/kkaemo/projects/aionda/logs

exec >> "$LOG_FILE" 2>&1

# Candidate pool: leftover untracked outputs from failed runs are preserved here.
# (Keeps the repo clean so cron can continue.)
CANDIDATE_POOL_ROOT="/home/kkaemo/aionda-candidate-pool"
LEGACY_QUARANTINE_ROOT="/home/kkaemo/aionda-quarantine"

echo ""
echo "=========================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Auto-publish started"
echo "=========================================="

# Prevent overlapping runs (cron can overlap if a run takes > 1h).
exec 9>/tmp/aionda-auto-publish.lock
if ! flock -n 9; then
    echo "[$(date '+%H:%M:%S')] Another auto-publish is running. Exiting."
    exit 0
fi

# Heartbeat/status (quick way to tell cron is running without reading logs)
date -u +"%Y-%m-%dT%H:%M:%SZ" > /tmp/aionda-auto-publish-last-run.txt
STATUS_FILE="/tmp/aionda-auto-publish-status.txt"
echo "running" > "$STATUS_FILE"

# If we exit non-zero at any point, mark the run as failed for quick diagnosis.
trap 'code=$?; if [ "$code" -ne 0 ]; then echo "failed: exit=$code" > "$STATUS_FILE"; fi' EXIT

# If a previous run failed mid-way, it can leave untracked MDX/images in tracked
# directories, which would permanently block future runs due to the "dirty worktree"
# safety check. Quarantine these leftovers outside the repo (keep them for debugging).
UNTRACKED_OUTPUTS="$(git ls-files --others --exclude-standard -- apps/web/content/posts apps/web/public/images/posts 2>/dev/null || true)"
if [ -n "$UNTRACKED_OUTPUTS" ]; then
    TS="$(date +%Y%m%d-%H%M%S)"
    ROOT="$CANDIDATE_POOL_ROOT"
    # Keep backward compatibility if user already relies on the old path.
    if [ -d "$LEGACY_QUARANTINE_ROOT" ] && [ ! -d "$CANDIDATE_POOL_ROOT" ]; then
        ROOT="$LEGACY_QUARANTINE_ROOT"
    fi
    DEST="$ROOT/$TS"
    echo "[$(date '+%H:%M:%S')] Found leftover untracked outputs. Moving to candidate pool: $DEST"
    mkdir -p "$DEST"
    echo "$UNTRACKED_OUTPUTS" | while IFS= read -r f; do
        [ -z "$f" ] && continue
        mkdir -p "$DEST/$(dirname "$f")"
        mv "$f" "$DEST/$f"
    done
fi

# Ignore known timestamp noise.
git restore --staged docker-compose.yml >/dev/null 2>&1 || true
git checkout -- docker-compose.yml >/dev/null 2>&1 || true

# 개발 중인 변경사항이 섞이면 콘텐츠 린트/게이트가 예상치 못하게 실패할 수 있으므로
# 워크트리가 더럽다면(unstaged/staged/untracked) 안전하게 이번 실행은 스킵합니다.
if ! git diff --quiet -- . ':(exclude)docker-compose.yml' \
  || ! git diff --cached --quiet -- . ':(exclude)docker-compose.yml' \
  || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    echo "[$(date '+%H:%M:%S')] Worktree is dirty. Skipping auto-publish to avoid mixing dev changes."
    echo "skipped: dirty worktree" > /tmp/aionda-auto-publish-status.txt
    exit 0
fi

# 원격 최신 상태로 동기화(깨끗한 상태에서만 수행)
git fetch origin main >/dev/null 2>&1 || true
git reset --hard origin/main >/dev/null 2>&1 || true
echo "synced: origin/main" > /tmp/aionda-auto-publish-status.txt

# 환경변수 로드
export PATH="/home/kkaemo/.nvm/versions/node/v22.21.1/bin:/home/kkaemo/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin:$PATH"
source /home/kkaemo/.bashrc 2>/dev/null || true
source /home/kkaemo/projects/aionda/.env.local 2>/dev/null || true

# 1. 크롤링 (DC Inside + RSS)
echo "[$(date '+%H:%M:%S')] Step 1a: Crawling DC Inside..."
pnpm crawl --pages=2 || echo "DC crawl warning (might be empty)"

echo "[$(date '+%H:%M:%S')] Step 1b: Crawling RSS feeds..."
pnpm crawl-rss || echo "RSS crawl warning"

# 2. 토픽 추출
echo "[$(date '+%H:%M:%S')] Step 2: Extracting topics..."
pnpm extract-topics --limit=3 || echo "Extract warning"

# 3. 리서치 (publishable 토픽 확보를 위해 여러 개를 시도)
echo "[$(date '+%H:%M:%S')] Step 3: Researching topics..."
pnpm research-topic --limit=3 || echo "Research warning"

# 4. 글 작성 (memU 중복체크 포함)
echo "[$(date '+%H:%M:%S')] Step 4: Writing article..."
pnpm write-article || echo "Write warning"

# 4b. 품질 게이트(엄격 + 사실 검증)
echo "[$(date '+%H:%M:%S')] Step 4b: Content gate (publish)..."
if ! pnpm content:gate:publish; then
    echo "❌ Gate failed. Aborting publish."
    exit 1
fi

# 5. 이미지 생성
echo "[$(date '+%H:%M:%S')] Step 5: Generating images..."
ENABLE_IMAGE_GENERATION=true pnpm generate-image || echo "Image warning"

# 5b. 빌드(옵션)
if [ "${AUTO_PUBLISH_SKIP_BUILD}" != "true" ]; then
    echo "[$(date '+%H:%M:%S')] Step 5b: Building site..."
    pnpm build || { echo "❌ Build failed. Aborting publish."; exit 1; }
fi

# 6. 변경사항 확인 및 커밋
echo "[$(date '+%H:%M:%S')] Step 6: Checking for changes..."

if git diff --quiet && git diff --cached --quiet; then
    echo "No changes to commit"
    echo "completed: no changes" > "$STATUS_FILE"
else
    # 새 글만 커밋
    git add apps/web/content/posts/ apps/web/public/images/posts/

    NEW_FILES=$(git diff --cached --name-only | grep -E "\.mdx$" | head -1 || true)
    if [ -n "$NEW_FILES" ]; then
        SLUG=$(basename "$NEW_FILES" .mdx)
        git commit -m "auto: 새 글 발행 - $SLUG

Automated publish by auto-publish.sh
$(date '+%Y-%m-%d %H:%M')"

        echo "[$(date '+%H:%M:%S')] Step 7: Pushing to remote..."
        git push

        echo "[$(date '+%H:%M:%S')] SUCCESS: Published $SLUG"
        echo "published: $SLUG" > "$STATUS_FILE"
    else
        echo "No new articles to publish"
        echo "completed: no new articles" > "$STATUS_FILE"
    fi
fi

echo "[$(date '+%H:%M:%S')] Auto-publish completed"
echo "completed" > "$STATUS_FILE"
echo ""
