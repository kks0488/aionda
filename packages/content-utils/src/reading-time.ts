export function estimateReadingTime(raw: string, locale: string = 'en'): number {
  const stripped = String(raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!stripped) return 1;

  if (locale === 'ko') {
    const chars = stripped.replace(/\s/g, '').length;
    return Math.max(1, Math.round(chars / 800));
  }

  const words = stripped.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
