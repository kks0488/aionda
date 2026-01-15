/**
 * Gemini API Client - Gemini Flash 전용
 *
 * 모든 텍스트 생성과 웹 검색을 Gemini로 처리
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import {
  buildSearchStrategy,
  createVerifiedSource,
  type VerifiedSource,
  type SearchStrategy,
} from './search-mode.js';

config({ path: '.env.local' });

const AI_API_DISABLED = ['true', '1'].includes(
  (process.env.AI_API_DISABLED || '').toLowerCase()
);
const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

if (!AI_API_DISABLED && !API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not found in .env.local');
}

const genAI = new GoogleGenerativeAI(API_KEY);

const TODAY = new Date().toISOString().split('T')[0];
const CONTEXT_INJECTION = `
<system_context>
Today's Date: ${TODAY}
Current State-of-the-Art (2026): GPT 5.2, Claude Opus 4.5, Gemini 3, DeepSeek-V4
Operational Context: You are operating in January 2026. GPT 5.2, Claude Opus 4.5, and Gemini 3 are the industry leaders. Legacy models like GPT-4, Gemini 1.5, or Claude 3.5 are considered historical references.
</system_context>`;

function assertAiEnabled() {
  if (AI_API_DISABLED) {
    const error = new Error('AI API disabled (AI_API_DISABLED=true)');
    (error as Error & { code?: string }).code = 'AI_API_DISABLED';
    throw error;
  }
  if (!API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
}

/**
 * 텍스트 생성 (Gemini Flash)
 */
export async function generateContent(prompt: string): Promise<string> {
  assertAiEnabled();
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const fullPrompt = CONTEXT_INJECTION + '\n' + prompt;
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
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
    const model = genAI.getGenerativeModel({
      model: MODEL,
      tools: [{ googleSearch: {} } as any],
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        answer: parsed.answer || 'No answer found',
        confidence: parsed.confidence || 0.5,
        sources: (parsed.sources || []).filter((s: any) => s.url && s.url.startsWith('http')),
        unverified: parsed.unverified || [],
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
  originalContent: string
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

  const prompt = CONTEXT_INJECTION + `\n<task>사실 주장 검증</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 확신도 90% 미만이면 verified: false
- 가짜 URL 생성 절대 금지
- 출처 모르면 sources: []
- Tier S(학술) > A(공식) > B(SNS) > C(일반)
- 2026년 현재 시점에서 더 이상 유효하지 않은 정보(구식 모델 성능 등)는 허위 정보로 간주하여 verified: false 처리
</critical_rules>

<claim>
주장: "${claim.text}"
유형: ${claim.type}
엔티티: ${claim.entities?.join(', ') || 'N/A'}
</claim>

<context>
${originalContent.substring(0, 800)}
</context>

<output_format>
{"verified": true/false, "confidence": 0.0-1.0, "notes": "설명", "correctedText": "수정 필요시만", "sources": [{"url": "URL", "title": "제목", "tier": "S|A|B|C"}]}
</output_format>`;

  try {
    const model = genAI.getGenerativeModel({
      model: MODEL,
      tools: [{ googleSearch: {} } as any],
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const sources: VerifiedSource[] = (parsed.sources || [])
        .filter((s: any) => s.url && s.url.startsWith('http'))
        .map((s: any) => createVerifiedSource(s.url, s.title || 'Unknown'));

      const meetsThreshold = parsed.confidence >= 0.9;

      return {
        verified: meetsThreshold ? parsed.verified : false,
        confidence: parsed.confidence,
        notes: parsed.notes || '',
        correctedText: parsed.correctedText,
        sources,
        strategy,
      };
    }

    return {
      verified: false,
      confidence: 0.5,
      notes: 'Unable to verify - response parsing failed',
      sources: [],
      strategy,
    };
  } catch (error) {
    console.error('Error verifying claim:', error);
    return {
      verified: false,
      confidence: 0.5,
      notes: 'Verification failed due to error',
      sources: [],
      strategy,
    };
  }
}

/**
 * 검증 가능한 주장 추출
 */
export async function extractClaims(content: string): Promise<any[]> {
  const prompt = CONTEXT_INJECTION + `\n<task>검증 가능한 사실 주장 추출</task>

<instruction>
반드시 JSON 배열만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
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
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
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
  content: string
): Promise<{ title_en: string; content_en: string }> {
  assertAiEnabled();

  const prompt = CONTEXT_INJECTION + `\n<task>한→영 기술 글 번역</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 기술 용어: 표준 영어 (언어모델 → Language Model)
- 제품명/회사명: 그대로 유지 (GPT-5, Gemini 3, Claude 4 등 최신 명칭 반영)
- 코드 블록/URL: 그대로 유지
- 비격식체 → 전문적 영어
- 마크다운 형식 유지
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
    console.error('Error translating:', error);
    return { title_en: title, content_en: content };
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
