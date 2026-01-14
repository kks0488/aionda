#!/bin/bash
# auto-publish.sh - 매시간 자동 글 발행
# Usage: 0 * * * * /home/kkaemo/projects/aionda/scripts/auto-publish.sh

set -e

cd /home/kkaemo/projects/aionda

LOG_FILE="/home/kkaemo/projects/aionda/logs/auto-publish-$(date +%Y%m%d).log"
mkdir -p /home/kkaemo/projects/aionda/logs

exec >> "$LOG_FILE" 2>&1

echo ""
echo "=========================================="
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Auto-publish started"
echo "=========================================="

# 환경변수 로드
export PATH="/home/kkaemo/.local/share/pnpm:$PATH"
source /home/kkaemo/projects/aionda/.env.local 2>/dev/null || true

# 1. 크롤링 (최신 글 수집)
echo "[$(date '+%H:%M:%S')] Step 1: Crawling..."
pnpm crawl --pages=2 || echo "Crawl warning (might be empty)"

# 2. 토픽 추출
echo "[$(date '+%H:%M:%S')] Step 2: Extracting topics..."
pnpm extract-topics --limit=3 || echo "Extract warning"

# 3. 리서치
echo "[$(date '+%H:%M:%S')] Step 3: Researching topics..."
pnpm research-topic --limit=1 || echo "Research warning"

# 4. 글 작성 (memU 중복체크 포함)
echo "[$(date '+%H:%M:%S')] Step 4: Writing article..."
pnpm write-article || echo "Write warning"

# 5. 이미지 생성
echo "[$(date '+%H:%M:%S')] Step 5: Generating images..."
ENABLE_IMAGE_GENERATION=true pnpm generate-image || echo "Image warning"

# 6. 변경사항 확인 및 커밋
echo "[$(date '+%H:%M:%S')] Step 6: Checking for changes..."

if git diff --quiet && git diff --cached --quiet; then
    echo "No changes to commit"
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
    else
        echo "No new articles to publish"
    fi
fi

echo "[$(date '+%H:%M:%S')] Auto-publish completed"
echo ""
