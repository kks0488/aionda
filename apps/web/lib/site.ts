const DEFAULT_BASE_URL = 'https://aionda.blog';

export const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || DEFAULT_BASE_URL;
