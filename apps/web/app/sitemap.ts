import { MetadataRoute } from 'next';
import { getPosts } from '@/lib/posts';
import { getTagStats } from '@/lib/tags';
import { locales, type Locale } from '@/i18n';
import { BASE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const allPosts = locales.flatMap((locale) => getPosts(locale as Locale));
  const siteLastModified =
    allPosts.length > 0
      ? new Date(
          Math.max(
            ...allPosts.map((post) => {
              const t = new Date(post.date).getTime();
              return Number.isNaN(t) ? 0 : t;
            })
          )
        )
      : new Date();

  // Home pages for each locale
  for (const locale of locales) {
    const localePosts = getPosts(locale as Locale);
    const localeLastModified =
      localePosts.length > 0
        ? new Date(
            Math.max(
              ...localePosts.map((post) => {
                const t = new Date(post.date).getTime();
                return Number.isNaN(t) ? 0 : t;
              })
            )
          )
        : siteLastModified;
    entries.push({
      url: `${BASE_URL}/${locale}`,
      lastModified: localeLastModified,
      changeFrequency: 'daily',
      priority: 1.0,
    });

    // Posts archive page
    entries.push({
      url: `${BASE_URL}/${locale}/posts`,
      lastModified: localeLastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    });

    // Tags index + tag pages
    entries.push({
      url: `${BASE_URL}/${locale}/tags`,
      lastModified: localeLastModified,
      changeFrequency: 'weekly',
      priority: 0.6,
    });

    const MIN_INDEXED_TAG_COUNT = 3;
    const MAX_SITEMAP_TAGS_PER_LOCALE = 400;
    const tagStats = getTagStats(locale as Locale)
      .filter((stat) => stat.count >= MIN_INDEXED_TAG_COUNT)
      .slice(0, MAX_SITEMAP_TAGS_PER_LOCALE);
    for (const stat of tagStats) {
      const lm = new Date(stat.lastUsedAt);
      entries.push({
        url: `${BASE_URL}/${locale}/tags/${encodeURIComponent(stat.tag)}`,
        lastModified: Number.isNaN(lm.getTime()) ? localeLastModified : lm,
        changeFrequency: 'weekly',
        priority: 0.4,
      });
    }

    // Individual posts
    for (const post of localePosts) {
      entries.push({
        url: `${BASE_URL}/${locale}/posts/${post.slug}`,
        lastModified: new Date(post.date),
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
  }

  // Static pages
  const staticPages = ['about', 'privacy', 'terms'];
  for (const page of staticPages) {
    for (const locale of locales) {
      entries.push({
        url: `${BASE_URL}/${locale}/${page}`,
        lastModified: siteLastModified,
        changeFrequency: 'monthly',
        priority: 0.5,
      });
    }
  }

  return entries;
}
