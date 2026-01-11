'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { SearchPost } from '@/lib/posts';
import type { Locale } from '@/i18n';
import SearchModal from './SearchModal';

interface SearchContextType {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  setPosts: (posts: SearchPost[]) => void;
  setLocale: (locale: Locale) => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export function useSearch() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
}

interface SearchProviderProps {
  children: ReactNode;
}

export default function SearchProvider({ children }: SearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [locale, setLocale] = useState<Locale>('en');

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);

  return (
    <SearchContext.Provider value={{ isOpen, openSearch, closeSearch, setPosts, setLocale }}>
      {children}
      <SearchModal isOpen={isOpen} onClose={closeSearch} posts={posts} locale={locale} />
    </SearchContext.Provider>
  );
}
