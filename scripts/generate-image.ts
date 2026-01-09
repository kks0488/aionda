import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const API_KEY = process.env.GEMINI_API_KEY || '';
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

if (!API_KEY) {
  console.error('GEMINI_API_KEY not found');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

interface ImagePrompt {
  slug: string;
  title: string;
  description: string;
}

const posts: ImagePrompt[] = [
  {
    slug: 'alleged-grok-420-esque-model-appears-in-design-arena',
    title: 'Grok 4.20 on LMArena',
    description: 'A futuristic AI arena with glowing neural networks, leaderboard displays, and competing AI models represented as abstract geometric shapes. Dark blue and purple gradient background with neon accents.'
  },
  {
    slug: 'a-helpful-way-to-think-about-llms',
    title: 'LLM as Cognitive Extension',
    description: 'Abstract visualization of human mind merging with AI. Brain silhouette with flowing data streams connecting to a glowing orb representing AI. Soft gradients of blue and teal. Minimalist style.'
  },
  {
    slug: 'how-should-education-transform-in-the-age-of-ai',
    title: 'AI Education Future',
    description: 'Children in a futuristic classroom with holographic displays and AI assistants. Warm lighting with digital elements floating around. Balance between technology and human connection.'
  }
];

async function generateImage(prompt: ImagePrompt): Promise<void> {
  console.log(`Generating image for: ${prompt.title}`);

  try {
    const model = genAI.getGenerativeModel({ model: IMAGE_MODEL });

    const imagePrompt = `Create a blog header image (16:9 aspect ratio): ${prompt.description}.
    Style: Modern tech blog aesthetic, clean, professional.
    No text in the image.`;

    const result = await model.generateContent(imagePrompt);
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

          const outputPath = path.join(outputDir, `${prompt.slug}.${extension}`);
          fs.writeFileSync(outputPath, Buffer.from(imageData, 'base64'));

          console.log(`Saved: ${outputPath}`);
          return;
        }
      }
    }

    console.log(`No image data in response for: ${prompt.title}`);
    console.log('Response:', JSON.stringify(response, null, 2));

  } catch (error) {
    console.error(`Error generating image for ${prompt.title}:`, error);
  }
}

async function main() {
  console.log('Starting image generation...\n');

  for (const post of posts) {
    await generateImage(post);
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\nDone!');
}

main();
