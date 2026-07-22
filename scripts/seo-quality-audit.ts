import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { assessPostIndexability } from '../apps/web/lib/indexing-policy';

const root = path.join(process.cwd(), 'apps', 'web', 'content', 'posts');
const counts = new Map<string, number>();
let total = 0;
let indexable = 0;

for (const locale of ['ko', 'en']) {
  const dir = path.join(root, locale);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((name) => /\.mdx?$/.test(name))) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed = matter(raw);
    const assessment = assessPostIndexability({
      date: parsed.data.date,
      lastReviewedAt: parsed.data.lastReviewedAt,
      verificationScore: parsed.data.verificationScore,
      sourceUrl: parsed.data.sourceUrl,
      content: parsed.content,
    });
    total += 1;
    if (assessment.indexable) indexable += 1;
    for (const reason of assessment.reasons) counts.set(reason, (counts.get(reason) || 0) + 1);
  }
}

console.log(JSON.stringify({
  total,
  indexable,
  noindex: total - indexable,
  reasons: Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1])),
}, null, 2));
