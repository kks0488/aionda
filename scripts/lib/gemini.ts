import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import {
  buildSearchStrategy,
  createVerifiedSource,
  classifySource,
  SourceTier,
  type VerifiedSource,
  type SearchStrategy,
} from './search-mode.js';

// Load environment variables
config({ path: '.env.local' });

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

if (!API_KEY) {
  console.warn('⚠️ GEMINI_API_KEY not found in .env.local');
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateContent(prompt: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

/**
 * Extract claims with SearchMode protocols
 * Applies intellectual honesty principle - only extracts verifiable claims
 */
export async function extractClaims(content: string): Promise<any[]> {
  const prompt = `# SearchMode Claim Extraction Protocol

## 핵심 원칙
- Intellectual Honesty: 검증 가능한 사실적 주장만 추출
- Fact over Assumption: 추측이나 의견은 제외
- 확신도 90% 이상인 주장만 추출

## 작업
다음 한국어 기술/AI 관련 글에서 **검증 가능한 사실적 주장(claims)**을 추출하세요.

## 추출 기준
1. 날짜, 수치, 벤치마크 등 구체적 데이터가 있는 주장
2. 회사/제품의 공식 발표나 기능 설명
3. 기술적 사양이나 비교 정보
4. 출시/발표 일정

## 제외 대상
- 추측성 표현 ("~인 것 같다", "아마도")
- 개인 의견이나 감상
- 검증 불가능한 일반론

## 글 내용:
${content.substring(0, 3000)}

## 응답 형식 (JSON 배열만):
[
  {
    "id": "claim_1",
    "text": "주장 텍스트 (원문 그대로)",
    "type": "release_date|benchmark|pricing|feature|company_statement|comparison|technical_spec|research",
    "entities": ["관련 회사/제품명"],
    "searchQueries": ["검증을 위한 검색어1", "검증을 위한 검색어2"],
    "priority": "high|medium|low"
  }
]

JSON 배열만 응답하세요. 다른 텍스트 금지.`;

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
 * Verify claim with SearchMode protocols
 * Implements:
 * - Source Credibility Tiers (S/A/B/C)
 * - 90% Confidence Threshold
 * - Anti-Hallucination measures
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
  // Build search strategy
  const strategy = buildSearchStrategy(claim);

  const prompt = `# SearchMode Verification Protocol

## 핵심 원칙
1. Intellectual Honesty: 확신도 90% 미만이면 "검증 불가"로 처리
2. No Hallucination: 가짜 출처나 추측 정보 생성 금지
3. Source Credibility: 출처의 신뢰도 계층 평가

## 소스 신뢰도 계층
- Tier S (🏛️): 학술/연구 (arxiv, Google Scholar, 공식 논문)
- Tier A (🛡️): 공식/신뢰 (.gov, .edu, 공식 블로그, 메이저 언론)
- Tier B (⚠️): 주의 필요 (SNS, 포럼, 위키, 개인 블로그)
- Tier C: 일반 웹사이트

## 검증 대상
주장: "${claim.text}"
유형: ${claim.type}
관련 엔티티: ${claim.entities?.join(', ') || 'N/A'}

## 검색 전략
키워드: ${strategy.keywords.join(', ')}
초점: ${strategy.focus}
학술 출처 필요: ${strategy.academicRequired ? '예' : '아니오'}

## 원문 맥락:
${originalContent.substring(0, 1000)}

## 검증 수행
1. 이 주장이 공식적으로 확인된 정보인가?
2. 출처가 있다면 어떤 신뢰도 계층인가?
3. 수치/날짜가 정확한가?
4. 루머나 추측인가?

## 응답 형식 (JSON만):
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "confidenceReason": "확신도 산정 근거",
  "notes": "검증 결과 설명",
  "correctedText": "수정이 필요한 경우만 (선택)",
  "sources": [
    {
      "url": "실제 URL",
      "title": "출처 제목",
      "tier": "S|A|B|C",
      "publishDate": "YYYY-MM-DD (알 수 있는 경우)"
    }
  ],
  "isRumor": true/false,
  "needsMoreVerification": true/false
}

## 중요
- 확신도 90% 미만이면 verified를 false로
- 출처 URL을 모르면 sources를 빈 배열로
- 절대 가짜 URL 생성 금지

JSON만 응답하세요.`;

  try {
    // Use model with Google Search tool for verification
    const model = genAI.getGenerativeModel({ 
      model: MODEL,
      tools: [{ googleSearch: {} }]
    });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);

      // Convert sources to VerifiedSource objects with proper tier classification
      const sources: VerifiedSource[] = (result.sources || [])
        .filter((s: any) => s.url && s.url.startsWith('http'))
        .map((s: any) =>
          createVerifiedSource(s.url, s.title || 'Unknown', s.publishDate)
        );

      // Apply 90% threshold rule
      const meetsThreshold = result.confidence >= 0.9;

      return {
        verified: meetsThreshold ? result.verified : false,
        confidence: result.confidence,
        notes: result.notes + (result.confidenceReason ? ` (${result.confidenceReason})` : ''),
        correctedText: result.correctedText,
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
 * Translate with SearchMode quality standards
 */
export async function translateToEnglish(
  title: string,
  content: string
): Promise<{ title_en: string; content_en: string }> {
  const prompt = `다음 한국어 기술/AI 관련 글을 영어로 번역해주세요.

## 번역 규칙:
1. 기술 용어는 표준 영어 용어 사용 (예: 언어모델 → Language Model)
2. 제품명/회사명은 그대로 유지 (GPT-4, Claude, OpenAI 등)
3. 코드 블록, URL은 그대로 유지
4. 비격식체 한국어는 전문적인 영어로 변환
5. 한국 특유의 표현은 간단한 설명 추가
6. 추측성 표현은 그대로 번역 (검증 여부 표시용)

## 원문 제목:
${title}

## 원문 내용:
${content.substring(0, 4000)}

## 응답 형식 (JSON):
{
  "title_en": "영어 제목",
  "content_en": "영어 본문"
}

JSON만 응답하세요.`;

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      title_en: title,
      content_en: content,
    };
  } catch (error) {
    console.error('Error translating:', error);
    return {
      title_en: title,
      content_en: content,
    };
  }
}

/**
 * Generate verification summary with SearchMode formatting
 */
export function generateVerificationSummary(
  claims: any[],
  overallScore: number
): string {
  const tierCounts = { S: 0, A: 0, B: 0, C: 0 };
  const allSources: VerifiedSource[] = [];

  for (const claim of claims) {
    if (claim.sources) {
      for (const source of claim.sources) {
        tierCounts[source.tier as keyof typeof tierCounts]++;
        allSources.push(source);
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
