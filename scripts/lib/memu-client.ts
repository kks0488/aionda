/**
 * memU Client - 메모리 저장/검색/중복체크 클라이언트
 *
 * memU API 서버 (localhost:8100)와 통신하여
 * 콘텐츠 중복 체크 및 메모리 관리를 수행합니다.
 */

const MEMU_API_URL = process.env.MEMU_API_URL || 'http://localhost:8100';
const MEMU_TIMEOUT_MS = Number(process.env.MEMU_TIMEOUT_MS || 15000);

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = MEMU_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

interface MemorizeRequest {
  content: string;
  content_type?: 'document' | 'conversation';
  user_id?: string;
  metadata?: Record<string, unknown>;
}

interface MemorizeResponse {
  success: boolean;
  resource_id: string | null;
  categories: string[];
  items_count: number;
  message: string;
}

interface CheckSimilarRequest {
  content: string;
  user_id?: string;
  threshold?: number;
}

interface CheckSimilarResponse {
  is_similar: boolean;
  similarity_score: number;
  similar_items: Array<{
    id: string;
    summary: string;
    score: number;
    memory_type: string;
  }>;
  message: string;
}

interface RetrieveRequest {
  query: string;
  user_id?: string;
  top_k?: number;
}

interface RetrieveResponse {
  success: boolean;
  categories: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  message: string;
}

/**
 * memU 서버 상태 확인
 */
export async function checkMemuHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${MEMU_API_URL}/health`);
    const data = await response.json();
    return data.status === 'ok';
  } catch {
    console.warn('[memU] Server not available');
    return false;
  }
}

/**
 * 콘텐츠를 메모리에 저장
 */
export async function memorize(request: MemorizeRequest): Promise<MemorizeResponse | null> {
  try {
    const response = await fetchWithTimeout(`${MEMU_API_URL}/memorize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: request.content,
        content_type: request.content_type || 'document',
        user_id: request.user_id || 'aionda',
        metadata: request.metadata || {},
      }),
    });

    if (!response.ok) {
      console.error('[memU] Memorize failed:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      console.warn(`[memU] Memorize timed out after ${MEMU_TIMEOUT_MS}ms`);
      return null;
    }
    console.error('[memU] Memorize error:', error);
    return null;
  }
}

/**
 * 유사 콘텐츠 체크 (중복 방지용)
 *
 * @param content - 체크할 콘텐츠
 * @param threshold - 유사도 임계값 (기본 0.85)
 * @returns is_similar가 true면 중복 가능성 높음
 */
export async function checkSimilar(request: CheckSimilarRequest): Promise<CheckSimilarResponse | null> {
  try {
    const response = await fetchWithTimeout(`${MEMU_API_URL}/check-similar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: request.content,
        user_id: request.user_id || 'aionda',
        threshold: request.threshold || 0.85,
      }),
    });

    if (!response.ok) {
      console.error('[memU] Check similar failed:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      console.warn(`[memU] Check-similar timed out after ${MEMU_TIMEOUT_MS}ms`);
      return null;
    }
    console.error('[memU] Check similar error:', error);
    return null;
  }
}

/**
 * 메모리 검색
 */
export async function retrieve(request: RetrieveRequest): Promise<RetrieveResponse | null> {
  try {
    const response = await fetchWithTimeout(`${MEMU_API_URL}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: request.query,
        user_id: request.user_id || 'aionda',
        top_k: request.top_k || 5,
      }),
    });

    if (!response.ok) {
      console.error('[memU] Retrieve failed:', response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    if (isAbortError(error)) {
      console.warn(`[memU] Retrieve timed out after ${MEMU_TIMEOUT_MS}ms`);
      return null;
    }
    console.error('[memU] Retrieve error:', error);
    return null;
  }
}

/**
 * 글 발행 전 중복 체크 + 발행 후 저장
 *
 * 사용 예시:
 * ```typescript
 * const { isDuplicate, shouldPublish } = await checkBeforePublish(title, content);
 * if (shouldPublish) {
 *   // 발행 진행
 *   await saveAfterPublish(title, content, slug);
 * }
 * ```
 */
export async function checkBeforePublish(
  title: string,
  content: string,
  threshold = 0.85
): Promise<{ isDuplicate: boolean; shouldPublish: boolean; similarItems: CheckSimilarResponse['similar_items'] }> {
  const isHealthy = await checkMemuHealth();
  if (!isHealthy) {
    console.warn('[memU] Server not available, skipping duplicate check');
    return { isDuplicate: false, shouldPublish: true, similarItems: [] };
  }

  const checkContent = `${title}\n\n${content.slice(0, 2000)}`;
  const result = await checkSimilar({ content: checkContent, threshold });

  if (!result) {
    return { isDuplicate: false, shouldPublish: true, similarItems: [] };
  }

  return {
    isDuplicate: result.is_similar,
    shouldPublish: !result.is_similar,
    similarItems: result.similar_items,
  };
}

/**
 * 발행 후 메모리에 저장
 */
export async function saveAfterPublish(
  title: string,
  content: string,
  slug: string
): Promise<boolean> {
  const isHealthy = await checkMemuHealth();
  if (!isHealthy) {
    console.warn('[memU] Server not available, skipping save');
    return false;
  }

  const saveContent = `제목: ${title}\n슬러그: ${slug}\n\n${content.slice(0, 3000)}`;
  const result = await memorize({
    content: saveContent,
    content_type: 'document',
    user_id: 'aionda',
    metadata: { slug, title },
  });

  return result?.success || false;
}
