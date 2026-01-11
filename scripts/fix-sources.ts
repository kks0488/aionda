import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const POSTS_DIR = './apps/web/content/posts';

function removeSourceFromContent(content: string): string {
  // Remove source lines at the end of content
  // Pattern: \n---\n출처: ... or \n---\nSource: ...
  let cleaned = content;

  // Remove Korean source
  cleaned = cleaned.replace(/\n+---\n+출처:.*$/s, '');

  // Remove English source
  cleaned = cleaned.replace(/\n+---\n+Source:.*$/s, '');

  // Remove trailing --- without content
  cleaned = cleaned.replace(/\n+---\s*$/s, '');

  // Ensure single newline at end
  cleaned = cleaned.trimEnd() + '\n';

  return cleaned;
}

async function main() {
  const locales = ['en', 'ko'];
  let fixed = 0;
  let skipped = 0;

  for (const locale of locales) {
    const dir = join(POSTS_DIR, locale);
    const files = readdirSync(dir).filter(f => f.endsWith('.mdx'));

    for (const file of files) {
      const filePath = join(dir, file);
      const content = readFileSync(filePath, 'utf-8');

      // Check if content has source line
      if (content.includes('\n---\n출처:') || content.includes('\n---\nSource:')) {
        const cleaned = removeSourceFromContent(content);
        writeFileSync(filePath, cleaned);
        console.log(`✅ Fixed: ${locale}/${file}`);
        fixed++;
      } else {
        skipped++;
      }
    }
  }

  console.log(`\n✨ Done! Fixed: ${fixed}, Already clean: ${skipped}`);
}

main().catch(console.error);
