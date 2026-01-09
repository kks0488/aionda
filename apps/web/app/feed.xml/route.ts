import { getPosts } from '@/lib/posts';

const BASE_URL = 'https://aionda.blog';

export async function GET() {
  const enPosts = getPosts('en');
  const koPosts = getPosts('ko');

  // Combine and sort all posts by date
  const allPosts = [...enPosts, ...koPosts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>AI온다 - AI가 온다</title>
    <link>${BASE_URL}</link>
    <description>AI 기술과 트렌드를 검증된 정보로 전달하는 블로그. Curated AI &amp; Technology insights from Korea.</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/api/og-default</url>
      <title>AI온다</title>
      <link>${BASE_URL}</link>
    </image>
    ${allPosts.slice(0, 50).map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${BASE_URL}/${post.locale}/posts/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/${post.locale}/posts/${post.slug}</guid>
      <description><![CDATA[${post.description}]]></description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <category>${post.locale === 'ko' ? '한국어' : 'English'}</category>
      ${post.tags.map(tag => `<category>${tag}</category>`).join('\n      ')}
    </item>`).join('')}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
