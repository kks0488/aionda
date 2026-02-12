import OpenAI from 'openai';

const AI_API_DISABLED = ['true', '1'].includes(
  (process.env.AI_API_DISABLED || '').toLowerCase()
);

const API_KEY = process.env.DEEPSEEK_API_KEY || '';
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

const DEEPSEEK_TIMEOUT_MS = Number.parseInt(process.env.DEEPSEEK_TIMEOUT_MS || '45000', 10);
const DEEPSEEK_MAX_RETRIES = Number.parseInt(process.env.DEEPSEEK_MAX_RETRIES || '2', 10);
const DEEPSEEK_TEMPERATURE = Number.parseFloat(process.env.DEEPSEEK_TEMPERATURE || '0.2');
const DEEPSEEK_MAX_OUTPUT_TOKENS = (() => {
  const raw = process.env.DEEPSEEK_MAX_OUTPUT_TOKENS;
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
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
  const maxRetries = Number.isFinite(DEEPSEEK_MAX_RETRIES) ? DEEPSEEK_MAX_RETRIES : 2;
  const timeout = Number.isFinite(DEEPSEEK_TIMEOUT_MS) ? DEEPSEEK_TIMEOUT_MS : 45_000;
  return new OpenAI({
    apiKey: API_KEY,
    baseURL: BASE_URL || undefined,
    maxRetries,
    timeout,
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
): Promise<{ title_en: string; content_en: string }> {
  const extraRules = (options?.extraRules || [])
    .map((rule) => String(rule || '').trim())
    .filter(Boolean);
  const extraRuleBlock = extraRules.length > 0 ? `\n${extraRules.map((rule) => `- ${rule}`).join('\n')}` : '';

  const prompt = `<task>한→영 기술 글 번역</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 기술 용어: 표준 영어 (언어모델 → Language Model)
- 제품명/회사명/모델 버전: 원문 표기 그대로 유지 (임의로 최신 버전으로 바꾸지 말 것)
- 코드 블록/URL: 그대로 유지
- 비격식체 → 전문적 영어
- 마크다운 형식 유지
${extraRuleBlock}
</critical_rules>

<title>
${title}
</title>

<content>
${content.substring(0, 6000)}
</content>

<output_format>
{"title_en": "영어 제목", "content_en": "영어 본문 (마크다운 유지)"}
</output_format>`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { title_en: title, content_en: content };
  } catch (error) {
    console.error('Error translating (DeepSeek):', error);
    return { title_en: title, content_en: content };
  }
}
