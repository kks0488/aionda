export const locales = ['en', 'ko', 'ja', 'es'] as const;
export const defaultLocale = 'ko' as const;

export type Locale = (typeof locales)[number];
