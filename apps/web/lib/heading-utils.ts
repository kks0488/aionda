export function normalizeHeadingText(value: string): string {
  return String(value || '')
    .replace(/\s+#+\s*$/, '')
    .replace(/[`*_]/g, '')
    .trim();
}

export function toHeadingId(value: string): string {
  return normalizeHeadingText(value).toLowerCase().replace(/\s+/g, '-');
}

