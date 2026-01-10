import { existsSync, readFileSync, writeFileSync } from 'fs';

const QUEUE_FILE = './data/work-queue.json';

interface WorkQueue {
  claimed: Record<string, { by: 'crawler' | 'external-ai'; at: string; task?: string }>;
  completed: Record<string, { by: string; at: string; postSlug?: string }>;
  lastUpdated: string;
}

export function loadQueue(): WorkQueue {
  if (!existsSync(QUEUE_FILE)) {
    return { claimed: {}, completed: {}, lastUpdated: new Date().toISOString() };
  }
  return JSON.parse(readFileSync(QUEUE_FILE, 'utf-8'));
}

export function saveQueue(queue: WorkQueue): void {
  queue.lastUpdated = new Date().toISOString();
  writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf-8');
}

export function claimWork(postId: string, by: 'crawler' | 'external-ai', task?: string): boolean {
  const queue = loadQueue();
  if (queue.claimed[postId] || queue.completed[postId]) {
    return false; // Already claimed or completed
  }
  queue.claimed[postId] = { by, at: new Date().toISOString(), task };
  saveQueue(queue);
  return true;
}

export function completeWork(postId: string, by: string, postSlug?: string): void {
  const queue = loadQueue();
  delete queue.claimed[postId];
  queue.completed[postId] = { by, at: new Date().toISOString(), postSlug };
  saveQueue(queue);
}

export function getAvailablePosts(allPostIds: string[]): string[] {
  const queue = loadQueue();
  return allPostIds.filter(id => !queue.claimed[id] && !queue.completed[id]);
}

export function isAvailable(postId: string): boolean {
  const queue = loadQueue();
  return !queue.claimed[postId] && !queue.completed[postId];
}

export function getQueueStatus(): { claimed: number; completed: number; available?: number } {
  const queue = loadQueue();
  return {
    claimed: Object.keys(queue.claimed).length,
    completed: Object.keys(queue.completed).length,
  };
}
