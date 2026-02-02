/**
 * AI-Powered Cover Image Generator
 *
 * Uses Gemini to analyze article content and generate contextual image prompts,
 * then SiliconFlow API to create the actual images.
 *
 * Pipeline: analyze article → generate prompt → create image
 */

import { config } from 'dotenv';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { generateContent } from './lib/ai-text';
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
const ENABLE_LOCAL_IMAGE_FALLBACK = process.env.ENABLE_LOCAL_IMAGE_FALLBACK !== 'false';

const SILICONFLOW_REQUEST_TIMEOUT_MS = 120_000;
const SILICONFLOW_DOWNLOAD_TIMEOUT_MS = 30_000;
const SILICONFLOW_MAX_RETRIES = 2;

if (AI_API_DISABLED) {
  console.log('AI API is disabled via AI_API_DISABLED=true.');
  process.exit(0);
}

if (!ENABLE_COVER_IMAGES || !ENABLE_IMAGE_GENERATION) {
  console.log('Image generation is disabled. Set ENABLE_IMAGE_GENERATION=true to run this script.');
  process.exit(0);
}

if (!SILICONFLOW_API_KEY && !ENABLE_LOCAL_IMAGE_FALLBACK) {
  console.error('SILICONFLOW_API_KEY not found and local fallback disabled (ENABLE_LOCAL_IMAGE_FALLBACK=false)');
  process.exit(1);
}

if (!SILICONFLOW_API_KEY && ENABLE_LOCAL_IMAGE_FALLBACK) {
  console.warn('SILICONFLOW_API_KEY not found. Falling back to local placeholder images.');
}

interface PostMeta {
  slug: string;
  title: string;
  excerpt: string;
  tags: string[];
  locale: string;
  filePath: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'name' in error && (error as { name?: unknown }).name === 'AbortError';
}

function extractErrorText(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (isAbortError(error)) return true;
  const msg = extractErrorText(error).toLowerCase();
  return /(fetch failed|socket hang up|econnreset|etimedout|eai_again|enotfound|econnrefused)/i.test(msg);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithRetry<T>(
  url: string,
  init: RequestInit,
  options: { label: string; timeoutMs: number; retries: number }
): Promise<{ response: Response; json: T | null; text: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, init, options.timeoutMs);
      const text = await response.text();

      if (!response.ok && isRetryableStatus(response.status) && attempt < options.retries) {
        const backoffMs = Math.min(30_000, 1500 * 2 ** attempt) + Math.floor(Math.random() * 600);
        console.warn(
          `[SiliconFlow] ${options.label} HTTP ${response.status}. Retrying after ${backoffMs}ms... (${attempt + 1}/${options.retries})`
        );
        await sleep(backoffMs);
        continue;
      }

      let json: T | null = null;
      if (text.trim().length > 0) {
        try {
          json = JSON.parse(text) as T;
        } catch {
          json = null;
        }
      }

      return { response, json, text };
    } catch (error) {
      lastError = error;
      if (isRetryableNetworkError(error) && attempt < options.retries) {
        const backoffMs = Math.min(30_000, 1500 * 2 ** attempt) + Math.floor(Math.random() * 600);
        console.warn(
          `[SiliconFlow] ${options.label} network error. Retrying after ${backoffMs}ms... (${attempt + 1}/${options.retries})`
        );
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

async function fetchBufferWithRetry(url: string, options: { timeoutMs: number; retries: number; label: string }): Promise<Buffer> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, { method: 'GET' }, options.timeoutMs);
      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        if (isRetryableStatus(response.status) && attempt < options.retries) {
          const backoffMs = Math.min(20_000, 1200 * 2 ** attempt) + Math.floor(Math.random() * 600);
          console.warn(
            `[SiliconFlow] ${options.label} download HTTP ${response.status}. Retrying after ${backoffMs}ms... (${attempt + 1}/${options.retries})`
          );
          await sleep(backoffMs);
          continue;
        }
        throw new Error(`Download failed (HTTP ${response.status}): ${body}`);
      }

      const buf = Buffer.from(await response.arrayBuffer());
      if (buf.length < 1024) {
        throw new Error(`Downloaded image too small (${buf.length} bytes)`);
      }
      return buf;
    } catch (error) {
      lastError = error;
      if (isRetryableNetworkError(error) && attempt < options.retries) {
        const backoffMs = Math.min(20_000, 1200 * 2 ** attempt) + Math.floor(Math.random() * 600);
        console.warn(
          `[SiliconFlow] ${options.label} download network error. Retrying after ${backoffMs}ms... (${attempt + 1}/${options.retries})`
        );
        await sleep(backoffMs);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function parseCsvArg(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const slugArg = args.find((a) => a.startsWith('--slug='));
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const all = args.includes('--all');

  const slugs = parseCsvArg(slugArg ? slugArg.split('=')[1] : undefined);
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] || '', 10) : undefined;

  return {
    slugs: new Set(slugs),
    all,
    limit: Number.isFinite(limit) && (limit as number) > 0 ? (limit as number) : undefined,
  };
}

function readLastWrittenSlugs(): string[] {
  const repoRoot = process.cwd();
  const lastWrittenPath = path.join(repoRoot, '.vc', 'last-written.json');
  if (!fs.existsSync(lastWrittenPath)) return [];

  try {
    const raw = fs.readFileSync(lastWrittenPath, 'utf8');
    const parsed = JSON.parse(raw) as any;

    const slugs: string[] = [];
    if (Array.isArray(parsed?.entries)) {
      for (const entry of parsed.entries) {
        if (entry && typeof entry.slug === 'string' && entry.slug.trim().length > 0) {
          slugs.push(entry.slug.trim());
        }
      }
    }

    if (slugs.length === 0 && Array.isArray(parsed?.files)) {
      for (const file of parsed.files) {
        if (!file || typeof file !== 'string') continue;
        const base = path.basename(file).replace(/\.mdx?$/, '');
        if (base) slugs.push(base);
      }
    }

    return Array.from(new Set(slugs));
  } catch {
    return [];
  }
}

/**
 * Find posts that need cover images
 */
function getPostsWithoutImages(options?: { slugs?: Set<string> }): PostMeta[] {
  const postsDir = path.join(process.cwd(), 'apps/web/content/posts');
  const posts: PostMeta[] = [];
  const allowedSlugs = options?.slugs && options.slugs.size > 0 ? options.slugs : null;

  const publicDir = path.join(process.cwd(), 'apps/web/public');
  const imagesDir = path.join(publicDir, 'images', 'posts');

  const hasImageForSlug = (slug: string, coverImage?: unknown) => {
    const candidates = [
      path.join(imagesDir, `${slug}.png`),
      path.join(imagesDir, `${slug}.jpg`),
      path.join(imagesDir, `${slug}.jpeg`),
      path.join(imagesDir, `${slug}.webp`),
      path.join(imagesDir, `${slug}.avif`),
    ];
    if (candidates.some((p) => fs.existsSync(p))) return true;
    if (typeof coverImage !== 'string' || !coverImage.trim()) return false;
    const rel = coverImage.startsWith('/') ? coverImage.slice(1) : coverImage;
    return fs.existsSync(path.join(publicDir, rel));
  };

  const readPostMeta = (locale: string, slug: string): { meta: PostMeta | null; coverImage?: unknown } => {
    for (const ext of ['.mdx', '.md']) {
      const filePath = path.join(postsDir, locale, `${slug}${ext}`);
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);
      return {
        meta: {
          slug,
          title: data.title || slug,
          excerpt: data.excerpt || data.description || '',
          tags: data.tags || [],
          locale,
          filePath,
        },
        coverImage: data.coverImage,
      };
    }
    return { meta: null };
  };

  // Deterministic ordering for explicitly provided slugs.
  if (allowedSlugs) {
    const ordered = Array.from(allowedSlugs);
    for (const slug of ordered) {
      const en = readPostMeta('en', slug);
      const ko = readPostMeta('ko', slug);
      const chosen = en.meta || ko.meta;
      const cover = en.coverImage || ko.coverImage;
      if (!chosen) continue;
      if (hasImageForSlug(slug, cover)) {
        console.log(`⏭️ Skip (image exists): ${slug}`);
        continue;
      }
      posts.push(chosen);
    }
    return posts;
  }

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

function generateLocalFallbackImage(post: PostMeta): string | null {
  const outputDir = path.join(process.cwd(), 'apps/web/public/images/posts');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${post.slug}.png`);
  const scriptPath = path.join(process.cwd(), 'scripts/lib/local-cover-image.py');
  const timeoutMs = 30_000;

  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ Local image generator script not found: ${scriptPath}`);
    return null;
  }

  try {
    const args = [scriptPath, '--slug', post.slug, '--output', outputPath];

    const runPython = (cmd: string) =>
      spawnSync(cmd, args, { encoding: 'utf-8', timeout: timeoutMs });

    let result = runPython('python');
    const errCode = (result.error as any)?.code;
    if (errCode === 'ENOENT') {
      result = runPython('python3');
    }

    if (result.error) {
      const details = extractErrorText(result.error);
      console.error(`❌ Local image generation failed to start: ${details}`);
      return null;
    }

    if (result.status !== 0) {
      const details = (result.stderr || result.stdout || '').trim();
      const exitHint = result.signal ? `signal ${result.signal}` : `exit ${result.status}`;
      console.error(`❌ Local image generation failed: ${details || exitHint}`);
      return null;
    }

    if (!fs.existsSync(outputPath)) {
      console.error('❌ Local image generation did not create output file');
      return null;
    }

    console.log(`✅ Saved (local): ${outputPath}`);
    return `/images/posts/${post.slug}.png`;
  } catch (error: any) {
    console.error('❌ Local image generation error:', error?.message || String(error));
    return null;
  }
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

    if (!SILICONFLOW_API_KEY) {
      if (!ENABLE_LOCAL_IMAGE_FALLBACK) {
        console.error('❌ SILICONFLOW_API_KEY not configured');
        return null;
      }
      return generateLocalFallbackImage(post);
    }

    const { response, json, text } = await fetchJsonWithRetry<{ images?: Array<{ url?: string; b64_json?: string }> }>(
      SILICONFLOW_API_URL,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
        },
        body: JSON.stringify({
          model: IMAGE_MODEL,
          prompt: prompt,
          negative_prompt:
            'text, letters, words, numbers, watermark, logo, signature, label, caption, title, subtitle, writing, font, typography, alphabet, characters, symbols, icons with text, blurry, low quality',
          image_size: '1024x576', // 16:9 aspect ratio
          num_inference_steps: 8,
          batch_size: 1,
        }),
      },
      { label: 'generate', timeoutMs: SILICONFLOW_REQUEST_TIMEOUT_MS, retries: SILICONFLOW_MAX_RETRIES }
    );

    if (!response.ok) {
      const errorText = (text || '').trim().slice(0, 800);
      console.error(`❌ API Error (${response.status}): ${errorText}`);
      if (ENABLE_LOCAL_IMAGE_FALLBACK) {
        console.log('↩️ Falling back to local placeholder image...');
        return generateLocalFallbackImage(post);
      }
      return null;
    }

    const data = json;
    if (!data) {
      console.error(`❌ API returned non-JSON response`);
      if (ENABLE_LOCAL_IMAGE_FALLBACK) {
        console.log('↩️ Falling back to local placeholder image...');
        return generateLocalFallbackImage(post);
      }
      return null;
    }

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
        const imageBuffer = await fetchBufferWithRetry(imageInfo.url, {
          label: 'image',
          timeoutMs: SILICONFLOW_DOWNLOAD_TIMEOUT_MS,
          retries: 2,
        });
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
    if (ENABLE_LOCAL_IMAGE_FALLBACK) {
      console.log('↩️ Falling back to local placeholder image...');
      return generateLocalFallbackImage(post);
    }
    return null;

  } catch (error: any) {
    console.error(`❌ Error generating image for ${post.title}:`, error.message);
    if (ENABLE_LOCAL_IMAGE_FALLBACK) {
      console.log('↩️ Falling back to local placeholder image...');
      return generateLocalFallbackImage(post);
    }
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

  const { slugs, limit, all } = parseArgs();

  const effectiveSlugs =
    slugs.size > 0
      ? slugs
      : all
        ? undefined
        : (() => {
            const lastWritten = readLastWrittenSlugs();
            return lastWritten.length > 0 ? new Set(lastWritten) : undefined;
          })();

  if (effectiveSlugs && effectiveSlugs.size > 0) {
    console.log(`🎯 Target slugs: ${Array.from(effectiveSlugs).join(', ')}`);
  } else {
    console.log(`🎯 Target slugs: (all missing images)${all ? ' [--all]' : ''}`);
  }

  const posts = getPostsWithoutImages({ slugs: effectiveSlugs });

  if (posts.length === 0) {
    console.log('✨ All posts already have images!');
    return;
  }

  const limitedPosts = limit ? posts.slice(0, limit) : posts;

  console.log(`\n📋 Found ${limitedPosts.length} posts needing images:\n`);
  limitedPosts.forEach((p, i) => console.log(`  ${i + 1}. ${p.title}`));

  console.log('\n' + '='.repeat(60) + '\n');

  for (let i = 0; i < limitedPosts.length; i++) {
    const post = limitedPosts[i];
    console.log(`[${i + 1}/${limitedPosts.length}] Processing...`);

    const imagePath = await generateImage(post);

    if (imagePath) {
      // Update both EN and KO versions
      updatePostFrontmatter('en', post.slug, imagePath);
      updatePostFrontmatter('ko', post.slug, imagePath);
    }

    // Rate limiting: wait between requests
    if (i < limitedPosts.length - 1) {
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Image generation complete!');
}

main().catch(console.error);
