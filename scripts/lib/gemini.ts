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
 * Gemini 3 optimized: XML tags, few-shot examples, critical rules at top
 */
export async function extractClaims(content: string): Promise<any[]> {
  const prompt = `<task>검증 가능한 사실 주장 추출</task>

<instruction>
반드시 JSON 배열만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 검증 가능한 사실적 주장만 추출
- 추측/의견 제외 ("~인 것 같다", "아마도")
- 구체적 데이터 있는 주장만 (날짜, 수치, 벤치마크)
</critical_rules>

<examples>
입력: "OpenAI가 GPT-5를 12월 1일에 발표했다. 성능이 좋아 보인다."
출력: [{"id": "claim_1", "text": "OpenAI가 GPT-5를 12월 1일에 발표했다", "type": "release_date", "entities": ["OpenAI", "GPT-5"], "searchQueries": ["OpenAI GPT-5 release date", "GPT-5 announcement"], "priority": "high"}]

입력: "Claude가 HumanEval에서 92.3%를 달성했다. 아마 최고일 것이다."
출력: [{"id": "claim_1", "text": "Claude가 HumanEval에서 92.3%를 달성했다", "type": "benchmark", "entities": ["Claude", "HumanEval"], "searchQueries": ["Claude HumanEval score", "Claude benchmark results"], "priority": "high"}]
</examples>

<content>
${content.substring(0, 3000)}
</content>

<output_format>
[{"id": "claim_1", "text": "주장", "type": "release_date|benchmark|pricing|feature|company_statement|comparison|technical_spec|research", "entities": ["관련 엔티티"], "searchQueries": ["검색어1", "검색어2"], "priority": "high|medium|low"}]
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
 * Verify claim with SearchMode protocols
 * Gemini 3 optimized: XML tags, critical rules at top, few-shot example
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

  const prompt = `<task>사실 주장 검증</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 확신도 90% 미만이면 verified: false
- 가짜 URL 생성 절대 금지
- 출처 모르면 sources: []
- Tier S(학술) > A(공식) > B(SNS) > C(일반)
</critical_rules>

<source_tiers>
- S: arxiv, Google Scholar, 공식 논문
- A: .gov, .edu, 공식 블로그, 메이저 언론
- B: SNS, 포럼, 위키, 개인 블로그
- C: 일반 웹사이트
</source_tiers>

<example>
주장: "OpenAI가 GPT-5를 12월 1일에 발표했다"
출력: {"verified": true, "confidence": 0.95, "confidenceReason": "공식 블로그에서 확인", "notes": "OpenAI 공식 발표 확인", "sources": [{"url": "https://openai.com/blog/gpt-5", "title": "Introducing GPT-5", "tier": "A", "publishDate": "2025-12-01"}], "isRumor": false, "needsMoreVerification": false}
</example>

<claim>
주장: "${claim.text}"
유형: ${claim.type}
엔티티: ${claim.entities?.join(', ') || 'N/A'}
</claim>

<search_strategy>
키워드: ${strategy.keywords.join(', ')}
초점: ${strategy.focus}
</search_strategy>

<context>
${originalContent.substring(0, 800)}
</context>

<output_format>
{"verified": true/false, "confidence": 0.0-1.0, "confidenceReason": "근거", "notes": "설명", "correctedText": "수정 필요시만", "sources": [{"url": "URL", "title": "제목", "tier": "S|A|B|C", "publishDate": "YYYY-MM-DD"}], "isRumor": true/false, "needsMoreVerification": true/false}
</output_format>`;

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
 * Gemini 3 optimized: XML tags, few-shot example, critical rules at top
 */
export async function translateToEnglish(
  title: string,
  content: string
): Promise<{ title_en: string; content_en: string }> {
  const prompt = `<task>한→영 기술 글 번역</task>

<instruction>
반드시 JSON 형식으로만 응답하세요. 다른 텍스트 없이 순수 JSON만 출력합니다.
</instruction>

<critical_rules>
- 기술 용어: 표준 영어 (언어모델 → Language Model)
- 제품명/회사명: 그대로 유지 (GPT-4, Claude, OpenAI)
- 코드 블록/URL: 그대로 유지
- 비격식체 → 전문적 영어
</critical_rules>

<example>
입력 제목: "GPT-5 출시, AI 업계 지각변동"
입력 내용: "OpenAI가 드디어 GPT-5를 내놨다. 기존 모델 대비 2배 빠르다고 한다."
출력: {"title_en": "GPT-5 Launch Shakes Up AI Industry", "content_en": "OpenAI has finally released GPT-5. The company claims it runs twice as fast as previous models."}
</example>

<title>
${title}
</title>

<content>
${content.substring(0, 4000)}
</content>

<output_format>
{"title_en": "영어 제목", "content_en": "영어 본문"}
</output_format>`;

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
