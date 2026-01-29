#!/bin/bash
# auto-publish.sh - 매시간 자동 글 발행
# Usage (crontab): 0 * * * * /absolute/path/to/this-repo/scripts/auto-publish.sh

set -Eeuo pipefail
IFS=$'\n\t'

export HOME="/home/kkaemo"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

LOG_FILE="$REPO_ROOT/logs/auto-publish-$(date +%Y%m%d).log"
mkdir -p "$REPO_ROOT/logs"

exec >> "$LOG_FILE" 2>&1

# Status files (quick diagnosis for cron runs)
LAST_RUN_FILE="/tmp/aionda-auto-publish-last-run.txt"
STATUS_FILE="/tmp/aionda-auto-publish-status.txt"

timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log() { echo "[$(timestamp)] $*"; }
set_status() { echo "$*" > "$STATUS_FILE"; }
set_ready() {
  if [ "$#" -eq 0 ]; then
    set_status "ready"
  else
    set_status "ready: $*"
  fi
}

run_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout --preserve-status "$seconds" "$@"
  else
    "$@"
  fi
}

pick_candidate_root() {
  local root="$CANDIDATE_POOL_ROOT"
  # Keep backward compatibility if user already relies on the old path.
  if [ -d "$LEGACY_QUARANTINE_ROOT" ] && [ ! -d "$CANDIDATE_POOL_ROOT" ]; then
    root="$LEGACY_QUARANTINE_ROOT"
  fi
  echo "$root"
}

quarantine_dirty_outputs() {
  # On failure, the pipeline can leave tracked edits inside apps/web/content/posts
  # which will permanently block future cron runs (dirty worktree skip).
  # We keep a snapshot for debugging, then restore the repo to a clean state.
  set +e

  # Ignore known timestamp noise.
  git restore --staged docker-compose.yml >/dev/null 2>&1 || true
  git checkout -- docker-compose.yml >/dev/null 2>&1 || true

  local tracked_dirty=0
  git diff --quiet -- apps/web/content/posts apps/web/public/images/posts >/dev/null 2>&1 || tracked_dirty=1
  local staged_dirty=0
  git diff --cached --quiet -- apps/web/content/posts apps/web/public/images/posts >/dev/null 2>&1 || staged_dirty=1
  local untracked_outputs
  untracked_outputs="$(git ls-files --others --exclude-standard -- apps/web/content/posts apps/web/public/images/posts 2>/dev/null || true)"

  if [ "$tracked_dirty" -eq 0 ] && [ "$staged_dirty" -eq 0 ] && [ -z "$untracked_outputs" ]; then
    return 0
  fi

  local ts root dest
  ts="$(date +%Y%m%d-%H%M%S)"
  root="$(pick_candidate_root)"
  dest="$root/publisher-failed-$ts"

  log "Detected dirty publish outputs after failure. Quarantining to: $dest"
  mkdir -p "$dest"

  git status --porcelain=v1 > "$dest/git-status.txt" 2>/dev/null || true
  git diff -- apps/web/content/posts apps/web/public/images/posts > "$dest/diff.patch" 2>/dev/null || true
  git diff --cached -- apps/web/content/posts apps/web/public/images/posts > "$dest/diff-cached.patch" 2>/dev/null || true

  # Snapshot modified tracked files (best-effort) for quick inspection.
  local modified_files
  modified_files="$(
    {
      git diff --name-only -- apps/web/content/posts apps/web/public/images/posts 2>/dev/null || true
      git diff --cached --name-only -- apps/web/content/posts apps/web/public/images/posts 2>/dev/null || true
    } | sort -u
  )"

  if [ -n "$modified_files" ]; then
    mkdir -p "$dest/worktree"
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      mkdir -p "$dest/worktree/$(dirname "$f")"
      cp -a "$f" "$dest/worktree/$f" 2>/dev/null || true
    done <<< "$modified_files"
  fi

  # Move leftover untracked outputs out of the repo.
  if [ -n "$untracked_outputs" ]; then
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      mkdir -p "$dest/untracked/$(dirname "$f")"
      mv "$f" "$dest/untracked/$f" 2>/dev/null || true
    done <<< "$untracked_outputs"
  fi

  # Restore tracked edits (keep scope narrow; never touch unrelated files).
  if [ -n "$modified_files" ]; then
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      git restore --staged -- "$f" >/dev/null 2>&1 || true
      git checkout -- "$f" >/dev/null 2>&1 || true
    done <<< "$modified_files"
  fi

  log "Quarantine complete. Worktree restored to clean state."
  return 0
}

push_with_rebase() {
  if run_timeout 300 git push; then
    return 0
  fi

  log "❌ git push failed. Trying fetch+rebase then retry..."
  if ! run_timeout 180 git fetch origin main; then
    log "❌ git fetch failed during push recovery"
    return 1
  fi

  if ! run_timeout 180 git rebase origin/main; then
    log "❌ git rebase failed during push recovery"
    git rebase --abort >/dev/null 2>&1 || true
    return 1
  fi

  run_timeout 300 git push
}

# Candidate pool: leftover untracked outputs from failed runs are preserved here.
# (Keeps the repo clean so cron can continue.)
CANDIDATE_POOL_ROOT="/home/kkaemo/aionda-candidate-pool"
LEGACY_QUARANTINE_ROOT="/home/kkaemo/aionda-quarantine"

echo ""
echo "=========================================="
log "Auto-publish started"
echo "=========================================="

# Prevent overlapping runs (cron can overlap if a run takes > 1h).
exec 9>/tmp/aionda-auto-publish.lock
if ! flock -n 9; then
    log "Another auto-publish is running. Exiting."
    exit 0
fi

# Heartbeat/status (quick way to tell cron is running without reading logs)
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$LAST_RUN_FILE"
set_status "running"

FAIL_LINE=""
FAIL_CMD=""
on_err() {
  FAIL_LINE="${1:-}"
  FAIL_CMD="${2:-}"
}
on_exit() {
  local code="$?"
  if [ "$code" -ne 0 ]; then
    local current=""
    current="$(cat "$STATUS_FILE" 2>/dev/null || true)"
    if [ "$current" = "running" ] || [[ "$current" == running:* ]]; then
      local cmd_preview
      cmd_preview="$(echo "${FAIL_CMD:-unknown}" | tr '\n' ' ' | cut -c 1-200)"
      set_status "failed: exit=$code line=${FAIL_LINE:-?} cmd=${cmd_preview}"
    fi

    # Ensure failures do not permanently block future cron runs.
    quarantine_dirty_outputs || true
  fi
}
trap 'on_err "$LINENO" "$BASH_COMMAND"' ERR
trap 'on_exit' EXIT
on_signal() {
  local sig="$1"
  local code=1
  if [ "$sig" = "INT" ]; then code=130; fi
  if [ "$sig" = "TERM" ]; then code=143; fi
  log "Received signal $sig. Exiting."
  set_status "failed: signal=$sig"
  exit "$code"
}
trap 'on_signal INT' INT
trap 'on_signal TERM' TERM

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
    log "Found leftover untracked outputs. Moving to candidate pool: $DEST"
    mkdir -p "$DEST"
    while IFS= read -r f; do
        [ -z "$f" ] && continue
        mkdir -p "$DEST/$(dirname "$f")"
        mv "$f" "$DEST/$f"
    done <<< "$UNTRACKED_OUTPUTS"
fi

# Ignore known timestamp noise.
git restore --staged docker-compose.yml >/dev/null 2>&1 || true
git checkout -- docker-compose.yml >/dev/null 2>&1 || true

# 개발 중인 변경사항이 섞이면 콘텐츠 린트/게이트가 예상치 못하게 실패할 수 있으므로
# 워크트리가 더럽다면(unstaged/staged/untracked) 안전하게 이번 실행은 스킵합니다.
if ! git diff --quiet -- . ':(exclude)docker-compose.yml' \
  || ! git diff --cached --quiet -- . ':(exclude)docker-compose.yml' \
  || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    log "Worktree is dirty. Skipping auto-publish to avoid mixing dev changes."
    set_ready "last=skipped: dirty worktree"
    exit 0
fi

# 원격 최신 상태로 동기화(깨끗한 상태에서만 수행)
export GIT_TERMINAL_PROMPT=0

branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"
if [ "$branch" != "main" ]; then
  log "Not on branch 'main' (current: ${branch:-unknown}). Skipping."
  set_ready "last=skipped: not on main"
  exit 0
fi

log "Syncing with origin/main..."
set_status "running: syncing"

if ! run_timeout 180 git fetch origin main; then
  log "❌ git fetch failed"
  set_status "failed: git fetch"
  exit 1
fi

read -r ahead behind < <(git rev-list --left-right --count HEAD...origin/main 2>/dev/null || echo "0 0")

if [ "${ahead:-0}" -gt 0 ]; then
  log "Local branch is ahead of origin/main by ${ahead} commit(s). Attempting push first..."
  set_status "running: pushing pending commits"
  if ! push_with_rebase; then
    log "❌ Push failed. Leaving local commits intact; skipping this run."
    set_status "blocked: local ahead=${ahead} push failed"
    exit 0
  fi
  log "Push succeeded."
  if ! run_timeout 180 git fetch origin main; then
    log "❌ git fetch failed after push"
    set_status "failed: git fetch (post-push)"
    exit 1
  fi
  read -r ahead behind < <(git rev-list --left-right --count HEAD...origin/main 2>/dev/null || echo "0 0")
fi

if [ "${ahead:-0}" -eq 0 ] && [ "${behind:-0}" -gt 0 ]; then
  log "Fast-forwarding to origin/main (behind=${behind})..."
  git reset --hard origin/main >/dev/null 2>&1
fi

set_status "running: synced origin/main"

# 환경변수 로드
export PATH="/home/kkaemo/.nvm/versions/node/v22.21.1/bin:/home/kkaemo/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin:$PATH"
source /home/kkaemo/.bashrc 2>/dev/null || true
source "$REPO_ROOT/.env.local" 2>/dev/null || true

# 1. 크롤링 (DC Inside + RSS)
set_status "running: crawl dc"
log "Step 1a: Crawling DC Inside..."
CRAWL_PAGES="${AUTO_PUBLISH_CRAWL_PAGES:-2}"
pnpm crawl --pages="${CRAWL_PAGES}" || echo "DC crawl warning (might be empty)"

set_status "running: crawl rss"
log "Step 1b: Crawling RSS feeds..."
pnpm crawl-rss || echo "RSS crawl warning"

# 2. 토픽 추출
set_status "running: extract topics"
log "Step 2: Extracting topics..."
EXTRACT_LIMIT="${AUTO_PUBLISH_EXTRACT_LIMIT:-6}"
pnpm extract-topics --limit="${EXTRACT_LIMIT}" || echo "Extract warning"

# 3. 리서치 (publishable 토픽 확보를 위해 여러 개를 시도)
set_status "running: research topics"
log "Step 3: Researching topics..."
RESEARCH_LIMIT="${AUTO_PUBLISH_RESEARCH_LIMIT:-6}"
pnpm research-topic --limit="${RESEARCH_LIMIT}" || echo "Research warning"

# 4. 글 작성 (memU 중복체크 포함)
set_status "running: write article"
log "Step 4: Writing article..."
pnpm write-article || echo "Write warning"

# 4b. 품질 게이트(엄격 + 사실 검증)
set_status "running: content gate"
log "Step 4b: Content gate (publish)..."
if ! pnpm content:gate:publish; then
    echo "❌ Gate failed. Aborting publish."
    exit 1
fi

# 5. 이미지 생성
set_status "running: generate images"
log "Step 5: Generating images..."
ENABLE_IMAGE_GENERATION=true pnpm generate-image || echo "Image warning"

# 5b. 빌드(옵션)
if [ "${AUTO_PUBLISH_SKIP_BUILD:-}" != "true" ]; then
    set_status "running: build"
    log "Step 5b: Building site..."
    pnpm build || { echo "❌ Build failed. Aborting publish."; exit 1; }
fi

# 6. 변경사항 확인 및 커밋
set_status "running: commit/push"
log "Step 6: Checking for changes..."

if git diff --quiet && git diff --cached --quiet; then
    echo "No changes to commit"
    set_ready "last=no changes"
else
    # 새 글만 커밋
    git add apps/web/content/posts/ apps/web/public/images/posts/

    NEW_POSTS=$(git diff --cached --name-only | grep -E '^apps/web/content/posts/(en|ko)/[^/]+\.mdx$' | sed -E 's#^apps/web/content/posts/(en|ko)/##' | sed -E 's#\.mdx$##' | sort -u || true)
    FIRST_SLUG="$(echo "$NEW_POSTS" | head -n 1 | tr -d '\r' || true)"
    COUNT_SLUGS="$(echo "$NEW_POSTS" | sed '/^\s*$/d' | wc -l | tr -d ' ' || true)"
    if [ -n "$FIRST_SLUG" ]; then
        SUFFIX=""
        if [ "${COUNT_SLUGS:-0}" -gt 1 ]; then
          SUFFIX=" (+$((COUNT_SLUGS - 1)) more)"
        fi

        git commit -m "auto: 새 글 발행 - ${FIRST_SLUG}${SUFFIX}

Automated publish by auto-publish.sh
$(date '+%Y-%m-%d %H:%M')"

        log "Step 7: Pushing to remote..."
        if ! push_with_rebase; then
          log "❌ Push failed (commit preserved locally)."
          set_status "blocked: push failed"
          exit 0
        fi

        log "SUCCESS: Published ${FIRST_SLUG}${SUFFIX}"
        set_ready "last=published: ${FIRST_SLUG}${SUFFIX}"
    else
        echo "No new articles to publish"
        set_ready "last=no new articles"
    fi
fi

log "Auto-publish completed"
current="$(cat "$STATUS_FILE" 2>/dev/null || true)"
if [ "$current" = "running" ] || [[ "$current" == running:* ]]; then
  set_ready "last=completed"
fi
echo ""
