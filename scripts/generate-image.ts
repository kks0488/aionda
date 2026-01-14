/**
 * AI-Powered Cover Image Generator
 *
 * Uses Gemini to analyze article content and generate contextual image prompts,
 * then SiliconFlow API to create the actual images.
 *
 * Pipeline: analyze article → generate prompt → create image
 */

import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { generateContent } from './lib/gemini';
import { GENERATE_IMAGE_PROMPT_PROMPT } from './prompts/topics';

config({ path: '.env.local' });

const AI_API_DISABLED = ['true', '1'].includes(
  (process.env.AI_API_DISABLED || '').toLowerCase()
);

// SiliconFlow API
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'Qwen/Qwen-Image';
const SILICONFLOW_API_URL = 'https://api.siliconflow.com/v1/images/generations';

const ENABLE_COVER_IMAGES = process.env.ENABLE_COVER_IMAGES !== 'false';
const ENABLE_IMAGE_GENERATION = process.env.ENABLE_IMAGE_GENERATION === 'true';

if (AI_API_DISABLED) {
  console.log('AI API is disabled via AI_API_DISABLED=true.');
  process.exit(0);
}

if (!ENABLE_COVER_IMAGES || !ENABLE_IMAGE_GENERATION) {
  console.log('Image generation is disabled. Set ENABLE_IMAGE_GENERATION=true to run this script.');
  process.exit(0);
}

if (!SILICONFLOW_API_KEY) {
  console.error('SILICONFLOW_API_KEY not found');
  process.exit(1);
}

interface PostMeta {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  locale: string;
  filePath: string;
}

/**
 * Find posts that need cover images
 */
function getPostsWithoutImages(): PostMeta[] {
  const postsDir = path.join(process.cwd(), 'apps/web/content/posts');
  const posts: PostMeta[] = [];
  const seenSlugs = new Set<string>();

  for (const locale of ['en', 'ko']) {
    const localeDir = path.join(postsDir, locale);
    if (!fs.existsSync(localeDir)) continue;

    const files = fs.readdirSync(localeDir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(localeDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      const slug = file.replace(/\.mdx?$/, '');

      let hasImage = false;
      if (data.coverImage) {
        const imagePathRel = data.coverImage.startsWith('/') ? data.coverImage.slice(1) : data.coverImage;
        const absolutePath = path.join(process.cwd(), 'apps/web/public', imagePathRel);
        if (fs.existsSync(absolutePath)) {
          hasImage = true;
        }
      }

      if (hasImage) {
        console.log(`⏭️ Skip (image exists): ${slug}`);
        continue;
      }

      // Only add once per slug (prefer EN for analysis)
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      posts.push({
        slug,
        title: data.title || slug,
        excerpt: data.excerpt || data.description || '',
        tags: data.tags || [],
        locale,
        filePath,
      });
    }
  }

  return posts;
}

/**
 * Generate image prompt using Gemini AI
 */
async function generateImagePromptWithAI(post: PostMeta): Promise<string> {
  const prompt = GENERATE_IMAGE_PROMPT_PROMPT
    .replace('{title}', post.title)
    .replace('{excerpt}', post.excerpt);

  try {
    const response = await generateContent(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      if (result.imagePrompt) {
        return result.imagePrompt;
      }
    }
  } catch (error: any) {
    console.log(`    ⚠️ AI prompt generation failed: ${error.message}`);
  }

  // Fallback to generic prompt if AI fails
  return generateFallbackPrompt(post);
}

/**
 * Fallback prompt generator (if AI fails)
 */
function generateFallbackPrompt(post: PostMeta): string {
  // Extract key concepts from title
  const title = post.title.toLowerCase();

  // Simple keyword-based visual selection
  let visual = 'abstract technology visualization with flowing data streams';

  if (title.includes('robot') || title.includes('humanoid')) {
    visual = 'sleek humanoid robot silhouette with glowing joints in industrial setting';
  } else if (title.includes('career') || title.includes('job') || title.includes('work')) {
    visual = 'human silhouettes on fragmented corporate platforms with digital elements';
  } else if (title.includes('model') || title.includes('llm') || title.includes('gpt') || title.includes('claude')) {
    visual = 'neural network layers with glowing connections and data flow';
  } else if (title.includes('future') || title.includes('2026') || title.includes('prediction')) {
    visual = 'forward-looking horizon with emerging technology structures';
  } else if (title.includes('code') || title.includes('developer') || title.includes('programming')) {
    visual = 'floating code fragments transforming into abstract patterns';
  }

  return `Cinematic digital art, ${visual}, deep blue and cyan color palette, dark gradient background, futuristic tech aesthetic, sophisticated mood, dramatic volumetric lighting, subtle glow effects, 16:9 composition, abstract conceptual visualization, ultra high quality render`;
}

/**
 * Generate image using SiliconFlow API
 */
async function generateImage(post: PostMeta): Promise<string | null> {
  console.log(`\n🎨 Generating image for: ${post.title}`);
  console.log(`📷 Using model: ${IMAGE_MODEL}`);

  try {
    // Generate prompt with AI
    console.log(`🤖 Generating prompt with AI...`);
    const prompt = await generateImagePromptWithAI(post);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    const response = await fetch(SILICONFLOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
      },
      body: JSON.stringify({
        model: IMAGE_MODEL,
        prompt: prompt,
        negative_prompt: 'text, letters, words, numbers, watermark, logo, signature, label, caption, title, subtitle, writing, font, typography, alphabet, characters, symbols, icons with text, blurry, low quality',
        image_size: '1024x576', // 16:9 aspect ratio
        num_inference_steps: 8,
        batch_size: 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}): ${errorText}`);
      return null;
    }

    const data = await response.json() as { images?: Array<{ url?: string; b64_json?: string }> };

    // SiliconFlow returns images in data.images array with url or b64_json
    if (data.images && data.images.length > 0) {
      const imageInfo = data.images[0];

      const outputDir = path.join(process.cwd(), 'apps/web/public/images/posts');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const outputPath = path.join(outputDir, `${post.slug}.png`);

      if (imageInfo.url) {
        // Download from URL
        const imageResponse = await fetch(imageInfo.url);
        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        fs.writeFileSync(outputPath, imageBuffer);
      } else if (imageInfo.b64_json) {
        // Decode base64
        fs.writeFileSync(outputPath, Buffer.from(imageInfo.b64_json, 'base64'));
      } else {
        console.log(`❌ No image data in response`);
        return null;
      }

      console.log(`✅ Saved: ${outputPath}`);
      return `/images/posts/${post.slug}.png`;
    }

    console.log(`❌ No images in response for: ${post.title}`);
    return null;

  } catch (error: any) {
    console.error(`❌ Error generating image for ${post.title}:`, error.message);
    return null;
  }
}

/**
 * Update post frontmatter with cover image
 */
function updatePostFrontmatter(locale: string, slug: string, imagePath: string) {
  const postsDir = path.join(process.cwd(), 'apps/web/content/posts');

  for (const ext of ['.mdx', '.md']) {
    const filePath = path.join(postsDir, locale, `${slug}${ext}`);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const { data, content: body } = matter(content);
      data.coverImage = imagePath;
      const newContent = matter.stringify(body, data);
      fs.writeFileSync(filePath, newContent);
      console.log(`📝 Updated: ${filePath}`);
      return true;
    }
  }
  return false;
}

async function main() {
  console.log('🔍 Finding posts without images...\n');
  console.log(`📷 Using model: ${IMAGE_MODEL}`);
  console.log(`🤖 Using AI for prompt generation`);
  console.log(`🌐 API: SiliconFlow\n`);

  const posts = getPostsWithoutImages();

  if (posts.length === 0) {
    console.log('✨ All posts already have images!');
    return;
  }

  console.log(`\n📋 Found ${posts.length} posts needing images:\n`);
  posts.forEach((p, i) => console.log(`  ${i + 1}. ${p.title}`));

  console.log('\n' + '='.repeat(60) + '\n');

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`[${i + 1}/${posts.length}] Processing...`);

    const imagePath = await generateImage(post);

    if (imagePath) {
      // Update both EN and KO versions
      updatePostFrontmatter('en', post.slug, imagePath);
      updatePostFrontmatter('ko', post.slug, imagePath);
    }

    // Rate limiting: wait between requests
    if (i < posts.length - 1) {
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Image generation complete!');
}

main().catch(console.error);
