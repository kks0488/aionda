import OpenAI from 'openai';
import { extractJsonObject } from './json-extract.js';

type ProviderClientConfig = {
  apiKey: string;
  baseURL?: string;
  maxRetries?: number;
  timeoutMs?: number;
};

export function createProviderClient(config: ProviderClientConfig): OpenAI {
  const maxRetries = Number.isFinite(config.maxRetries) ? Number(config.maxRetries) : 2;
  const timeout = Number.isFinite(config.timeoutMs) ? Number(config.timeoutMs) : 45_000;

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL || undefined,
    maxRetries,
    timeout,
  });
}

export function buildTranslationPrompt(params: {
  title: string;
  content: string;
  extraRules?: string[];
  maxContentChars?: number;
}): string {
  const extraRules = (params.extraRules || [])
    .map((rule) => String(rule || '').trim())
    .filter(Boolean);
  const extraRuleBlock = extraRules.length > 0 ? `\n${extraRules.map((rule) => `- ${rule}`).join('\n')}` : '';
  const maxContentChars =
    Number.isFinite(params.maxContentChars) && Number(params.maxContentChars) > 0
      ? Number(params.maxContentChars)
      : 10_000;

  return `<task>한→영 기술 글 번역</task>

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
${params.title}
</title>

<content>
${String(params.content || '').substring(0, maxContentChars)}
</content>

<output_format>
{"title_en": "영어 제목", "content_en": "영어 본문 (마크다운 유지)"}
</output_format>`;
}

export function parseJsonResponse<T>(response: string): T | null {
  const jsonText = extractJsonObject(response);
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}
