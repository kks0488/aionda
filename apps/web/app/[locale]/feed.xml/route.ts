import { getPostSummaries } from '@/lib/posts';
import { BASE_URL } from '@/lib/site';
import { locales, type Locale } from '@/i18n';

function safeString(value: unknown) {
  return value == null ? '' : String(value);
}

function cdata(value: unknown) {
  return safeString(value).replace(/]]>/g, ']]]]><![CDATA[>');
}

function toDateMs(value: unknown) {
  const t = new Date(safeString(value)).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export async function GET(
  _request: Request,
  { params }: { params: { locale: string } }
) {
  const locale = params.locale as Locale;
  if (!locales.includes(locale)) {
    return new Response('Not found', { status: 404 });
  }

  const posts = getPostSummaries(locale);
  const sorted = [...posts].sort((a, b) => toDateMs(b.date) - toDateMs(a.date));
  const lastBuildMs = sorted.reduce((max, post) => Math.max(max, toDateMs(post.date)), 0);
  const lastBuildDate = new Date(lastBuildMs || Date.now());

  const channelTitle = locale === 'ko' ? 'AI온다 — 한국 AI 신호' : 'Aionda — Curated AI from Korea';
  const channelDescription =
    locale === 'ko'
      ? 'AI 기술과 트렌드를 검증된 정보로 전달하는 블로그.'
      : 'Curated AI & technology insights from Korea, cross-verified with trusted sources.';

  const selfUrl = `${BASE_URL}/${locale}/feed.xml`;

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${cdata(channelTitle)}</title>
    <link>${BASE_URL}/${locale}</link>
    <description><![CDATA[${cdata(channelDescription)}]]></description>
    <language>${locale === 'ko' ? 'ko-KR' : 'en-US'}</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>
    <image>
      <url>${BASE_URL}/api/og-default</url>
      <title>${cdata(channelTitle)}</title>
      <link>${BASE_URL}/${locale}</link>
    </image>
    ${sorted.slice(0, 50).map((post) => {
      const tags = Array.isArray(post.tags) ? post.tags : [];
      const byline = post.byline || post.author || 'AI온다';
      const postDateMs = toDateMs(post.date);
      const pubDate = new Date(postDateMs || lastBuildDate.getTime()).toUTCString();
      const link = `${BASE_URL}/${locale}/posts/${post.slug}`;
      return `
    <item>
      <title><![CDATA[${cdata(post.title)}]]></title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description><![CDATA[${cdata(post.description)}]]></description>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${cdata(byline)}]]></dc:creator>
      ${tags.map((tag) => `<category><![CDATA[${cdata(tag)}]]></category>`).join('\n      ')}
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
