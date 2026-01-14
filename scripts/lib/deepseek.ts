/**
 * DeepSeek API Client - Gemini 제거, DeepSeek 전용
 *
 * 모든 텍스트 생성을 DeepSeek Reasoner로 처리
 */

import OpenAI from 'openai';
import { config } from 'dotenv';

config({ path: '.env.local' });

const AI_API_DISABLED = ['true', '1'].includes(
  (process.env.AI_API_DISABLED || '').toLowerCase()
);

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-reasoner';
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';

if (!AI_API_DISABLED && !DEEPSEEK_API_KEY) {
  console.warn('⚠️ DEEPSEEK_API_KEY not found in .env.local');
}

const deepseek = DEEPSEEK_API_KEY
  ? new OpenAI({ apiKey: DEEPSEEK_API_KEY, baseURL: DEEPSEEK_BASE_URL })
  : null;

function assertAiEnabled() {
  if (AI_API_DISABLED) {
    const error = new Error('AI API disabled (AI_API_DISABLED=true)');
    (error as Error & { code?: string }).code = 'AI_API_DISABLED';
    throw error;
  }
  if (!deepseek) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }
}

/**
 * DeepSeek으로 콘텐츠 생성
 */
export async function generateContent(prompt: string): Promise<string> {
  assertAiEnabled();

  try {
    const completion = await deepseek!.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = completion.choices?.[0]?.message?.content;
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return (content as Array<string | { text?: string }>)
        .map((part) => (typeof part === 'string' ? part : part?.text || ''))
        .join('');
    }
    return '';
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw error;
  }
}

/**
 * 토픽에서 리서치 질문에 답변 (DeepSeek 지식 기반)
 */
export async function researchQuestion(question: string, context: string): Promise<{
  answer: string;
  confidence: number;
  keyFacts: string[];
  needsVerification: string[];
}> {
  assertAiEnabled();

  const prompt = `당신은 AI 기술 전문 리서처입니다.
다음 질문에 대해 당신의 지식을 바탕으로 정확하게 답변하세요.

## 질문:
${question}

## 관련 컨텍스트:
${context.substring(0, 2000)}

## 응답 규칙:
1. 확실히 아는 정보만 답변
2. 불확실하면 confidence를 낮게
3. 구체적 수치/날짜 포함 시 높은 신뢰도
4. 추측은 needsVerification에 명시

## 응답 (JSON만):
{
  "answer": "질문에 대한 답변 (2-3문장)",
  "confidence": 0.0-1.0,
  "keyFacts": ["핵심 사실 1", "핵심 사실 2"],
  "needsVerification": ["확인 필요한 부분"]
}`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        answer: parsed.answer || '',
        confidence: parsed.confidence || 0.5,
        keyFacts: parsed.keyFacts || [],
        needsVerification: parsed.needsVerification || [],
      };
    }

    return {
      answer: 'Failed to parse response',
      confidence: 0,
      keyFacts: [],
      needsVerification: [question],
    };
  } catch (error) {
    console.error('Error in researchQuestion:', error);
    return {
      answer: 'Research failed',
      confidence: 0,
      keyFacts: [],
      needsVerification: [question],
    };
  }
}

/**
 * 사실 검증 (DeepSeek 지식 기반)
 */
export async function verifyClaim(claim: string, context: string): Promise<{
  verified: boolean;
  confidence: number;
  explanation: string;
  correctedInfo?: string;
}> {
  assertAiEnabled();

  const prompt = `당신은 AI 기술 팩트체커입니다.
다음 주장이 사실인지 검증하세요.

## 주장:
${claim}

## 컨텍스트:
${context.substring(0, 1500)}

## 검증 규칙:
1. 확실히 사실이면 verified: true, confidence 0.8+
2. 확실히 거짓이면 verified: false, correctedInfo 제공
3. 불확실하면 confidence 0.5 미만
4. 날짜/수치 오류는 정확히 수정

## 응답 (JSON만):
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "explanation": "판단 근거",
  "correctedInfo": "수정된 정보 (필요시만)"
}`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        verified: parsed.verified ?? false,
        confidence: parsed.confidence || 0.5,
        explanation: parsed.explanation || '',
        correctedInfo: parsed.correctedInfo,
      };
    }

    return {
      verified: false,
      confidence: 0.5,
      explanation: 'Failed to verify',
    };
  } catch (error) {
    console.error('Error in verifyClaim:', error);
    return {
      verified: false,
      confidence: 0,
      explanation: 'Verification failed',
    };
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

  const prompt = `당신은 전문 기술 번역가입니다.
다음 한국어 기술 글을 영어로 번역하세요.

## 번역 규칙:
- 기술 용어는 표준 영어 사용
- 제품명/회사명은 그대로 유지 (GPT-5, Claude, OpenAI)
- 코드 블록/URL은 그대로 유지
- 자연스러운 영어로 번역 (직역 금지)
- 마크다운 형식 유지

## 제목:
${title}

## 본문:
${content.substring(0, 6000)}

## 응답 (JSON만):
{
  "title_en": "영어 제목",
  "content_en": "영어 본문 (마크다운 유지)"
}`;

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

// ============================================================
// 레거시 파이프라인용 함수 (verify.ts, translate.ts 호환)
// ============================================================

/**
 * 검증 가능한 주장 추출 (레거시 verify.ts 호환)
 */
export async function extractClaims(content: string): Promise<any[]> {
  assertAiEnabled();

  const prompt = `당신은 팩트체커입니다.
다음 글에서 검증 가능한 사실적 주장만 추출하세요.

## 규칙:
- 검증 가능한 사실만 (날짜, 수치, 벤치마크)
- 추측/의견 제외 ("~인 것 같다", "아마도")
- 구체적 데이터가 있는 주장만

## 내용:
${content.substring(0, 3000)}

## 응답 (JSON 배열만):
[{"id": "claim_1", "text": "주장 내용", "type": "release_date|benchmark|pricing|feature", "entities": ["관련 엔티티"], "priority": "high|medium|low"}]`;

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
 * 주장 검증 (레거시 verify.ts 호환 - 출처 포함)
 */
export async function verifyClaimLegacy(
  claim: any,
  originalContent: string
): Promise<{
  verified: boolean;
  confidence: number;
  notes: string;
  correctedText?: string;
  sources: Array<{ url: string; title: string; tier: string; domain: string; icon: string }>;
  strategy: { keywords: string[]; focus: string; academicRequired: boolean; domainFilters: string[] };
}> {
  assertAiEnabled();

  const claimText = typeof claim === 'string' ? claim : claim.text;
  const claimType = claim.type || 'general';
  const entities = claim.entities || [];

  const prompt = `당신은 AI 기술 팩트체커입니다.
다음 주장이 사실인지 당신의 지식으로 검증하세요.

## 주장:
${claimText}

## 유형: ${claimType}
## 엔티티: ${entities.join(', ') || 'N/A'}

## 컨텍스트:
${originalContent.substring(0, 800)}

## 검증 규칙:
1. 확신도 90% 미만이면 verified: false
2. 확실히 아는 정보만 검증
3. 날짜/수치 오류는 정확히 수정

## 응답 (JSON만):
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "notes": "검증 근거",
  "correctedText": "수정된 정보 (필요시만)"
}`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      const meetsThreshold = result.confidence >= 0.9;

      // DeepSeek 지식 기반이므로 실제 URL 출처 없음
      const sources: Array<{ url: string; title: string; tier: string; domain: string; icon: string }> = [];
      if (result.confidence >= 0.8) {
        sources.push({
          url: '#deepseek-knowledge',
          title: 'DeepSeek Knowledge Base',
          tier: 'A',
          domain: 'deepseek.com',
          icon: '🤖',
        });
      }

      return {
        verified: meetsThreshold ? result.verified : false,
        confidence: result.confidence,
        notes: result.notes || '',
        correctedText: result.correctedText,
        sources,
        strategy: {
          keywords: entities,
          focus: claimType,
          academicRequired: false,
          domainFilters: [],
        },
      };
    }

    return {
      verified: false,
      confidence: 0.5,
      notes: 'Unable to verify - response parsing failed',
      sources: [],
      strategy: { keywords: [], focus: 'general', academicRequired: false, domainFilters: [] },
    };
  } catch (error) {
    console.error('Error verifying claim:', error);
    return {
      verified: false,
      confidence: 0.5,
      notes: 'Verification failed due to error',
      sources: [],
      strategy: { keywords: [], focus: 'general', academicRequired: false, domainFilters: [] },
    };
  }
}

/**
 * 검증 요약 생성 (레거시 verify.ts 호환)
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

  const lines: string[] = [
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
  ];

  return lines.join('\n');
}

// ============================================================
// 토픽 기반 파이프라인 함수
// ============================================================

/**
 * 토픽 가치 평가
 */
export async function evaluateTopic(title: string, content: string): Promise<{
  worthDiscussing: boolean;
  reason: string;
  suggestedTitle: string;
  keyInsights: string[];
  researchQuestions: string[];
}> {
  assertAiEnabled();

  const prompt = `당신은 AI 기술 편집장입니다.
다음 글이 전문 블로그 기사로 다룰 가치가 있는지 평가하세요.

## 원본 제목:
${title}

## 내용:
${content.substring(0, 3000)}

## 평가 기준:
1. 새로운 정보가 있는가? (신제품, 업데이트, 벤치마크)
2. 검증 가능한 사실이 있는가?
3. 독자에게 실용적 가치가 있는가?
4. 이미 널리 알려진 정보가 아닌가?

## 거부 사유:
- 단순 의견/감상
- 루머/추측만 있음
- 이미 오래된 뉴스
- 내용이 너무 짧거나 불명확

## 응답 (JSON만):
{
  "worthDiscussing": true/false,
  "reason": "판단 이유 (1문장)",
  "suggestedTitle": "전문적인 기사 제목 (20자 이내)",
  "keyInsights": ["핵심 인사이트 1", "핵심 인사이트 2", "핵심 인사이트 3"],
  "researchQuestions": ["조사할 질문 1", "조사할 질문 2", "조사할 질문 3"]
}`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      worthDiscussing: false,
      reason: 'Failed to evaluate',
      suggestedTitle: title,
      keyInsights: [],
      researchQuestions: [],
    };
  } catch (error) {
    console.error('Error evaluating topic:', error);
    return {
      worthDiscussing: false,
      reason: 'Evaluation failed',
      suggestedTitle: title,
      keyInsights: [],
      researchQuestions: [],
    };
  }
}
