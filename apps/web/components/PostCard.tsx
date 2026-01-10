import Link from 'next/link';
import Image from 'next/image';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';

interface PostCardProps {
  post: Post;
  locale: Locale;
  variant?: 'large' | 'medium' | 'small';
}

// Generate a consistent color based on the first tag
function getTagColor(tag: string): string {
  const colors = [
    'from-blue-500 to-cyan-400',
    'from-purple-500 to-pink-400',
    'from-green-500 to-emerald-400',
    'from-orange-500 to-amber-400',
    'from-red-500 to-rose-400',
    'from-indigo-500 to-violet-400',
  ];
  const hash = tag.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Get icon for tag
function getTagIcon(tag: string): string {
  const icons: Record<string, string> = {
    news: 'newspaper',
    opinion: 'lightbulb',
    openai: 'smart_toy',
    anthropic: 'psychology',
    grok: 'auto_awesome',
    xai: 'rocket_launch',
    gpt: 'chat',
    llama: 'pets',
    ai: 'memory',
    default: 'article',
  };
  return icons[tag.toLowerCase()] || icons.default;
}

export default function PostCard({ post, locale, variant = 'medium' }: PostCardProps) {
  const formattedDate = new Date(post.date).toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const primaryTag = post.tags[0] || 'ai';
  const tagColor = getTagColor(primaryTag);
  const tagIcon = getTagIcon(primaryTag);

  const PlaceholderImage = ({ size = 'large' }: { size?: 'large' | 'medium' | 'small' }) => (
    <div className={`w-full h-full bg-gradient-to-br ${tagColor} flex items-center justify-center relative overflow-hidden`}>
      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
      <span className={`material-symbols-outlined text-white/80 ${
        size === 'large' ? 'text-7xl' : size === 'small' ? 'text-4xl' : 'text-5xl'
      }`}>
        {tagIcon}
      </span>
    </div>
  );

  if (variant === 'large') {
    return (
      <article className="group flex flex-col gap-5 cursor-pointer">
        <Link href={`/${locale}/posts/${post.slug}`}>
          <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            {post.coverImage ? (
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                className="object-cover transform group-hover:scale-105 transition-transform duration-700"
              />
            ) : (
              <PlaceholderImage size="large" />
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
                  {Math.round(post.verificationScore * 100)}% Verified
                </span>
              )}
            </div>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight group-hover:text-primary transition-colors text-slate-900 dark:text-white">
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
              <PlaceholderImage size="small" />
            )}
            {post.tags[0] && (
              <span className="absolute top-3 left-3 z-20 bg-white/90 dark:bg-black/80 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-slate-900 dark:text-white">
                {post.tags[0]}
              </span>
            )}
          </div>

          <div className="space-y-2">
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
            <h3 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors text-slate-900 dark:text-white line-clamp-2">
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
            <PlaceholderImage size="medium" />
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
