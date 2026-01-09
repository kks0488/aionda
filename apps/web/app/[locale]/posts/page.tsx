import { useTranslations } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getPosts } from '@/lib/posts';
import PostCard from '@/components/PostCard';
import type { Locale } from '@/i18n';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale, namespace: 'nav' });
  return {
    title: t('posts'),
  };
}

export default function PostsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);

  const t = useTranslations('nav');
  const posts = getPosts(locale as Locale);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">{t('posts')}</h1>

      {posts.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} locale={locale as Locale} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">
            No posts available yet.
          </p>
        </div>
      )}
    </div>
  );
}
