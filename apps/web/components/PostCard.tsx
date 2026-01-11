import Link from 'next/link';
import Image from 'next/image';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';
import { getTagColor, getTagIcon } from '@/lib/tag-utils';

interface PostCardProps {
  post: Post;
  locale: Locale;
  variant?: 'large' | 'medium' | 'small';
  priority?: boolean;
}

export default function PostCard({ post, locale, variant = 'medium', priority = false }: PostCardProps) {
  const formattedDate = new Date(post.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const primaryTag = post.tags[0] || 'ai';
  const tagColor = getTagColor(primaryTag);
  const tagIcon = getTagIcon(primaryTag);
  const postHref = `/${locale}/posts/${post.slug}`;

  const PlaceholderImage = ({ size = 'large' }: { size?: 'large' | 'medium' | 'small' }) => (
    <div className={`w-full h-full bg-gradient-to-br ${tagColor} flex items-center justify-center relative overflow-hidden`}>
      <div className="absolute inset-0 bg-black/25 dark:bg-black/10" />
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
      <span className={`material-symbols-outlined text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)] ${
        size === 'large' ? 'text-7xl' : size === 'small' ? 'text-4xl' : 'text-5xl'
      }`}>
        {tagIcon}
      </span>
    </div>
  );

  if (variant === 'large') {
    return (
      <article className="group cursor-pointer">
        <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          <Link href={postHref} className="block h-full">
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {post.coverImage ? (
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                sizes="(max-width: 1024px) 100vw, 66vw"
                priority={priority}
                className="object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <PlaceholderImage size="large" />
            )}
          </Link>
          {post.tags[0] && (
            <Link
              href={`/${locale}/posts?tag=${encodeURIComponent(post.tags[0])}`}
              className="absolute top-4 left-4 z-20 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white"
            >
              {post.tags[0]}
            </Link>
          )}
        </div>

        <Link href={postHref} className="mt-5 block space-y-3">
          <div className="flex items-center gap-3 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{formattedDate}</span>
            {post.verificationScore !== undefined && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px] icon-filled">verified</span>
                  AI Verified
                </span>
              </>
            )}
          </div>
          <h2 className="text-2xl md:text-3xl font-bold leading-tight group-hover:text-primary transition-colors text-slate-900 dark:text-white">
            {post.title}
          </h2>
          {post.description && (
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-base line-clamp-2">
              {post.description}
            </p>
          )}
        </Link>
      </article>
    );
  }

  if (variant === 'small') {
    return (
      <article className="group cursor-pointer">
        <div className="relative w-full aspect-[4/3] overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
          <Link href={postHref} className="block h-full">
            {post.coverImage ? (
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <PlaceholderImage size="small" />
            )}
          </Link>
          {post.tags[0] && (
            <Link
              href={`/${locale}/posts?tag=${encodeURIComponent(post.tags[0])}`}
              className="absolute top-3 left-3 z-20 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white"
            >
              {post.tags[0]}
            </Link>
          )}
        </div>

        <Link href={postHref} className="mt-4 block space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>{formattedDate}</span>
            {post.verificationScore !== undefined && (
              <>
                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                <span className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[16px] icon-filled">verified</span>
                  Verified
                </span>
              </>
            )}
          </div>
          <h3 className="text-xl font-bold leading-tight group-hover:text-primary transition-colors text-slate-900 dark:text-white">
            {post.title}
          </h3>
          {post.description && (
            <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
              {post.description}
            </p>
          )}
        </Link>
      </article>
    );
  }

  // Default medium variant
  return (
    <article className="group cursor-pointer">
      <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        <Link href={postHref} className="block h-full">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          {post.coverImage ? (
            <Image
              src={post.coverImage}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transform group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <PlaceholderImage size="medium" />
          )}
        </Link>
        {post.tags[0] && (
          <Link
            href={`/${locale}/posts?tag=${encodeURIComponent(post.tags[0])}`}
            className="absolute top-3 left-3 z-20 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white"
          >
            {post.tags[0]}
          </Link>
        )}
      </div>

      <Link href={postHref} className="mt-4 block space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>{formattedDate}</span>
          {post.verificationScore !== undefined && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className="flex items-center gap-1 text-primary">
                <span className="material-symbols-outlined text-[16px] icon-filled">verified</span>
                Verified
              </span>
            </>
          )}
        </div>
        <h3 className="text-lg font-bold leading-snug group-hover:text-primary transition-colors text-slate-900 dark:text-white line-clamp-2">
          {post.title}
        </h3>
        {post.description && (
          <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-2">
            {post.description}
          </p>
        )}
      </Link>
    </article>
  );
}
