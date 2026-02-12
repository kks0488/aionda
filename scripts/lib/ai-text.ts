import { generateContent as geminiGenerateContent, translateToEnglish as geminiTranslateToEnglish } from './gemini';
import { generateContent as openaiGenerateContent, translateToEnglish as openaiTranslateToEnglish } from './openai';
import { generateContent as deepseekGenerateContent, translateToEnglish as deepseekTranslateToEnglish } from './deepseek';

export type AiTextProvider = 'gemini' | 'openai' | 'deepseek';

function normalizeProvider(value: string): AiTextProvider {
  const v = value.trim().toLowerCase();
  if (v === 'openai' || v === 'gpt') return 'openai';
  if (v === 'deepseek') return 'deepseek';
  return 'gemini';
}

export function getAiTextProvider(): AiTextProvider {
  const raw = process.env.AI_TEXT_PROVIDER || process.env.LLM_PROVIDER || 'gemini';
  return normalizeProvider(raw);
}

export async function generateContent(prompt: string): Promise<string> {
  const provider = getAiTextProvider();
  if (provider === 'openai') return openaiGenerateContent(prompt);
  if (provider === 'deepseek') return deepseekGenerateContent(prompt);
  return geminiGenerateContent(prompt);
}

export async function translateToEnglish(
  title: string,
  content: string,
  options?: { extraRules?: string[] }
): Promise<{ title_en: string; content_en: string }> {
  const provider = getAiTextProvider();
  if (provider === 'openai') return openaiTranslateToEnglish(title, content, options);
  if (provider === 'deepseek') return deepseekTranslateToEnglish(title, content, options);
  return geminiTranslateToEnglish(title, content, options);
}
