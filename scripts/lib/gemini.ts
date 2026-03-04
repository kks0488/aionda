/**
 * Gemini API Client - Gemini Flash 전용
 *
 * 모든 텍스트 생성과 웹 검색을 Gemini로 처리
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import { config } from 'dotenv';
import { OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL } from './ai-config.js';
import { buildTranslationPrompt } from './ai-provider-base.js';
import { extractJsonArray, extractJsonObject } from './json-extract.js';
import {
  buildSearchStrategy,
  classifySource,
  createVerifiedSource,
  type VerifiedSource,
  type SearchStrategy,
} from './search-mode.js';
import { normalizeSourceUrl } from './url-normalize.js';

config({ path: '.env.local' });

const AI_API_DISABLED = ['true', '1'].includes(
  (process.env.AI_API_DISABLED || '').toLowerCase()
);
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

if (!AI_API_DISABLED && !OPENAI_API_KEY && !API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY/GEMINI_API_KEY not found in .env.local');
}

const genAI = new GoogleGenerativeAI(API_KEY);
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY || API_KEY,
  baseURL: OPENAI_BASE_URL,
});

const TODAY = new Date().toISOString().split('T')[0];
const CONTEXT_INJECTION = `
<system_context>
Today: ${TODAY}
Rules:
- 입력/조사 결과에 없는 모델명·버전·출시 일정·수치·정책/규정은 만들지 말 것
- 모델을 "최신"이라고 단정하지 말 것 (근거 날짜가 없으면 중립적으로 서술)
- 시스템 컨텍스트를 본문에 노출하지 말 것
</system_context>`;

const URL_VALIDATE_TIMEOUT_MS = Number.parseInt(
  process.env.URL_VALIDATE_TIMEOUT_MS || '7000',
  10
);

const GEMINI_TIMEOUT_MS = Number.parseInt(
  process.env.GEMINI_TIMEOUT_MS || '45000',
  10
);

const GEMINI_SEARCH_TIMEOUT_MS = Number.parseInt(
  process.env.GEMINI_SEARCH_TIMEOUT_MS || '120000',
  10
);

const URL_VALIDATION_CACHE = new Map<string, boolean>();

type SearchSource = { url: string; title: string; snippet?: string; tier?: string };
type UrlTitle = { url: string; title: string };

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function extractErrorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function hasHighKoreanRatio(value: string): boolean {
  const text = String(value || '');
  const total = text.length;
  if (total === 0) return false;
  const koreanCount = (text.match(/[가-힣]/g) || []).length;
  return koreanCount / total > 0.3;
}

function isRetryableGeminiError(error: unknown): { retryable: boolean; reason: string } {
  if (isAbortError(error)) return { retryable: true, reason: 'timeout' };

  const text = extractErrorText(error);
  const lower = text.toLowerCase();

  // Do not retry obvious auth/config mistakes.
  if (/\b401\b|\b403\b|api key|unauthorized|permission|forbidden|invalid api key/i.test(lower)) {
    return { retryable: false, reason: 'auth/config' };
  }

  // Retry: rate limits / quota.
  if (/\b429\b|too many requests|rate limit|quota|resource_exhausted/i.test(lower)) {
    return { retryable: true, reason: 'rate_limit' };
  }

  // Retry: transient network-ish failures.
  if (/(fetch failed|socket hang up|econnreset|etimedout|eai_again|enotfound|econnrefused)/i.test(lower)) {
    return { retryable: true, reason: 'network' };
  }

  // Retry: transient server errors.
  if (/\b5\d\d\b|service unavailable|internal|unavailable|backend error|temporar/i.test(lower)) {
    return { retryable: true, reason: 'server' };
  }

  return { retryable: false, reason: 'non_retryable' };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithRetry<T>(
  fn: () => Promise<T>,
  { label, retries = 1 }: { label: string; retries?: number }
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const verdict = isRetryableGeminiError(error);
      if (verdict.retryable && attempt < retries) {
        const base = Math.min(60_000, 1500 * 2 ** attempt);
        const jitter = Math.floor(Math.random() * 600);
        const backoffMs = base + jitter;
        const message = error instanceof Error ? error.message : extractErrorText(error);
        console.warn(
          `[Gemini] ${label} failed (${verdict.reason}). Retrying after ${backoffMs}ms... (${attempt + 1}/${retries})`
        );
        if (message) console.warn(`[Gemini] ${label} error: ${message}`.slice(0, 500));
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function isUrlReachable(url: string): Promise<boolean> {
  if (!url) return false;
  const cached = URL_VALIDATION_CACHE.get(url);
  if (typeof cached === 'boolean') return cached;

  const headers = {
    'User-Agent': 'AIOnda/1.0 (Content Pipeline)',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  const ok = await (async () => {
    try {
      const head = await fetchWithTimeout(
        url,
        { method: 'HEAD', redirect: 'follow', headers },
        URL_VALIDATE_TIMEOUT_MS
      );
      if (head.ok) return true;
      if ([401, 403, 429].includes(head.status)) return true;
      if ([404, 410].includes(head.status)) return false;
      if (head.status === 405) {
        const get = await fetchWithTimeout(
          url,
          { method: 'GET', redirect: 'follow', headers: { ...headers, Range: 'bytes=0-2047' } },
          URL_VALIDATE_TIMEOUT_MS
        );
        if (get.ok) return true;
        if ([401, 403, 429].includes(get.status)) return true;
        if ([404, 410].includes(get.status)) return false;
        return get.status < 500;
      }
      return head.status < 500;
    } catch {
      return false;
    }
  })();

  URL_VALIDATION_CACHE.set(url, ok);
  return ok;
}

function assertAiEnabled() {
  if (AI_API_DISABLED) {
    const error = new Error('AI API disabled (AI_API_DISABLED=true)');
    (error as Error & { code?: string }).code = 'AI_API_DISABLED';
    throw error;
  }
  if (!OPENAI_API_KEY && !API_KEY) {
    throw new Error('OPENAI_API_KEY or GEMINI_API_KEY not configured');
  }
}

function extractOpenAIText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item: any) => (item?.type === 'text' && typeof item.text === 'string' ? item.text : ''))
      .join('');
  }
  return '';
}

async function generateTextWithFallback(options: {
  prompt: string;
  label: string;
  retries: number;
  timeoutMs: number;
  temperature?: number;
  useSearchTool?: boolean;
}): Promise<string> {
  const {
    prompt,
    label,
    retries,
    timeoutMs,
    temperature = 0.7,
    useSearchTool = false,
  } = options;

  try {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await generateWithRetry(
      () =>
        openai.chat.completions.create(
          {
            model: OPENAI_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature,
          },
          { timeout: timeoutMs }
        ),
      { label: `${label}(openai)`, retries }
    );

    const text = extractOpenAIText(response.choices?.[0]?.message?.content);
    if (!text.trim()) throw new Error('OpenAI returned empty response');
    return text;
  } catch (openaiError) {
    if (!API_KEY) {
      throw openaiError;
    }

    const model = genAI.getGenerativeModel({
      model: MODEL,
      generationConfig: { temperature },
      ...(useSearchTool ? { tools: [{ googleSearch: {} } as any] } : {}),
    }, { timeout: timeoutMs });

    const result = await generateWithRetry(
      () => model.generateContent(prompt, { timeout: timeoutMs }),
      { label, retries }
    );
    const response = await result.response;
    return response.text();
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  const workers = new Array(Math.max(1, concurrency)).fill(null).map(async () => {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
}

function dedupeByUrl<T extends { url: string }>(sources: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const source of sources) {
    const url = source.url || '';
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(source);
  }
  return out;
}

/**
 * 텍스트 생성 (Gemini Flash)
 */
export async function generateContent(prompt: string): Promise<string> {
  assertAiEnabled();
  try {
    const fullPrompt = CONTEXT_INJECTION + '\n' + prompt;
    return await generateTextWithFallback({
      prompt: fullPrompt,
      label: 'generateContent',
      retries: 1,
      timeoutMs: GEMINI_TIMEOUT_MS,
      temperature: 0.7,
    });
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

/**
 * 웹 검색 + 답변 (Google Search 도구 사용)
 */
export async function searchAndVerify(question: string, context?: string): Promise<{
  answer: string;
  confidence: number;
  sources: Array<{ url: string; title: string; snippet?: string; tier?: string }>;
  unverified: string[];
}> {
  assertAiEnabled();

  const contextSection = context ? `\n<context>\n${context.substring(0, 1500)}\n</context>` : '';

  const prompt = CONTEXT_INJECTION + `\n<task>질문에 대한 검색 및 답변</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 검색 결과에서 확인된 정보만 사용
- 추측/가정 금지 - 확인 안 되면 "확인되지 않음"으로 명시
- 가짜 URL 생성 절대 금지
- 숫자/날짜/퍼센트/가격을 언급하면 sources.snippet에 그 숫자가 포함된 근거 문구를 넣어라. 근거가 없으면 숫자를 빼고 서술하라.
- 출처 모르면 sources: []
- 확신도 90% 미만이면 솔직하게 표시
</critical_rules>

<question>
${question}
</question>${contextSection}

<output_format>
{
  "answer": "검색 결과를 바탕으로 한 답변 (2-3문장)",
  "confidence": 0.0-1.0,
  "sources": [
    {"url": "실제 URL", "title": "페이지 제목", "snippet": "관련 인용문", "tier": "S|A|B|C"}
  ],
  "unverified": ["확인되지 않은 부분이 있다면 명시"]
}
  </output_format>`;

  try {
    const text = await generateTextWithFallback({
      prompt,
      label: 'searchAndVerify',
      retries: 6,
      timeoutMs: GEMINI_SEARCH_TIMEOUT_MS,
      temperature: 0,
      useSearchTool: true,
    });

    const jsonText = extractJsonObject(text);

    if (jsonText) {
      const parsed = JSON.parse(jsonText);

      const rawSources: SearchSource[] = (parsed.sources || [])
        .filter((s: any) => s.url && typeof s.url === 'string' && s.url.startsWith('http'))
        .map((s: any) => ({
          url: String(s.url),
          title: String(s.title || 'Unknown'),
          snippet: typeof s.snippet === 'string' ? s.snippet : undefined,
        }));

      const normalized = await mapWithConcurrency<SearchSource, SearchSource>(rawSources, 3, async (source) => {
        const url = await normalizeSourceUrl(source.url);
        const tier = classifySource(url);
        return { ...source, url, tier };
      });

      const validated = await mapWithConcurrency<SearchSource, SearchSource | null>(normalized, 3, async (source) => {
        const ok = await isUrlReachable(source.url);
        return ok ? source : null;
      });

      const finalSources = dedupeByUrl(validated.filter((s): s is NonNullable<typeof s> => s !== null));
      const hasTrusted = finalSources.some((s) => s.tier === 'S' || s.tier === 'A');
      let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
      if (finalSources.length === 0) confidence = Math.min(confidence, 0.2);
      if (finalSources.length > 0 && !hasTrusted) confidence = Math.min(confidence, 0.75);
      if (!Number.isFinite(confidence)) confidence = 0;
      confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;

      return {
        answer: String(parsed.answer || 'No answer found'),
        confidence,
        sources: finalSources,
        unverified: Array.isArray(parsed.unverified) ? parsed.unverified.map(String) : [],
      };
    }

    return {
      answer: 'Failed to parse search results',
      confidence: 0,
      sources: [],
      unverified: [question],
    };
  } catch (error) {
    console.error('Error in searchAndVerify:', error);
    return {
      answer: 'Search failed due to error',
      confidence: 0,
      sources: [],
      unverified: [question],
    };
  }
}

/**
 * 주장 검증 (Google Search 도구 사용)
 */
export async function verifyClaim(
  claim: any,
  originalContent: string,
  preferredSources: string[] = []
): Promise<{
  verified: boolean;
  confidence: number;
  notes: string;
  correctedText?: string;
  sources: VerifiedSource[];
  strategy: SearchStrategy;
}> {
  assertAiEnabled();
  const strategy = buildSearchStrategy(claim);

  const preferredSection = preferredSources.length > 0
    ? `\n<preferred_sources>\n${preferredSources.slice(0, 8).map((u) => `- ${u}`).join('\n')}\n</preferred_sources>`
    : '\n<preferred_sources>\nN/A\n</preferred_sources>';

  const head = originalContent.substring(0, 800);
  const tail = originalContent.length > 1400 ? originalContent.substring(originalContent.length - 600) : '';
  const contextSnippet = tail ? `${head}\n...\n${tail}` : head;

  const prompt = CONTEXT_INJECTION + `\n<task>사실 주장 검증</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 확신도 90% 미만이면 verified: false
- 가짜 URL 생성 절대 금지
- 출처 모르면 sources: []
- Tier S(학술) > A(공식) > B(SNS) > C(일반)
- preferred_sources에 포함된 URL(특히 1차/공식/원문)이 있으면, 먼저 확인하고 가능하면 sources에 포함해라.
- 2026년 현재 시점에서 더 이상 유효하지 않은 정보(구식 모델 성능 등)는 허위 정보로 간주하여 verified: false 처리
- correctedText는 **claim.text와 같은 언어**로 작성한다. (영문 claim이면 correctedText도 영어)
- correctedText는 원문에 끼워 넣을 수 있는 1~2문장짜리 “드롭인 교체 문장”이어야 한다.
- 수정안이 안전하지 않거나 근거를 특정하기 어렵다면 correctedText를 비워라.
</critical_rules>

<claim>
주장: "${claim.text}"
유형: ${claim.type}
엔티티: ${claim.entities?.join(', ') || 'N/A'}
</claim>

${preferredSection}

<context>
${contextSnippet}
</context>

<output_format>
{"verified": true/false, "confidence": 0.0-1.0, "notes": "설명", "correctedText": "수정 필요시만", "sources": [{"url": "URL", "title": "제목", "tier": "S|A|B|C"}]}
</output_format>`;

  try {
    const text = await generateTextWithFallback({
      prompt,
      label: 'verifyClaim',
      retries: 6,
      timeoutMs: GEMINI_SEARCH_TIMEOUT_MS,
      temperature: 0,
      useSearchTool: true,
    });

    const jsonText = extractJsonObject(text);

    if (jsonText) {
      const parsed = JSON.parse(jsonText);

      const rawSources: UrlTitle[] = (parsed.sources || [])
        .filter((s: any) => s.url && typeof s.url === 'string' && s.url.startsWith('http'))
        .map((s: any) => ({
          url: String(s.url),
          title: String(s.title || 'Unknown'),
        }));

      const normalized = await mapWithConcurrency<UrlTitle, UrlTitle>(rawSources, 3, async (source) => ({
        ...source,
        url: await normalizeSourceUrl(source.url),
      }));

      const sources: VerifiedSource[] = dedupeByUrl(normalized).map((s) =>
        createVerifiedSource(s.url, s.title)
      );

      let confidence = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
      if (!Number.isFinite(confidence)) confidence = 0.5;
      confidence = Math.round(Math.max(0, Math.min(1, confidence)) * 100) / 100;
      const meetsThreshold = confidence >= 0.9;
      const verified = Boolean(parsed.verified) && meetsThreshold;
      const correctedText =
        typeof parsed.correctedText === 'string' && parsed.correctedText.trim().length > 0
          ? parsed.correctedText.trim()
          : undefined;

      return {
        verified,
        confidence,
        notes: String(parsed.notes || ''),
        correctedText,
        sources,
        strategy,
      };
    }

    return {
      verified: false,
      confidence: 0,
      notes: 'Unable to verify - response parsing failed',
      sources: [],
      strategy,
    };
  } catch (error) {
    console.error('Error verifying claim:', error);
    return {
      verified: false,
      confidence: 0,
      notes: `Verification failed due to error: ${extractErrorText(error)}`.slice(0, 500),
      sources: [],
      strategy,
    };
  }
}

/**
 * 검증 가능한 주장 추출
 */
export async function extractClaims(content: string): Promise<any[]> {
  const prompt = `<task>검증 가능한 사실 주장 추출</task>

<instruction>
반드시 JSON 배열만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- text는 반드시 <content> 안에 **그대로 존재하는 문장/구절을 복사한 것(Exact quote)** 이어야 합니다. 번역/의역/요약/재작성 금지.
- 원문이 영어면 text도 영어(원문 그대로)로 출력합니다. 원문이 한국어면 한국어 그대로 출력합니다.
- "예:" 또는 "Example:"로 시작하는 가상 시나리오 문단의 문장은 주장으로 추출하지 마세요.
- 검증 가능한 사실적 주장만 추출
- 추측/의견 제외 ("~인 것 같다", "아마도")
- 구체적 데이터 있는 주장만 (날짜, 수치, 벤치마크)
- 현재(2026년) 시점에서 이미 구식이 된 정보는 추출 우선순위를 낮추거나(low) 제외
</critical_rules>

<content>
${content.substring(0, 3000)}
</content>

<output_format>
[{"id": "claim_1", "text": "주장", "type": "release_date|benchmark|pricing|feature", "entities": ["엔티티"], "priority": "high|medium|low"}]
</output_format>`;

  try {
    assertAiEnabled();
    const fullPrompt = CONTEXT_INJECTION + '\n' + prompt;
    const response = await generateTextWithFallback({
      prompt: fullPrompt,
      label: 'extractClaims',
      retries: 1,
      timeoutMs: GEMINI_TIMEOUT_MS,
      temperature: 0,
    });
    const jsonText = extractJsonArray(response);
    if (jsonText) {
      return JSON.parse(jsonText);
    }
    return [];
  } catch (error) {
    console.error('Error extracting claims:', error);
    return [];
  }
}

/**
 * 한→영 번역
 */
export async function translateToEnglish(
  title: string,
  content: string,
  options?: { extraRules?: string[] }
): Promise<{ title_en: string; content_en: string; translationFailed?: boolean }> {
  assertAiEnabled();
  const prompt = buildTranslationPrompt({
    title,
    content,
    extraRules: options?.extraRules,
  });

  try {
    const response = await generateContent(prompt);
    const jsonText = extractJsonObject(response);
    if (jsonText) {
      const parsed = JSON.parse(jsonText) as { title_en?: string; content_en?: string };
      const titleEn = String(parsed.title_en || title);
      const contentEn = String(parsed.content_en || content);
      if (hasHighKoreanRatio(contentEn)) {
        return { title_en: title, content_en: content, translationFailed: true };
      }
      return { title_en: titleEn, content_en: contentEn };
    }
    return { title_en: title, content_en: content, translationFailed: true };
  } catch (error) {
    console.error('Error translating:', error);
    return { title_en: title, content_en: content, translationFailed: true };
  }
}

/**
 * 검증 요약 생성
 */
export function generateVerificationSummary(
  claims: any[],
  overallScore: number
): string {
  const tierCounts = { S: 0, A: 0, B: 0, C: 0 };

  for (const claim of claims) {
    if (claim.sources) {
      for (const source of claim.sources) {
        const tier = source.tier as keyof typeof tierCounts;
        if (tier in tierCounts) {
          tierCounts[tier]++;
        }
      }
    }
  }

  return [
    `## 검증 요약`,
    `- 총 주장: ${claims.length}개`,
    `- 검증 완료: ${claims.filter((c) => c.verified).length}개`,
    `- 전체 점수: ${Math.round(overallScore * 100)}%`,
    ``,
    `## 출처 신뢰도 분포`,
    `- 🏛️ Tier S (학술): ${tierCounts.S}개`,
    `- 🛡️ Tier A (공식): ${tierCounts.A}개`,
    `- ⚠️ Tier B (주의): ${tierCounts.B}개`,
    `- Tier C (일반): ${tierCounts.C}개`,
  ].join('\n');
}
