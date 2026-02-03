import type { Locale } from '@/i18n';

export type SourceKind = 'evergreen' | 'roundup' | 'community' | 'official' | 'news' | 'unknown';

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

const COMMUNITY_HOSTS: RegExp[] = [/(\.|^)dcinside\.com$/i];

const OFFICIAL_HOSTS: RegExp[] = [
  /(^|\.)openai\.com$/i,
  /(^|\.)platform\.openai\.com$/i,
  /(^|\.)anthropic\.com$/i,
  /(^|\.)docs\.anthropic\.com$/i,
  /(^|\.)deepmind\.google$/i,
  /(^|\.)blog\.google$/i,
  /(^|\.)ai\.google$/i,
  /(^|\.)huggingface\.co$/i,
  /(^|\.)blogs\.nvidia\.com$/i,
  /(^|\.)nvidia\.com$/i,
  /(^|\.)microsoft\.com$/i,
  /(^|\.)azure\.microsoft\.com$/i,
  /(^|\.)d2\.naver\.com$/i,
  /(^|\.)tech\.kakao\.com$/i,
  /(^|\.)toss\.tech$/i,
  /(^|\.)techblog\.woowahan\.com$/i,
  /(^|\.)techblog\.gccompany\.co\.kr$/i,
  /(^|\.)aws\.amazon\.com$/i,
  /(^|\.)cloudflare\.com$/i,
  /(^|\.)oecd\.org$/i,
  /(^|\.)imf\.org$/i,
  /(^|\.)worldbank\.org$/i,
];

const NEWS_HOSTS: RegExp[] = [
  /(^|\.)techcrunch\.com$/i,
  /(^|\.)zdnet\.com$/i,
  /(^|\.)arstechnica\.com$/i,
  /(^|\.)technologyreview\.com$/i,
  /(^|\.)wired\.com$/i,
  /(^|\.)venturebeat\.com$/i,
  /(^|\.)theverge\.com$/i,
  /(^|\.)reuters\.com$/i,
  /(^|\.)bbc\.com$/i,
  /(^|\.)nytimes\.com$/i,
  /(^|\.)apnews\.com$/i,
  /(^|\.)yonhapnews\.co\.kr$/i,
];

export function getSourceKind(input: { sourceId?: string; sourceUrl?: string }): SourceKind {
  const sourceId = String(input.sourceId || '').trim();
  const sourceUrl = String(input.sourceUrl || '').trim();

  if (sourceId.startsWith('evergreen-')) return 'evergreen';
  if (sourceId === 'roundup' || sourceId.startsWith('roundup-') || sourceId.startsWith('aionda-roundup')) return 'roundup';

  const host = getHostname(sourceUrl);
  if (!host) return 'unknown';

  if (COMMUNITY_HOSTS.some((re) => re.test(host))) return 'community';
  if (/medium\.com$/i.test(host) && /coupang-engineering/i.test(sourceUrl)) return 'official';
  if (OFFICIAL_HOSTS.some((re) => re.test(host))) return 'official';
  if (NEWS_HOSTS.some((re) => re.test(host))) return 'news';

  return 'unknown';
}

export function getSourceBadge(locale: Locale, kind: SourceKind): { label: string; icon: string; tone: 'neutral' | 'info' | 'success' | 'warn' } {
  const isKo = locale === 'ko';

  if (kind === 'evergreen') {
    return { label: isKo ? '가이드' : 'Guide', icon: 'menu_book', tone: 'success' };
  }
  if (kind === 'roundup') {
    return { label: isKo ? '자료 모음' : 'Roundup', icon: 'collections_bookmark', tone: 'info' };
  }
  if (kind === 'official') {
    return { label: isKo ? '공식/신뢰' : 'Trusted', icon: 'shield', tone: 'success' };
  }
  if (kind === 'news') {
    return { label: isKo ? '뉴스' : 'News', icon: 'newspaper', tone: 'info' };
  }
  if (kind === 'community') {
    return { label: isKo ? '커뮤니티' : 'Community', icon: 'forum', tone: 'warn' };
  }
  return { label: isKo ? '출처' : 'Source', icon: 'link', tone: 'neutral' };
}

export function getSourceHostname(sourceUrl?: string): string {
  return getHostname(String(sourceUrl || '').trim());
}
