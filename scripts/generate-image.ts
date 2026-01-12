import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

config({ path: '.env.local' });

const AI_API_DISABLED = ['true', '1'].includes(
  (process.env.AI_API_DISABLED || '').toLowerCase()
);
// GitHub Actions에서는 GOOGLE_AI_API_KEY, 로컬에서는 GEMINI_API_KEY 사용
const API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = 'gemini-2.5-flash-image';
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

if (!API_KEY) {
  console.error('GOOGLE_AI_API_KEY or GEMINI_API_KEY not found');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

interface PostMeta {
  slug: string;
  title: string;
  description: string;
  tags: string[];
  locale: string;
  filePath: string;
}

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

      // Only add once per slug (prefer EN)
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);

      posts.push({
        slug,
        title: data.title || slug,
        description: data.description || '',
        tags: data.tags || [],
        locale,
        filePath,
      });
    }
  }

  return posts;
}

/**
 * Generate descriptive image prompt following Gemini best practices:
 * - Describe scenes in paragraphs, not keyword lists
 * - Use photography terminology (lens, lighting, angles)
 * - Be very specific with context and intent
 */
function generatePromptForPost(post: PostMeta): string {
  // Determine visual theme based on tags
  const tagSet = new Set(post.tags.map(t => t.toLowerCase()));

  let themeColor = 'deep blue and cyan';
  let visualElement = 'neural network nodes connected by glowing data streams';

  if (tagSet.has('openai') || tagSet.has('gpt') || tagSet.has('chatgpt')) {
    themeColor = 'emerald green and teal';
    visualElement = 'interconnected geometric shapes forming an abstract brain-like structure';
  } else if (tagSet.has('anthropic') || tagSet.has('claude')) {
    themeColor = 'warm amber and coral orange';
    visualElement = 'flowing organic curves suggesting intelligent conversation';
  } else if (tagSet.has('google') || tagSet.has('gemini')) {
    themeColor = 'royal blue and electric purple';
    visualElement = 'crystalline structures with internal light refraction';
  } else if (tagSet.has('research') || tagSet.has('paper')) {
    themeColor = 'silver and platinum white';
    visualElement = 'abstract mathematical symbols floating in space';
  }

  // Build descriptive paragraph (Gemini best practice: describe scenes, not keywords)
  return `Imagine a cinematic wide-angle shot of an abstract digital landscape for a premium technology blog. The scene depicts ${visualElement}, rendered in ${themeColor} tones against a deep dark gradient background that transitions from near-black at the edges to a subtle ${themeColor.split(' and ')[0]} glow at the center.

The composition uses professional photography principles: a wide-angle perspective creates depth, with elements gradually fading into soft bokeh in the background. Soft diffused lighting illuminates the central elements from above, creating subtle highlights and long shadows that add dimension.

The overall mood is sophisticated and forward-thinking, similar to the visual identity of companies like Vercel, Stripe, or Linear. The image conveys the concept of "${post.title}" through abstract visual metaphor rather than literal representation.

Technical specifications: 16:9 aspect ratio, no text overlays, no human figures, no corporate logos. The style should be minimalist yet visually striking, suitable as a hero image for a high-quality tech publication.`;
}

async function generateImage(post: PostMeta): Promise<string | null> {
  console.log(`\n🎨 Generating image for: ${post.title}`);

  try {
    const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });
    const prompt = generatePromptForPost(post);

    const result = await model.generateContent(prompt);
    const response = await result.response;

    // Check if response contains image data
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if ('inlineData' in part && part.inlineData) {
          const imageData = part.inlineData.data;
          const mimeType = part.inlineData.mimeType;
          const extension = mimeType?.split('/')[1] || 'png';

          const outputDir = path.join(process.cwd(), 'apps/web/public/images/posts');
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const outputPath = path.join(outputDir, `${post.slug}.${extension}`);
          fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));

          console.log(`✅ Saved: ${outputPath}`);
          return `/images/posts/${post.slug}.${extension}`;
        }
      }
    }

    console.log(`❌ No image data in response for: ${post.title}`);
    return null;

  } catch (error: any) {
    console.error(`❌ Error generating image for ${post.title}:`, error.message);
    return null;
  }
}

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
  console.log(`📷 Using model: ${IMAGE_MODEL}\n`);

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
      console.log('⏳ Waiting 5 seconds...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Image generation complete!');
}

main().catch(console.error);
