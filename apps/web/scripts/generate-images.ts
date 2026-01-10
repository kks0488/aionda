import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const postsDirectory = path.join(process.cwd(), 'content/posts');
const imagesDirectory = path.join(process.cwd(), 'public/images/posts');

interface PostMeta {
  title: string;
  description: string;
  tags: string[];
  slug: string;
  locale: string;
}

async function generateImageForPost(post: PostMeta): Promise<string | null> {
  const prompt = `Create a modern, minimalist tech blog cover image for an article titled "${post.title}".
The image should be:
- Professional and clean design
- Abstract or conceptual visualization related to AI/technology
- Use a dark blue/purple gradient background with subtle tech patterns
- Include subtle visual elements related to: ${post.tags.join(', ')}
- No text or logos
- High-quality, suitable for a tech news website
- 16:9 aspect ratio composition
Style: Modern tech illustration, similar to Vercel or OpenAI blog aesthetics`;

  try {
    console.log(`Generating image for: ${post.title}`);

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1792x1024',
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      console.error(`No image URL returned for: ${post.slug}`);
      return null;
    }

    // Download the image
    const imageResponse = await fetch(imageUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to public folder
    const imagePath = path.join(imagesDirectory, `${post.slug}.webp`);
    fs.writeFileSync(imagePath, buffer);

    console.log(`✓ Saved: ${imagePath}`);
    return `/images/posts/${post.slug}.webp`;
  } catch (error) {
    console.error(`Error generating image for ${post.slug}:`, error);
    return null;
  }
}

async function updatePostFrontmatter(locale: string, slug: string, imagePath: string) {
  const filePath = path.join(postsDirectory, locale, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) {
    // Try .md extension
    const mdPath = path.join(postsDirectory, locale, `${slug}.md`);
    if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, 'utf8');
      const { data, content: body } = matter(content);
      data.coverImage = imagePath;
      const newContent = matter.stringify(body, data);
      fs.writeFileSync(mdPath, newContent);
      console.log(`✓ Updated frontmatter: ${mdPath}`);
      return;
    }
    console.error(`File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const { data, content: body } = matter(content);
  data.coverImage = imagePath;
  const newContent = matter.stringify(body, data);
  fs.writeFileSync(filePath, newContent);
  console.log(`✓ Updated frontmatter: ${filePath}`);
}

async function main() {
  // Ensure images directory exists
  if (!fs.existsSync(imagesDirectory)) {
    fs.mkdirSync(imagesDirectory, { recursive: true });
  }

  const locales = ['en', 'ko'];
  const posts: PostMeta[] = [];

  // Collect all posts that need images
  for (const locale of locales) {
    const localeDir = path.join(postsDirectory, locale);
    if (!fs.existsSync(localeDir)) continue;

    const files = fs.readdirSync(localeDir).filter(f => f.endsWith('.mdx') || f.endsWith('.md'));

    for (const file of files) {
      const filePath = path.join(localeDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(content);

      // Skip if already has cover image
      if (data.coverImage) {
        console.log(`Skipping (has image): ${file}`);
        continue;
      }

      const slug = file.replace(/\.mdx?$/, '');

      // Only generate for English posts to avoid duplicates
      if (locale === 'en') {
        posts.push({
          title: data.title || slug,
          description: data.description || '',
          tags: data.tags || [],
          slug,
          locale,
        });
      }
    }
  }

  console.log(`\nFound ${posts.length} posts needing images\n`);

  // Generate images with rate limiting
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`\n[${i + 1}/${posts.length}] Processing: ${post.slug}`);

    const imagePath = await generateImageForPost(post);

    if (imagePath) {
      // Update both EN and KO versions
      await updatePostFrontmatter('en', post.slug, imagePath);
      await updatePostFrontmatter('ko', post.slug, imagePath);
    }

    // Rate limiting: wait 20 seconds between requests (DALL-E 3 has rate limits)
    if (i < posts.length - 1) {
      console.log('Waiting 20 seconds for rate limit...');
      await new Promise(resolve => setTimeout(resolve, 20000));
    }
  }

  console.log('\n✅ Image generation complete!');
}

main().catch(console.error);
