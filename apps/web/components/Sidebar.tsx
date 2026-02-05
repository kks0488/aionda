import Link from 'next/link';
import type { PostSummary } from '@/lib/posts';
import type { Locale } from '@/i18n';
import SourceBadge from '@/components/SourceBadge';

interface SidebarProps {
  locale: Locale;
  trendingPosts?: PostSummary[];
  popularTags?: string[];
}

export default function Sidebar({
  locale,
  trendingPosts = [],
  popularTags = [],
}: SidebarProps) {
  return (
    <aside className="space-y-10">
      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30">
          <h3 className="text-lg font-bold mb-5 text-slate-900 dark:text-white">
            {locale === 'ko' ? '인기 태그' : 'Popular Tags'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <Link
                key={tag}
                href={`/${locale}/tags/${encodeURIComponent(tag)}`}
                data-analytics-event="tag_click"
                data-analytics-params={JSON.stringify({ tag, from: 'sidebar_popular_tags', locale })}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold border border-gray-200/80 dark:border-gray-700/80 bg-slate-50 dark:bg-slate-950/30 text-slate-900 dark:text-slate-100 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                {tag}
              </Link>
            ))}
            <Link
              href={`/${locale}/tags`}
              className="inline-flex items-center rounded-full px-3 py-1.5 text-xs font-bold border border-dashed border-gray-200/80 dark:border-gray-700/80 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              {locale === 'ko' ? '전체 태그' : 'All tags'}
            </Link>
          </div>
        </div>
      )}

      {/* Trending Topics */}
      {trendingPosts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">
            {locale === 'ko' ? '인기 글' : 'Trending Now'}
          </h3>
          <div className="space-y-6">
            {trendingPosts.slice(0, 4).map((post, index) => {
              const formattedDate = new Date(post.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                month: 'short',
                day: 'numeric',
              });
              return (
                <Link
                  key={post.slug}
                  href={`/${locale}/posts/${post.slug}`}
                  className="group flex gap-4 items-start"
                >
                  <span className="text-3xl font-bold text-slate-300 dark:text-slate-500 group-hover:text-primary transition-colors leading-none">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <SourceBadge locale={locale} sourceId={post.sourceId} sourceUrl={post.sourceUrl} compact />
                      <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                      <span>{formattedDate}</span>
                      {post.verificationScore !== undefined && post.verificationScore >= 0.5 && (
                        <>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                          <span className="text-primary font-semibold">Verified</span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

    </aside>
  );
}
