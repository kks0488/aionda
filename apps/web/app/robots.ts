import { MetadataRoute } from 'next';
import { BASE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/admin', '/api/admin/', '/en/admin', '/ko/admin'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: new URL(BASE_URL).host,
  };
}

