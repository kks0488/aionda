import { parseFloatEnv, parseIntEnv } from './env-utils';
import {
  buildTranslationPrompt,
  createProviderClient,
  parseJsonResponse,
} from './ai-provider-base.js';

const AI_API_DISABLED = ['true', '1'].includes(
  (process.env.AI_API_DISABLED || '').toLowerCase()
);

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const DEEPSEEK_TIMEOUT_MS = parseIntEnv('DEEPSEEK_TIMEOUT_MS', 45_000, 1);
const DEEPSEEK_MAX_RETRIES = parseIntEnv('DEEPSEEK_MAX_RETRIES', 2, 0);
const DEEPSEEK_TEMPERATURE = parseFloatEnv('DEEPSEEK_TEMPERATURE', 0.2, 0, 2);
const DEEPSEEK_MAX_OUTPUT_TOKENS = (() => {
  const parsed = parseIntEnv('DEEPSEEK_MAX_OUTPUT_TOKENS', 0, 1);
  return parsed > 0 ? parsed : undefined;
})();

const TODAY = new Date().toISOString().split('T')[0];
const CONTEXT_INJECTION = `
<system_context>
Today: ${TODAY}
Rules:
- 입력/조사 결과에 없는 모델명·버전·출시 일정·수치·정책/규정은 만들지 말 것
- 모델을 "최신"이라고 단정하지 말 것 (근거 날짜가 없으면 중립적으로 서술)
- 시스템 컨텍스트를 본문에 노출하지 말 것
</system_context>`.trim();

function assertAiEnabled() {
  if (AI_API_DISABLED) {
    const error = new Error('AI API disabled (AI_API_DISABLED=true)');
    (error as Error & { code?: string }).code = 'AI_API_DISABLED';
    throw error;
  }
  if (!API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }
}

function createClient() {
  return createProviderClient({
    apiKey: API_KEY,
    baseURL: BASE_URL,
    maxRetries: DEEPSEEK_MAX_RETRIES,
    timeoutMs: DEEPSEEK_TIMEOUT_MS,
  });
}

function pickTemperature() {
  if (!Number.isFinite(DEEPSEEK_TEMPERATURE)) return 0.2;
  return Math.min(2, Math.max(0, DEEPSEEK_TEMPERATURE));
}

export async function generateContent(prompt: string): Promise<string> {
  assertAiEnabled();

  const client = createClient();
  const response = await client.responses.create({
    model: MODEL as any,
    instructions: CONTEXT_INJECTION,
    input: prompt,
    temperature: pickTemperature(),
    max_output_tokens: DEEPSEEK_MAX_OUTPUT_TOKENS,
    store: false,
  });

  if (response.error) {
    throw new Error(`DeepSeek response error: ${response.error.message || 'unknown'}`);
  }

  return String(response.output_text || '').trim();
}

export async function translateToEnglish(
  title: string,
  content: string,
  options?: { extraRules?: string[] }
): Promise<{ title_en: string; content_en: string; translationFailed?: boolean }> {
  const prompt = buildTranslationPrompt({
    title,
    content,
    extraRules: options?.extraRules,
  });

  const hasHighKoreanRatio = (value: string): boolean => {
    const text = String(value || '');
    const total = text.length;
    if (total === 0) return false;
    const koreanCount = (text.match(/[가-힣]/g) || []).length;
    return koreanCount / total > 0.3;
  };

  try {
    const response = await generateContent(prompt);
    const parsed = parseJsonResponse<{ title_en?: string; content_en?: string }>(response);
    if (parsed) {
      const titleEn = String(parsed.title_en || title);
      const contentEn = String(parsed.content_en || content);
      if (hasHighKoreanRatio(contentEn)) {
        return { title_en: title, content_en: content, translationFailed: true };
      }
      return { title_en: titleEn, content_en: contentEn };
    }
    return { title_en: title, content_en: content, translationFailed: true };
  } catch (error) {
    console.error('Error translating (DeepSeek):', error);
    return { title_en: title, content_en: content, translationFailed: true };
  }
}
