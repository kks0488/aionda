import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getPosts } from '@/lib/posts';
import PostCard from '@/components/PostCard';
import SearchDataSetter from '@/components/SearchDataSetter';
import type { Locale } from '@/i18n';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  return {
    title: t('posts'),
    description: locale === 'ko'
      ? 'AI 관련 최신 뉴스와 인사이트'
      : 'Latest AI news and insights',
  };
}

export default function PostsPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { tag?: string };
}) {
  setRequestLocale(locale);

  const posts = getPosts(locale as Locale);
  const tagParam = typeof searchParams?.tag === 'string' ? searchParams.tag.trim() : '';
  const normalizedTag = tagParam ? tagParam.toLowerCase() : '';
  if (normalizedTag) {
    redirect(`/${locale}/tags/${encodeURIComponent(normalizedTag)}`);
  }
  const searchPosts = posts.map(({ slug, title, description, tags }) => ({
    slug,
    title,
    description,
    tags,
  }));
  const headerTitle = locale === 'ko' ? '모든 글' : 'All Articles';

  return (
    <div className="bg-white dark:bg-[#101922] min-h-screen">
      {/* Set posts for search */}
      <SearchDataSetter posts={searchPosts} locale={locale as Locale} />

      {/* Header */}
      <section className="w-full py-12 px-6 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
            {headerTitle}
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            {locale === 'ko' ? `${posts.length}개의 글이 있습니다` : `${posts.length} articles available`}
          </p>
        </div>
      </section>

      {/* Posts Grid */}
      <main className="w-full max-w-7xl mx-auto px-6 py-12">
        {posts.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard
                key={post.slug}
                post={post}
                locale={locale as Locale}
                variant="medium"
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              {locale === 'ko' ? '아직 글이 없습니다' : 'No posts yet'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
