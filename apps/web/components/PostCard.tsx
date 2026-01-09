import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';

interface PostCardProps {
  post: Post;
  locale: Locale;
}

export default function PostCard({ post, locale }: PostCardProps) {
  const t = useTranslations('post');

  return (
    <article className="group relative bg-background border border-border rounded-xl overflow-hidden hover:border-accent/50 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300">
      <Link href={`/${locale}/posts/${post.slug}`} className="block">
        {/* Cover Image */}
        {post.coverImage && (
          <div className="relative w-full aspect-[16/9] overflow-hidden">
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
          </div>
        )}

        <div className="p-6">
          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-3">
            {post.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 bg-accent/10 text-accent text-xs font-medium rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h3 className="text-xl font-semibold mb-3 leading-snug group-hover:text-accent transition-colors line-clamp-2">
            {post.title}
          </h3>

          {/* Description */}
          <p className="text-muted-foreground text-sm mb-4 line-clamp-2 leading-relaxed">
            {post.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <time dateTime={post.date} className="text-xs text-muted-foreground">
              {new Date(post.date).toLocaleDateString(locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </time>

            {post.verificationScore !== undefined && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                  post.verificationScore >= 0.7
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {Math.round(post.verificationScore * 100)}%
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Hover accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
    </article>
  );
}
