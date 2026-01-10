import Link from 'next/link';
import Image from 'next/image';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';

interface PostCardProps {
  post: Post;
  locale: Locale;
  variant?: 'large' | 'medium' | 'small';
}

export default function PostCard({ post, locale, variant = 'medium' }: PostCardProps) {
  const formattedDate = new Date(post.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  if (variant === 'large') {
    return (
      <article className="group flex flex-col gap-5 cursor-pointer">
        <Link href={`/${locale}/posts/${post.slug}`}>
          <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {post.coverImage ? (
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-400/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-6xl text-primary/50">article</span>
              </div>
            )}
            {post.tags[0] && (
              <span className="absolute top-4 left-4 z-20 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white">
                {post.tags[0]}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>{formattedDate}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              {post.verificationScore !== undefined && (
                <span className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px] icon-filled">verified</span>
                  AI Verified
                </span>
              )}
            </div>
            <h2 className="text-3xl font-bold leading-tight group-hover:text-primary transition-colors text-slate-900 dark:text-white">
              {post.title}
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base line-clamp-2">
              {post.description}
            </p>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'small') {
    return (
      <article className="group flex flex-col gap-4 cursor-pointer">
        <Link href={`/${locale}/posts/${post.slug}`}>
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            {post.coverImage ? (
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-400/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary/50">article</span>
              </div>
            )}
            {post.tags[0] && (
              <span className="absolute top-4 left-4 z-20 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white">
                {post.tags[0]}
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              <span>{formattedDate}</span>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              {post.verificationScore !== undefined && (
                <span className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px] icon-filled">verified</span>
                  Verified
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors text-slate-900 dark:text-white">
              {post.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
              {post.description}
            </p>
          </div>
        </Link>
      </article>
    );
  }

  // Default medium variant
  return (
    <article className="group flex flex-col gap-4 cursor-pointer">
      <Link href={`/${locale}/posts/${post.slug}`}>
        <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          {post.coverImage ? (
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              className="object-cover transform group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-400/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-5xl text-primary/50">article</span>
            </div>
          )}
          {post.tags[0] && (
            <span className="absolute top-3 left-3 z-20 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white">
              {post.tags[0]}
            </span>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{formattedDate}</span>
            {post.verificationScore !== undefined && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[14px] icon-filled">verified</span>
                  {Math.round(post.verificationScore * 100)}%
                </span>
              </>
            )}
          </div>
          <h3 className="text-lg font-bold leading-snug group-hover:text-primary transition-colors text-slate-900 dark:text-white line-clamp-2">
            {post.title}
          </h3>
          <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
            {post.description}
          </p>
        </div>
      </Link>
    </article>
  );
}
