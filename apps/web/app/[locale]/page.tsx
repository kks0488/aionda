import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { getPosts } from '@/lib/posts';
import PostCard from '@/components/PostCard';
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

  const t = useTranslations('home');
  const posts = getPosts(locale as Locale).slice(0, 6);

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative text-center py-20 -mt-8 -mx-4 px-4 overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 dark:from-violet-500/5 dark:via-fuchsia-500/5 dark:to-pink-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/20 via-transparent to-transparent dark:from-violet-500/10" />

        {/* Decorative elements */}
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-violet-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-1/4 w-96 h-96 bg-fuchsia-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
            <span className="bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent">
              {t('hero')}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>

          {/* Stats or CTA */}
          <div className="mt-10 flex justify-center gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">{posts.length}+</div>
              <div className="text-sm text-muted-foreground">Articles</div>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">24/7</div>
              <div className="text-sm text-muted-foreground">Updates</div>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground">AI</div>
              <div className="text-sm text-muted-foreground">Verified</div>
            </div>
          </div>
        </div>
      </section>

      {/* Latest Posts */}
      <section>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t('latestPosts')}</h2>
            <p className="text-muted-foreground mt-1">
              Curated AI news, verified and translated
            </p>
          </div>
          <Link
            href={`/${locale}/posts`}
            className="group inline-flex items-center gap-2 text-accent hover:underline font-medium"
          >
            {t('viewAll')}
            <svg
              className="w-4 h-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>

        {posts.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} locale={locale as Locale} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/50 rounded-2xl border border-border">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
              </svg>
            </div>
            <p className="text-muted-foreground mb-2">
              No posts yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Run <code className="bg-muted px-2 py-1 rounded text-accent font-mono">/singularity-crawl</code> to get started!
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
