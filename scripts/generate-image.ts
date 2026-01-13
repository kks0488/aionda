import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

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

// 키워드 → 시각적 요소 매핑
const VISUAL_MAPPINGS: Record<string, { element: string; style: string }> = {
  // 로봇/하드웨어
  robot: { element: 'sleek humanoid robot silhouette with glowing joints', style: 'industrial futuristic' },
  humanoid: { element: 'humanoid figure with articulated limbs and sensors', style: 'mechanical precision' },
  atlas: { element: 'bipedal robot in dynamic pose, industrial setting', style: 'Boston Dynamics aesthetic' },
  optimus: { element: 'sleek humanoid robot with tesla aesthetic', style: 'Tesla design' },
  factory: { element: 'automated assembly line with robotic arms', style: 'industrial automation' },
  manufacturing: { element: 'smart factory floor with automation systems', style: 'Industry 4.0' },
  hardware: { element: 'circuit boards and processors with heat sinks', style: 'tech hardware' },
  chip: { element: 'semiconductor chip with intricate pathways', style: 'microelectronics' },
  gpu: { element: 'graphics processing unit with cooling fans', style: 'high-performance computing' },
  sensor: { element: 'array of sensors emitting detection waves', style: 'IoT sensing' },
  arm: { element: 'robotic arm with precision gripper', style: 'industrial robotics' },

  // Physical AI
  physical: { element: 'robot interacting with real-world objects', style: 'embodied AI' },
  autonomous: { element: 'self-navigating machine in environment', style: 'autonomous systems' },
  embodied: { element: 'AI manifested in physical form', style: 'embodied intelligence' },

  // AI/소프트웨어
  agent: { element: 'autonomous digital entity navigating data streams', style: 'agentic AI' },
  cowork: { element: 'AI assistant managing digital workspace and files', style: 'productivity AI' },
  assistant: { element: 'helpful AI interface with floating documents', style: 'AI assistant' },
  model: { element: 'neural network layers with flowing connections', style: 'deep learning' },
  llm: { element: 'language tokens transforming into knowledge', style: 'NLP visualization' },
  training: { element: 'data flowing through optimization landscape', style: 'ML training' },
  inference: { element: 'neural pathways lighting up in sequence', style: 'AI inference' },
  reasoning: { element: 'branching thought patterns and logic trees', style: 'AI reasoning' },

  // 회사/브랜드 시각화
  deepmind: { element: 'abstract brain structure with geometric patterns', style: 'DeepMind research' },
  gemini: { element: 'dual intertwined AI streams', style: 'Google AI' },
  isaac: { element: 'simulation environment with virtual robots', style: 'Nvidia robotics' },
  gr00t: { element: 'humanoid robot learning from demonstration', style: 'robot foundation model' },
  cosmos: { element: 'synthetic world generation visualization', style: 'world model' },

  // 생산성/오피스
  productivity: { element: 'organized digital workspace with flowing tasks', style: 'productivity tech' },
  office: { element: 'modern workspace with digital overlays', style: 'smart office' },
  workflow: { element: 'connected process nodes in automation flow', style: 'workflow automation' },
  document: { element: 'floating documents being organized by AI', style: 'document AI' },
  file: { element: 'file management system with smart sorting', style: 'file automation' },

  // 비즈니스/금융
  funding: { element: 'rising graph with investment flow visualization', style: 'fintech' },
  ipo: { element: 'stock market visualization with upward trajectory', style: 'financial markets' },
  valuation: { element: 'abstract wealth growth representation', style: 'corporate finance' },
  billion: { element: 'exponential growth curve with milestone markers', style: 'big money' },
  startup: { element: 'rocket launch trajectory with data trails', style: 'venture growth' },
  revenue: { element: 'ascending bar chart with golden highlights', style: 'financial growth' },

  // 의료/헬스케어
  health: { element: 'DNA helix intertwined with digital interface', style: 'biotech' },
  medical: { element: 'medical imaging with AI overlay', style: 'healthcare AI' },
  healthcare: { element: 'patient data visualization with care symbols', style: 'healthtech' },

  // 이벤트/발표
  ces: { element: 'futuristic expo hall with tech displays', style: 'trade show' },
  launch: { element: 'product reveal with dramatic lighting', style: 'product launch' },
  release: { element: 'software deployment visualization', style: 'product release' },
  announcement: { element: 'stage presentation with holographic display', style: 'tech keynote' },
  update: { element: 'version upgrade transformation', style: 'software update' },

  // 플랫폼/인프라
  platform: { element: 'interconnected ecosystem of services', style: 'platform architecture' },
  api: { element: 'data endpoints connecting multiple services', style: 'API infrastructure' },
  sdk: { element: 'developer tools and code blocks floating', style: 'developer platform' },
  cloud: { element: 'distributed computing nodes in virtual space', style: 'cloud computing' },
  android: { element: 'modular platform with plugin architecture', style: 'open platform' },
  ecosystem: { element: 'interconnected nodes forming organic network', style: 'tech ecosystem' },

  // 데이터/학습
  synthetic: { element: 'artificially generated data patterns', style: 'synthetic data' },
  simulation: { element: 'virtual environment with physics rendering', style: 'simulation tech' },
  data: { element: 'flowing streams of structured information', style: 'data visualization' },

  // 경쟁/비교
  vs: { element: 'two forces in dynamic tension', style: 'competitive contrast' },
  comparison: { element: 'side by side tech comparison visualization', style: 'comparative analysis' },
  competition: { element: 'racing trajectories converging', style: 'market competition' },
  battle: { element: 'opposing tech forces in confrontation', style: 'tech rivalry' },

  // 미래/트렌드
  future: { element: 'forward-looking horizon with emerging tech', style: 'futuristic vision' },
  trend: { element: 'rising wave patterns showing direction', style: 'trend analysis' },
  prediction: { element: 'crystal ball effect with tech imagery', style: 'tech forecast' },
  '2026': { element: 'futuristic timeline with milestone markers', style: 'near future' },
};

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
 * Extract keywords from title and excerpt
 */
function extractKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  const keywords: string[] = [];

  for (const keyword of Object.keys(VISUAL_MAPPINGS)) {
    if (lowerText.includes(keyword)) {
      keywords.push(keyword);
    }
  }

  return keywords;
}

/**
 * Determine brand color based on tags
 */
function getBrandColor(tags: string[]): string {
  const tagSet = new Set(tags.map(t => t.toLowerCase()));

  if (tagSet.has('openai') || tagSet.has('gpt') || tagSet.has('chatgpt')) {
    return 'emerald green and teal';
  } else if (tagSet.has('anthropic') || tagSet.has('claude')) {
    return 'warm amber and coral orange';
  } else if (tagSet.has('google') || tagSet.has('gemini') || tagSet.has('deepmind')) {
    return 'royal blue and electric purple';
  } else if (tagSet.has('nvidia')) {
    return 'nvidia green and black';
  } else if (tagSet.has('boston dynamics') || tagSet.has('hyundai')) {
    return 'steel blue and silver';
  } else if (tagSet.has('tesla')) {
    return 'electric red and dark gray';
  } else if (tagSet.has('research') || tagSet.has('paper')) {
    return 'silver and platinum white';
  }
  return 'deep blue and cyan';
}

/**
 * Generate descriptive image prompt based on content analysis
 */
function generatePromptForPost(post: PostMeta): string {
  // 1. 제목 + excerpt에서 키워드 추출
  const combinedText = `${post.title} ${post.excerpt}`;
  const keywords = extractKeywords(combinedText);

  // 2. 브랜드 색상 결정
  const themeColor = getBrandColor(post.tags);

  // 3. 키워드 기반 시각 요소 수집
  const visualElements: string[] = [];
  const styles: string[] = [];

  for (const keyword of keywords.slice(0, 3)) { // 최대 3개 키워드
    const mapping = VISUAL_MAPPINGS[keyword];
    if (mapping) {
      visualElements.push(mapping.element);
      styles.push(mapping.style);
    }
  }

  // 4. 기본값 (키워드가 없을 경우)
  if (visualElements.length === 0) {
    visualElements.push('abstract technology visualization with data flows');
    styles.push('modern tech');
  }

  // 5. 프롬프트 구성
  const mainElement = visualElements[0];
  const secondaryElements = visualElements.slice(1).join(', ');
  const styleDescription = [...new Set(styles)].join(', ');

  return `Premium technology blog cover image. MAIN SUBJECT: ${mainElement}. ${secondaryElements ? `SECONDARY: ${secondaryElements}.` : ''} TOPIC: "${post.title}". STYLE: ${themeColor} tones with dark gradient background, ${styleDescription}, premium tech publication quality. Sophisticated, forward-thinking, professional mood. Dramatic lighting with subtle highlights and ambient glow. Wide 16:9 aspect ratio. Central focus with depth. Clean layout suitable for text overlay. NO text, logos, or watermarks. NO human faces. Abstract/conceptual representation.`;
}

async function generateImage(post: PostMeta): Promise<string | null> {
  console.log(`\n🎨 Generating image for: ${post.title}`);
  console.log(`📷 Using model: ${IMAGE_MODEL}`);

  try {
    const prompt = generatePromptForPost(post);
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

    const data = await response.json();

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
      console.log('⏳ Waiting 2 seconds...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Image generation complete!');
}

main().catch(console.error);
