import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';
import { translateToEnglish } from './lib/gemini.js';

config({ path: '.env.local' });

const VERIFIED_DIR = './data/verified';

interface VerifiedPost {
  id: string;
  title: string;
  contentText: string;
  translation?: {
    title_en: string;
    title_ko: string;
    content_en: string;
    content_ko: string;
    translatedAt: string;
    slug: string;
  };
  [key: string]: unknown;
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60)
    .replace(/-$/, '')
    .replace(/^-/, '');
}

async function translatePost(post: VerifiedPost): Promise<VerifiedPost> {
  if (post.translation?.title_en && post.translation?.content_en) {
    console.log('  ⏭️  Already translated, skipping...');
    return post;
  }

  console.log('  🔄 Translating with Gemini...');

  try {
    const { title_en, content_en } = await translateToEnglish(
      post.title,
      post.contentText
    );

    const slug = generateSlug(title_en) || post.id;

    console.log(`  📝 Title: "${title_en.substring(0, 50)}..."`);

    return {
      ...post,
      translation: {
        title_en,
        title_ko: post.title,
        content_en,
        content_ko: post.contentText,
        translatedAt: new Date().toISOString(),
        slug,
      },
    };
  } catch (error) {
    console.error('  ❌ Translation error:', error);
    // Fallback to original content
    return {
      ...post,
      translation: {
        title_en: post.title,
        title_ko: post.title,
        content_en: post.contentText,
        content_ko: post.contentText,
        translatedAt: new Date().toISOString(),
        slug: post.id,
      },
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith('--id='));
  const targetId = idArg ? idArg.split('=')[1] : undefined;

  if (!existsSync(VERIFIED_DIR)) {
    console.log('❌ No verified posts found. Run `pnpm verify` first.');
    process.exit(1);
  }

  let files = readdirSync(VERIFIED_DIR).filter((f) => f.endsWith('.json'));

  if (targetId) {
    files = files.filter((f) => f.replace('.json', '') === targetId);
    if (files.length === 0) {
      console.log(`❌ Post ${targetId} not found in verified/`);
      process.exit(1);
    }
  }

  // Filter out already translated posts
  const postsToTranslate = files.filter((file) => {
    const post = JSON.parse(
      readFileSync(join(VERIFIED_DIR, file), 'utf-8')
    ) as VerifiedPost;
    return !post.translation?.title_en;
  });

  if (postsToTranslate.length === 0) {
    console.log('✅ All verified posts have been translated.');
    process.exit(0);
  }

  console.log(`\n🌐 Translating ${postsToTranslate.length} post(s) with Gemini AI...\n`);

  for (const file of postsToTranslate) {
    const postId = file.replace('.json', '');
    console.log(`📋 Post ${postId}:`);

    const post = JSON.parse(
      readFileSync(join(VERIFIED_DIR, file), 'utf-8')
    ) as VerifiedPost;

    const translated = await translatePost(post);

    writeFileSync(join(VERIFIED_DIR, file), JSON.stringify(translated, null, 2));
    console.log('  ✅ Saved');
    console.log('');

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('✨ Done! Translations saved to data/verified/');
  console.log('Next step: Run `pnpm generate-post` to create MDX files.');
}

main().catch(console.error);
