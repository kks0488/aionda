import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, locales } from '@/i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    typeof requested === 'string' && locales.includes(requested as any)
      ? requested
      : defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
