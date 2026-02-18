import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { lockSync } from 'proper-lockfile';

const QUEUE_FILE = './data/work-queue.json';

// 24시간 이상 claimed 상태면 자동 해제
const CLAIM_TIMEOUT_MS = 24 * 60 * 60 * 1000;

interface WorkQueue {
  claimed: Record<string, { by: 'crawler' | 'external-ai'; at: string; task?: string }>;
  completed: Record<string, { by: string; at: string; postSlug?: string; slug?: string }>;
  lastUpdated: string;
}

function emptyQueue(): WorkQueue {
  return { claimed: {}, completed: {}, lastUpdated: new Date().toISOString() };
}

export function loadQueue(): WorkQueue {
  if (!existsSync(QUEUE_FILE)) {
    return emptyQueue();
  }

  try {
    return JSON.parse(readFileSync(QUEUE_FILE, 'utf-8')) as WorkQueue;
  } catch (error) {
    const quarantineFile = `${QUEUE_FILE}.quarantine`;
    try {
      renameSync(QUEUE_FILE, quarantineFile);
      console.warn(
        `⚠️ Failed to parse ${QUEUE_FILE}. Moved corrupted file to ${quarantineFile} and reset queue.`,
        error
      );
    } catch (renameError) {
      console.warn(
        `⚠️ Failed to parse ${QUEUE_FILE}. Could not move corrupted file; resetting queue anyway.`,
        renameError
      );
      console.warn(error);
    }
    return emptyQueue();
  }
}

export function saveQueue(queue: WorkQueue): void {
  queue.lastUpdated = new Date().toISOString();
  const tmpFile = `${QUEUE_FILE}.tmp`;
  writeFileSync(tmpFile, JSON.stringify(queue, null, 2), 'utf-8');
  renameSync(tmpFile, QUEUE_FILE);
}

/**
 * 타임아웃된 claimed 항목들 자동 해제
 */
export function cleanupStaleClaimsInternal(queue: WorkQueue): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [postId, claim] of Object.entries(queue.claimed)) {
    const claimedAt = new Date(claim.at).getTime();
    if (now - claimedAt > CLAIM_TIMEOUT_MS) {
      delete queue.claimed[postId];
      cleaned++;
    }
  }

  return cleaned;
}

/**
 * 타임아웃된 claimed 항목들 정리하고 저장
 */
export function cleanupStaleClaims(): number {
  const queue = loadQueue();
  const cleaned = cleanupStaleClaimsInternal(queue);
  if (cleaned > 0) {
    saveQueue(queue);
    console.log(`🧹 Cleaned up ${cleaned} stale claimed items (>24h)`);
  }
  return cleaned;
}

export function claimWork(postId: string, by: 'crawler' | 'external-ai', task?: string): boolean {
  if (!existsSync(QUEUE_FILE)) {
    saveQueue({ claimed: {}, completed: {}, lastUpdated: new Date().toISOString() });
  }

  let release: (() => void) | undefined;
  try {
    release = lockSync(QUEUE_FILE, {
      retries: { retries: 3, minTimeout: 200, maxTimeout: 1000 },
    });

    const queue = loadQueue();

    // 먼저 stale claims 정리
    cleanupStaleClaimsInternal(queue);

    if (queue.claimed[postId] || queue.completed[postId]) {
      return false; // Already claimed or completed
    }
    queue.claimed[postId] = { by, at: new Date().toISOString(), task };
    saveQueue(queue);
    return true;
  } finally {
    if (release) release();
  }
}

export function completeWork(postId: string, by: string, postSlug?: string): void {
  if (!existsSync(QUEUE_FILE)) {
    saveQueue({ claimed: {}, completed: {}, lastUpdated: new Date().toISOString() });
  }

  let release: (() => void) | undefined;
  try {
    release = lockSync(QUEUE_FILE, {
      retries: { retries: 3, minTimeout: 200, maxTimeout: 1000 },
    });

    const queue = loadQueue();
    delete queue.claimed[postId];
    queue.completed[postId] = { by, at: new Date().toISOString(), postSlug, slug: postSlug };
    saveQueue(queue);
  } finally {
    if (release) release();
  }
}

export function getAvailablePosts(allPostIds: string[]): string[] {
  const queue = loadQueue();
  // 먼저 stale claims 정리
  cleanupStaleClaimsInternal(queue);
  return allPostIds.filter(id => !queue.claimed[id] && !queue.completed[id]);
}

export function isAvailable(postId: string): boolean {
  const queue = loadQueue();
  // 먼저 stale claims 정리
  cleanupStaleClaimsInternal(queue);

  // 타임아웃 체크
  if (queue.claimed[postId]) {
    const claimedAt = new Date(queue.claimed[postId].at).getTime();
    if (Date.now() - claimedAt > CLAIM_TIMEOUT_MS) {
      return true; // 타임아웃된 항목은 사용 가능
    }
  }

  return !queue.claimed[postId] && !queue.completed[postId];
}

export function getQueueStatus(): { claimed: number; completed: number; stale: number } {
  const queue = loadQueue();
  const now = Date.now();

  let staleCount = 0;
  for (const claim of Object.values(queue.claimed)) {
    const claimedAt = new Date(claim.at).getTime();
    if (now - claimedAt > CLAIM_TIMEOUT_MS) {
      staleCount++;
    }
  }

  return {
    claimed: Object.keys(queue.claimed).length,
    completed: Object.keys(queue.completed).length,
    stale: staleCount,
  };
}

/**
 * 모든 claimed 항목 강제 해제 (긴급 복구용)
 */
export function forceReleaseAllClaims(): number {
  const queue = loadQueue();
  const count = Object.keys(queue.claimed).length;
  queue.claimed = {};
  saveQueue(queue);
  return count;
}
