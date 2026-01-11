import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPosts } from '@/lib/posts';
import HomeContent from '@/components/HomeContent';
import SearchDataSetter from '@/components/SearchDataSetter';
import NewsletterForm from '@/components/NewsletterForm';
import type { Locale } from '@/i18n';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'site' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default function HomePage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);

  const posts = getPosts(locale as Locale);
  const searchPosts = posts.map(({ slug, title, description, tags }) => ({
    slug,
    title,
    description,
    tags,
  }));

  return (
    <div className="bg-white dark:bg-[#101922] text-slate-900 dark:text-white min-h-screen">
      {/* Set posts for search */}
      <SearchDataSetter posts={searchPosts} locale={locale as Locale} />

      {/* Hero Section */}
      <section className="relative w-full py-20 lg:py-32 px-6 flex flex-col items-center justify-center text-center">
        <div className="max-w-3xl space-y-6">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter leading-[1.1]">
            Intelligence, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
              Accelerated.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-light max-w-xl mx-auto">
            {locale === 'ko'
              ? 'AGI 시대를 향한 AI 인사이트. 한국 테크 커뮤니티에서 검증된 정보.'
              : 'Daily curated insights into the era of AGI. Tracking the asymptotic curve of human progress.'}
          </p>
          <div className="pt-6 w-full max-w-md mx-auto">
            <NewsletterForm locale={locale as Locale} variant="hero" />
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <HomeContent posts={posts} locale={locale as Locale} />
    </div>
  );
}
