'use client';

import { useEffect } from 'react';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';
import { useSearch } from './SearchProvider';

interface SearchDataSetterProps {
  posts: Post[];
  locale: Locale;
}

export default function SearchDataSetter({ posts, locale }: SearchDataSetterProps) {
  const { setPosts, setLocale } = useSearch();

  useEffect(() => {
    setPosts(posts);
    setLocale(locale);
  }, [posts, locale, setPosts, setLocale]);

  return null;
}
