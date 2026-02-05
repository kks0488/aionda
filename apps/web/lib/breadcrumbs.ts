import { BASE_URL } from '@/lib/site';

export type BreadcrumbItem = {
  name: string;
  path: string;
};

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  const normalized = (items || []).filter(Boolean).map((item) => ({
    name: String(item.name || '').trim(),
    path: String(item.path || '').trim(),
  })).filter((item) => item.name && item.path);

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: normalized.map((item, idx) => {
      const path = item.path.startsWith('/') ? item.path : `/${item.path}`;
      return {
        '@type': 'ListItem',
        position: idx + 1,
        name: item.name,
        item: `${BASE_URL}${path}`,
      };
    }),
  };
}

