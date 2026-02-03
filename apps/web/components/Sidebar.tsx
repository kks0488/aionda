import Link from 'next/link';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';
import { getTagColor, getTagIcon } from '@/lib/tag-utils';
import SourceBadge from '@/components/SourceBadge';

interface SidebarProps {
  locale: Locale;
  trendingPosts?: Post[];
  popularTags?: string[];
  starterPosts?: Post[];
  recentMix?: {
    total: number;
    trusted: number;
    community: number;
    evergreen: number;
    news: number;
    official: number;
    unknown: number;
  };
}

export default function Sidebar({
  locale,
  trendingPosts = [],
  popularTags = [],
  starterPosts = [],
  recentMix,
}: SidebarProps) {
  const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const trustedPct = pct(recentMix?.trusted || 0, recentMix?.total || 0);
  const communityPct = pct(recentMix?.community || 0, recentMix?.total || 0);

  return (
    <aside className="space-y-12">
      {/* About Widget */}
      <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/50">
        <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">
          {locale === 'ko' ? '운영 원칙' : 'How Aionda Works'}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
          {locale === 'ko' ? (
            <>
              Aionda는 DC Inside <span className="font-bold text-slate-900 dark:text-white">&apos;특이점이온다&apos;</span> 갤러리의 “신호”를 빠르게 포착합니다. 그리고 공식/신뢰 소스로 교차검증해 <span className="font-bold text-slate-900 dark:text-white">근거 중심</span>으로 정리합니다.
            </>
          ) : (
            <>
              Aionda catches early community signals, then triangulates with trusted sources. The goal is simple: fast context, clear implications, and grounded references.
            </>
          )}
        </p>
        <Link
          href={`/${locale}/about`}
          className="text-primary text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
        >
          {locale === 'ko' ? '더 알아보기' : 'Read More'}
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </div>

      {/* Source Mix */}
      {recentMix && recentMix.total > 0 && (
        <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30">
          <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary icon-filled" aria-hidden="true">stacked_line_chart</span>
            {locale === 'ko' ? '최근 7일 소스' : 'Last 7 Days'}
          </h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>{locale === 'ko' ? '공식/뉴스' : 'Trusted'}</span>
                <span>{trustedPct}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-500 to-primary" style={{ width: `${trustedPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>{locale === 'ko' ? '커뮤니티' : 'Community'}</span>
                <span>{communityPct}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${communityPct}%` }} />
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {locale === 'ko'
                ? `총 ${recentMix.total}개 발행 · trusted ${recentMix.trusted} · community ${recentMix.community} · guide ${recentMix.evergreen}`
                : `${recentMix.total} posts · trusted ${recentMix.trusted} · community ${recentMix.community} · guides ${recentMix.evergreen}`}
            </p>
          </div>
        </div>
      )}

      {/* Start Here */}
      {starterPosts.length > 0 && (
        <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30">
          <h3 className="text-lg font-bold mb-5 text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary icon-filled" aria-hidden="true">auto_awesome</span>
            {locale === 'ko' ? '처음이라면 여기부터' : 'Start Here'}
          </h3>
          <div className="space-y-4">
            {starterPosts.map((post) => {
              const formattedDate = new Date(post.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
                month: 'short',
                day: 'numeric',
              });
              return (
                <Link
                  key={post.slug}
                  href={`/${locale}/posts/${post.slug}`}
                  className="group block"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors leading-snug line-clamp-2">
                      {post.title}
                    </h4>
                    <span className="shrink-0">
                      <SourceBadge locale={locale} sourceId={post.sourceId} sourceUrl={post.sourceUrl} compact />
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {formattedDate}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="mt-5">
            <Link
              href={`/${locale}/tags/explainer`}
              className="text-primary text-sm font-bold inline-flex items-center gap-1 hover:gap-2 transition-all"
            >
              {locale === 'ko' ? 'Explainer 더 보기' : 'More explainers'}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          </div>
        </div>
      )}

      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <div className="p-6 rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-slate-900/30">
          <h3 className="text-lg font-bold mb-5 text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary icon-filled" aria-hidden="true">tag</span>
            {locale === 'ko' ? '인기 태그' : 'Popular Tags'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => {
              const tagColor = getTagColor(tag);
              return (
                <Link
                  key={tag}
                  href={`/${locale}/tags/${encodeURIComponent(tag)}`}
                  className="group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-950/30 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <span
                    className={`h-2 w-2 rounded-full bg-gradient-to-r ${tagColor}`}
                    aria-hidden="true"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    {tag}
                  </span>
                </Link>
              );
            })}
            <Link
              href={`/${locale}/tags`}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border border-dashed border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:text-primary hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              {locale === 'ko' ? '전체 태그' : 'All tags'}
              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
        </div>
      )}

      {/* Trending Topics */}
      {trendingPosts.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">trending_up</span>
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
                          <span className="flex items-center gap-0.5 text-primary">
                            <span className="material-symbols-outlined text-[12px] icon-filled">verified</span>
                            Verified
                          </span>
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
