import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = './data/official';

interface OfficialSource {
  id: string;
  name: string;
  url: string;
  type: 'changelog' | 'blog';
  lastChecked?: string;
}

const OFFICIAL_SOURCES: OfficialSource[] = [
  { id: 'claude', name: 'Claude API', url: 'https://platform.claude.com/docs/en/release-notes/overview', type: 'changelog' },
  { id: 'openai', name: 'OpenAI API', url: 'https://platform.openai.com/docs/changelog', type: 'changelog' },
  { id: 'gemini', name: 'Gemini API', url: 'https://ai.google.dev/gemini-api/docs/changelog', type: 'changelog' },
  { id: 'openai-blog', name: 'OpenAI Blog', url: 'https://openai.com/news/', type: 'blog' },
  { id: 'anthropic-blog', name: 'Anthropic Blog', url: 'https://www.anthropic.com/news', type: 'blog' },
  { id: 'google-ai-blog', name: 'Google AI Blog', url: 'https://blog.google/technology/ai/', type: 'blog' },
];

async function main() {
  console.log('\n🔍 Crawling official AI update sources...\n');

  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }

  // Save sources list
  const sourcesFile = join(DATA_DIR, 'sources.json');
  writeFileSync(sourcesFile, JSON.stringify(OFFICIAL_SOURCES, null, 2), 'utf-8');

  for (const source of OFFICIAL_SOURCES) {
    console.log(`Checking: ${source.name} - ${source.url}`);

    try {
      const response = await fetch(source.url, {
        headers: { 'User-Agent': 'AIOnda/1.0' },
      });

      const meta = { ...source, lastChecked: new Date().toISOString(), accessible: response.ok };
      writeFileSync(join(DATA_DIR, `${source.id}-meta.json`), JSON.stringify(meta, null, 2));

      console.log(`  ${response.ok ? '✅' : '❌'} ${response.status}`);
    } catch (e) {
      console.log(`  ❌ Failed`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n✨ Done! External AI can use /external-ai to create posts from official docs.');
}

main().catch(console.error);
