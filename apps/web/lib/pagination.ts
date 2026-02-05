export const DEFAULT_PAGE_SIZE = 24;

export function parsePageParam(value: unknown): number {
  if (typeof value !== 'string') return 1;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function getTotalPages(totalItems: number, pageSize: number): number {
  const safeTotal = Number.isFinite(totalItems) && totalItems > 0 ? totalItems : 0;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.ceil(safeTotal / safeSize));
}

export function sliceForPage<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = Number.isFinite(page) && page >= 1 ? page : 1;
  const safeSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const start = (safePage - 1) * safeSize;
  return items.slice(start, start + safeSize);
}

export function buildPageHref(baseHref: string, page: number): string {
  const safeBase = String(baseHref || '').replace(/\/+$/, '');
  if (page <= 1) return safeBase || '/';
  return `${safeBase}/page/${page}`;
}

