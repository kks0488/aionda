import { generateContent } from './gemini';
import {
  ArticleType,
  CLASSIFY_PROMPT,
  STRUCTURE_PROMPTS,
  HEADLINE_PROMPT,
  TRANSLATE_STRUCTURED_PROMPT,
} from '../prompts/structure';

/**
 * Classify article type (news, analysis, opinion)
 */
export async function classifyArticle(
  content: string
): Promise<{ type: ArticleType; reason: string }> {
  const prompt = CLASSIFY_PROMPT.replace('{content}', content.substring(0, 2000));

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (['news', 'analysis', 'opinion'].includes(result.type)) {
        return result;
      }
    }
    return { type: 'news', reason: 'Default classification' };
  } catch (error) {
    console.error('Error classifying article:', error);
    return { type: 'news', reason: 'Classification failed' };
  }
}

/**
 * Structure content according to article type using AI
 */
export async function structureContent(
  rawContent: string,
  articleType: ArticleType
): Promise<string> {
  const prompt = STRUCTURE_PROMPTS[articleType].replace(
    '{content}',
    rawContent.substring(0, 6000)
  );

  try {
    const response = await generateContent(prompt);
    // Clean up any markdown code blocks wrapper
    let structured = response
      .replace(/^```markdown\n?/i, '')
      .replace(/^```md\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    return structured;
  } catch (error) {
    console.error('Error structuring content:', error);
    // Fallback: basic cleanup
    return basicStructure(rawContent);
  }
}

/**
 * Generate headlines for the article
 */
export async function generateHeadlines(
  content: string
): Promise<{ headline_en: string; headline_ko: string }> {
  const prompt = HEADLINE_PROMPT.replace('{content}', content.substring(0, 2000));

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return {
      headline_en: 'Untitled',
      headline_ko: '제목 없음',
    };
  } catch (error) {
    console.error('Error generating headlines:', error);
    return {
      headline_en: 'Untitled',
      headline_ko: '제목 없음',
    };
  }
}

/**
 * Translate structured Korean content to English
 */
export async function translateStructured(content: string): Promise<string> {
  const prompt = TRANSLATE_STRUCTURED_PROMPT.replace(
    '{content}',
    content.substring(0, 6000)
  );

  try {
    const response = await generateContent(prompt);
    // Clean up any markdown code blocks wrapper
    let translated = response
      .replace(/^```markdown\n?/i, '')
      .replace(/^```md\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();

    return translated;
  } catch (error) {
    console.error('Error translating structured content:', error);
    return content;
  }
}

/**
 * Full structuring pipeline
 */
export async function structureArticle(
  rawContent: string,
  originalTitle: string
): Promise<{
  type: ArticleType;
  content_ko: string;
  content_en: string;
  title_ko: string;
  title_en: string;
}> {
  console.log('  📊 Classifying article type...');
  const { type, reason } = await classifyArticle(rawContent);
  console.log(`     Type: ${type} (${reason})`);

  console.log('  📝 Structuring Korean content...');
  const content_ko = await structureContent(rawContent, type);

  console.log('  🌐 Translating to English...');
  const content_en = await translateStructured(content_ko);

  console.log('  📰 Generating headlines...');
  const { headline_en, headline_ko } = await generateHeadlines(content_ko);

  return {
    type,
    content_ko,
    content_en,
    title_ko: headline_ko || originalTitle,
    title_en: headline_en || originalTitle,
  };
}

/**
 * Basic structure fallback (no AI)
 */
function basicStructure(content: string): string {
  // Remove HTML tags
  let clean = content.replace(/<[^>]*>/g, '');

  // Normalize whitespace
  clean = clean.replace(/\n{3,}/g, '\n\n');

  // Split into paragraphs
  const paragraphs = clean.split(/\n\n+/).filter((p) => p.trim());

  // Basic structure
  const structured: string[] = [];

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i].trim();
    if (!para) continue;

    // First paragraph is lead
    if (i === 0) {
      structured.push(para);
      structured.push('');
      continue;
    }

    // Add sections for longer articles
    if (i === 3 && paragraphs.length > 5) {
      structured.push('## 배경');
      structured.push('');
    }
    if (i === 6 && paragraphs.length > 8) {
      structured.push('## 전망');
      structured.push('');
    }

    structured.push(para);
    structured.push('');
  }

  return structured.join('\n').trim();
}
