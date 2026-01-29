import { getPosts } from '@/lib/posts';
import { BASE_URL } from '@/lib/site';

export async function GET() {
  const enPosts = getPosts('en');
  const koPosts = getPosts('ko');

  const safeString = (value: unknown) => (value == null ? '' : String(value));
  const cdata = (value: unknown) => safeString(value).replace(/]]>/g, ']]]]><![CDATA[>');
  const toDateMs = (value: unknown) => {
    const t = new Date(safeString(value)).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  // Combine and sort all posts by date
  const allPosts = [...enPosts, ...koPosts].sort(
    (a, b) => toDateMs(b.date) - toDateMs(a.date)
  );

  const lastBuildMs = allPosts.reduce((max, post) => Math.max(max, toDateMs(post.date)), 0);
  const lastBuildDate = new Date(lastBuildMs || 0);
  const lastBuildTime = lastBuildDate.getTime();

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>AI온다 - AI가 온다</title>
    <link>${BASE_URL}</link>
    <description>AI 기술과 트렌드를 검증된 정보로 전달하는 블로그. Curated AI &amp; Technology insights from Korea.</description>
    <language>mul</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/api/og-default</url>
      <title>AI온다</title>
      <link>${BASE_URL}</link>
    </image>
    ${allPosts.slice(0, 50).map(post => {
      const tags = Array.isArray(post.tags) ? post.tags : [];
      const byline = post.byline || post.author || 'AI온다';
      const postDateMs = toDateMs(post.date);
      const pubDate = new Date(postDateMs || lastBuildTime).toUTCString();

      return `
    <item>
      <title><![CDATA[${cdata(post.title)}]]></title>
      <link>${BASE_URL}/${post.locale}/posts/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/${post.locale}/posts/${post.slug}</guid>
      <description><![CDATA[${cdata(post.description)}]]></description>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${cdata(byline)}]]></dc:creator>
      <category><![CDATA[${cdata(post.locale === 'ko' ? '한국어' : 'English')}]]></category>
      ${tags.map(tag => `<category><![CDATA[${cdata(tag)}]]></category>`).join('\n      ')}
    </item>`;
    }).join('')}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
