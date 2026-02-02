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

# If the repo is dirty ONLY due to publish outputs (posts/images) from a previous
# failed run, quarantine and clean them so cron can keep going. If any other
# file is dirty, treat it as a dev change and skip as before.
only_publish_outputs_dirty() {
  local any=0
  local file
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    any=1
    case "$file" in
      apps/web/content/posts/*) ;;
      apps/web/public/images/posts/*) ;;
      *) return 1 ;;
    esac
  done < <(
    {
      git diff --name-only -- . ':(exclude)docker-compose.yml' 2>/dev/null || true
      git diff --cached --name-only -- . ':(exclude)docker-compose.yml' 2>/dev/null || true
      git ls-files --others --exclude-standard 2>/dev/null || true
    } | sort -u
  )

  [ "$any" -eq 1 ]
}

if only_publish_outputs_dirty; then
  log "Worktree has leftover publish outputs only. Quarantining and continuing..."
  quarantine_dirty_outputs || true
fi

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
GLOBAL_ENV="/home/kkaemo/.config/claude-projects/global.env"
if [ -f "$GLOBAL_ENV" ]; then
  # global.env is SSOT for secrets. Load it for cron so we don't duplicate keys in repo clones.
  set +u
  # shellcheck disable=SC1090
  source "$GLOBAL_ENV" 2>/dev/null || true
  set -u
fi
source "$REPO_ROOT/.env.local" 2>/dev/null || true

# Publish slot state (outside the repo)
STATE_ROOT="$(pick_candidate_root)"
AUTO_PUBLISH_STATE_DIR="${AUTO_PUBLISH_STATE_DIR:-$STATE_ROOT/state}"
PUBLISH_SLOT_FILE="$AUTO_PUBLISH_STATE_DIR/publish-slot.txt"
mkdir -p "$AUTO_PUBLISH_STATE_DIR"

LAST_PUBLISH_EPOCH_FILE="$AUTO_PUBLISH_STATE_DIR/last-publish-epoch.txt"
ROUNDUP_LAST_DATE_FILE="$AUTO_PUBLISH_STATE_DIR/roundup-last-date.txt"

read_int_file() {
  local path="$1"
  local fallback="${2:-0}"
  if [ ! -f "$path" ]; then
    echo "$fallback"
    return 0
  fi
  local raw
  raw="$(cat "$path" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$raw" =~ ^[0-9]+$ ]]; then
    echo "$raw"
  else
    echo "$fallback"
  fi
}

write_int_file() {
  local path="$1"
  local value="$2"
  printf '%s\n' "$value" > "$path"
}

read_last_extracted_count() {
  local path="$REPO_ROOT/.vc/last-extracted-topics.json"
  if [ ! -f "$path" ]; then
    echo 0
    return 0
  fi

  node - <<'NODE' "$path" 2>/dev/null || echo 0
const fs = require('fs');
const p = process.argv[2];
try {
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  const n = Number(j && j.extractedCount);
  console.log(Number.isFinite(n) ? n : 0);
} catch {
  console.log(0);
}
NODE
}

slot="$(read_int_file "$PUBLISH_SLOT_FILE" 0)"
trend_every="${AUTO_PUBLISH_TREND_EVERY:-5}"
if ! [[ "$trend_every" =~ ^[0-9]+$ ]] || [ "$trend_every" -le 0 ]; then
  trend_every=3
fi

publish_mode="standard"
if [ $((slot % trend_every)) -eq 0 ]; then
  publish_mode="trend"
fi

log "Publish mode: ${publish_mode} (slot=${slot}, every=${trend_every})"

# Throughput controls (to avoid “spam burst” while still allowing more runs)
DAILY_MAX="${AUTO_PUBLISH_DAILY_MAX:-12}"
MIN_INTERVAL_MIN="${AUTO_PUBLISH_MIN_INTERVAL_MINUTES:-30}"
JITTER_SECONDS="${AUTO_PUBLISH_JITTER_SECONDS:-180}"

ROUNDUP_ENABLED="${AUTO_PUBLISH_ROUNDUP_ENABLED:-true}"
ROUNDUP_AFTER_HOUR="${AUTO_PUBLISH_ROUNDUP_AFTER_HOUR:-9}"
ROUNDUP_SINCE="${AUTO_PUBLISH_ROUNDUP_SINCE:-24h}"
ROUNDUP_LIMIT="${AUTO_PUBLISH_ROUNDUP_LIMIT:-12}"

if ! [[ "$DAILY_MAX" =~ ^[0-9]+$ ]]; then DAILY_MAX=12; fi
if ! [[ "$MIN_INTERVAL_MIN" =~ ^[0-9]+$ ]]; then MIN_INTERVAL_MIN=30; fi
if ! [[ "$JITTER_SECONDS" =~ ^[0-9]+$ ]]; then JITTER_SECONDS=180; fi
if ! [[ "$ROUNDUP_AFTER_HOUR" =~ ^[0-9]+$ ]]; then ROUNDUP_AFTER_HOUR=9; fi
if ! [[ "$ROUNDUP_LIMIT" =~ ^[0-9]+$ ]]; then ROUNDUP_LIMIT=12; fi

today_ymd="$(date +%Y%m%d)"
today_count_file="$AUTO_PUBLISH_STATE_DIR/daily-count-${today_ymd}.txt"
published_today="$(read_int_file "$today_count_file" 0)"

if [ "${DAILY_MAX:-0}" -gt 0 ] && [ "${published_today:-0}" -ge "${DAILY_MAX:-0}" ]; then
  log "Daily cap reached (published_today=${published_today}, daily_max=${DAILY_MAX}). Skipping."
  set_ready "last=skipped: daily cap (${published_today}/${DAILY_MAX})"
  exit 0
fi

last_publish_epoch="$(read_int_file "$LAST_PUBLISH_EPOCH_FILE" 0)"
now_epoch="$(date +%s)"
if [ "${last_publish_epoch:-0}" -gt 0 ] && [ "${MIN_INTERVAL_MIN:-0}" -gt 0 ]; then
  since_last="$((now_epoch - last_publish_epoch))"
  min_sec="$((MIN_INTERVAL_MIN * 60))"
  if [ "$since_last" -lt "$min_sec" ]; then
    log "Min interval not reached (since_last=${since_last}s, min=${min_sec}s). Skipping."
    set_ready "last=skipped: min interval (${since_last}s < ${min_sec}s)"
    exit 0
  fi
fi

# Optional daily roundup (publishes the collected materials as a link-first post)
if [ "${ROUNDUP_ENABLED}" = "true" ]; then
  current_hour="$(date +%H | sed 's/^0*//')"
  current_hour="${current_hour:-0}"
  last_roundup_date="$(cat "$ROUNDUP_LAST_DATE_FILE" 2>/dev/null | tr -d '[:space:]' || true)"
  if [ "$current_hour" -ge "$ROUNDUP_AFTER_HOUR" ] && [ "$last_roundup_date" != "$today_ymd" ]; then
    publish_mode="roundup"
    log "Roundup due today (after_hour=${ROUNDUP_AFTER_HOUR}). Switching publish mode to: roundup"
  fi
fi

# Jitter start (reduces “predictable bot schedule” patterns a bit)
if [ "${JITTER_SECONDS:-0}" -gt 0 ]; then
  jitter="$((RANDOM % (JITTER_SECONDS + 1)))"
  if [ "${jitter:-0}" -gt 0 ]; then
    log "Startup jitter: sleeping ${jitter}s"
    sleep "$jitter"
  fi
fi

# 1. 크롤링 (DC Inside + GitHub + RSS)
set_status "running: crawl dc"
log "Step 1a: Crawling DC Inside..."
CRAWL_PAGES="${AUTO_PUBLISH_CRAWL_PAGES:-2}"
pnpm crawl --pages="${CRAWL_PAGES}" || echo "DC crawl warning (might be empty)"

set_status "running: crawl github"
log "Step 1b: Crawling GitHub (Search API)..."
pnpm crawl-github || echo "GitHub crawl warning"

set_status "running: crawl rss"
log "Step 1c: Crawling RSS feeds..."
pnpm crawl-rss || echo "RSS crawl warning"

# 2. 토픽 추출 / 자료 모음(라운드업)
if [ "$publish_mode" = "roundup" ]; then
  set_status "running: generate roundup"
  log "Step 2: Generating materials roundup... (since=${ROUNDUP_SINCE} limit=${ROUNDUP_LIMIT})"
  pnpm generate-roundup --since="${ROUNDUP_SINCE}" --limit="${ROUNDUP_LIMIT}" || echo "Roundup warning"
else
  set_status "running: extract topics"
  log "Step 2: Extracting topics..."
  EXTRACT_LIMIT="${AUTO_PUBLISH_EXTRACT_LIMIT:-6}"
  STANDARD_SINCE="${AUTO_PUBLISH_STANDARD_SINCE:-72h}"

  if [ "$publish_mode" = "trend" ]; then
    TREND_LIMIT="${AUTO_PUBLISH_TREND_EXTRACT_LIMIT:-$EXTRACT_LIMIT}"
    TREND_SINCE="${AUTO_PUBLISH_TREND_SINCE:-2h}"
    TREND_FALLBACK_SINCE="${AUTO_PUBLISH_TREND_FALLBACK_SINCE:-24h}"

    log "Trend extraction: source=raw since=${TREND_SINCE} limit=${TREND_LIMIT}"
    pnpm extract-topics --source=raw --since="${TREND_SINCE}" --limit="${TREND_LIMIT}" || echo "Extract warning"
    extracted_count="$(read_last_extracted_count)"
    log "Trend extractedCount=${extracted_count}"

    if [ "${extracted_count:-0}" -eq 0 ]; then
      log "No trend topics in ${TREND_SINCE}. Retrying with since=${TREND_FALLBACK_SINCE}..."
      pnpm extract-topics --source=raw --since="${TREND_FALLBACK_SINCE}" --limit="${TREND_LIMIT}" || echo "Extract warning"
      extracted_count="$(read_last_extracted_count)"
      log "Trend extractedCount=${extracted_count} (fallback)"
    fi

    if [ "${extracted_count:-0}" -eq 0 ]; then
      log "No trend topics found. Falling back to standard extraction (since=${STANDARD_SINCE})..."
      publish_mode="standard_fallback"
    fi
  fi

  if [ "$publish_mode" != "trend" ]; then
    log "Standard extraction: since=${STANDARD_SINCE} limit=${EXTRACT_LIMIT}"

    extracted_count=0
    # Prefer higher-trust sources first to keep the feed "current" and reduce community-only drift.
    # Order is configurable via env:
    #   AUTO_PUBLISH_STANDARD_SOURCES="official,news,raw"
    #   AUTO_PUBLISH_STANDARD_SOURCES="official,news"  (disable raw unless no topics are extracted)
    STANDARD_SOURCES="${AUTO_PUBLISH_STANDARD_SOURCES:-official,news,raw}"
    IFS=',' read -ra SOURCES <<< "${STANDARD_SOURCES}"

    for src in "${SOURCES[@]}"; do
      src="$(echo "${src}" | tr -d '[:space:]')"
      [ -z "${src}" ] && continue

      if [ "${src}" = "all" ]; then
        log "Standard extraction: source=all since=${STANDARD_SINCE} limit=${EXTRACT_LIMIT}"
        pnpm extract-topics --since="${STANDARD_SINCE}" --limit="${EXTRACT_LIMIT}" || echo "Extract warning"
      else
        log "Standard extraction: source=${src} since=${STANDARD_SINCE} limit=${EXTRACT_LIMIT}"
        pnpm extract-topics --source="${src}" --since="${STANDARD_SINCE}" --limit="${EXTRACT_LIMIT}" || echo "Extract warning"
      fi

      extracted_count="$(read_last_extracted_count)"
      log "Standard extractedCount=${extracted_count} (source=${src})"
      if [ "${extracted_count:-0}" -gt 0 ]; then
        break
      fi
    done
  fi

  # 3. 리서치 (publishable 토픽 확보를 위해 여러 개를 시도)
  set_status "running: research topics"
  log "Step 3: Researching topics..."
  RESEARCH_LIMIT="${AUTO_PUBLISH_RESEARCH_LIMIT:-6}"
  pnpm research-topic --from-last-extract --limit="${RESEARCH_LIMIT}" || echo "Research warning"

  # 4. 글 작성 (memU 중복체크 포함)
  set_status "running: write article"
  log "Step 4: Writing article..."
  WRITE_LIMIT="${AUTO_PUBLISH_WRITE_LIMIT:-1}"
  pnpm write-article --limit="${WRITE_LIMIT}" || echo "Write warning"
fi

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

UNTRACKED_NEW="$(git ls-files --others --exclude-standard -- apps/web/content/posts apps/web/public/images/posts 2>/dev/null || true)"
if git diff --quiet && git diff --cached --quiet && [ -z "$UNTRACKED_NEW" ]; then
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
mode=${publish_mode}
$(date '+%Y-%m-%d %H:%M')"

        log "Step 7: Pushing to remote..."
        if ! push_with_rebase; then
          log "❌ Push failed (commit preserved locally)."
          set_status "blocked: push failed"
          exit 0
        fi

        log "SUCCESS: Published ${FIRST_SLUG}${SUFFIX}"
        # Update pacing state (best-effort; do not fail the run if this breaks).
        {
          today_ymd="$(date +%Y%m%d)"
          count_file="$AUTO_PUBLISH_STATE_DIR/daily-count-${today_ymd}.txt"
          cur_count="$(read_int_file "$count_file" 0)"
          inc="${COUNT_SLUGS:-1}"
          if ! [[ "$inc" =~ ^[0-9]+$ ]] || [ "$inc" -le 0 ]; then inc=1; fi
          next_count="$((cur_count + inc))"
          write_int_file "$count_file" "$next_count"
          write_int_file "$LAST_PUBLISH_EPOCH_FILE" "$(date +%s)"
          if [ "$publish_mode" = "roundup" ]; then
            printf '%s\n' "$today_ymd" > "$ROUNDUP_LAST_DATE_FILE"
          fi
          log "Pacing state: published_today=${next_count}/${DAILY_MAX}, last_publish_epoch updated"
        } || true

        next_slot="$((slot + 1))"
        write_int_file "$PUBLISH_SLOT_FILE" "$next_slot"
        log "Advanced publish slot: ${slot} -> ${next_slot}"
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
