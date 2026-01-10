import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

config({ path: '.env.local' });

// GitHub Actions에서는 GOOGLE_AI_API_KEY, 로컬에서는 GEMINI_API_KEY 사용
const API_KEY = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

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

      // Skip if already has cover image
      if (data.coverImage) {
        console.log(`⏭️ Skip (has image): ${slug}`);
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

function generatePromptForPost(post: PostMeta): string {
  const tagContext = post.tags.length > 0
    ? `Related topics: ${post.tags.join(', ')}.`
    : '';

  return `Create a professional blog header image for an AI technology article.

Title: "${post.title}"
${tagContext}

Style requirements:
- Modern, minimalist tech aesthetic similar to Vercel, OpenAI, or Anthropic blogs
- Dark gradient background with deep blue, purple, or dark teal colors
- Abstract, conceptual visualization representing AI and technology
- Subtle geometric patterns, flowing lines, or neural network abstractions
- Glowing accents in cyan, blue, or purple
- 16:9 aspect ratio composition
- NO text, logos, or human faces
- Professional and clean design suitable for a tech news website

The image should evoke innovation, AI intelligence, and technological progress.`;
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
