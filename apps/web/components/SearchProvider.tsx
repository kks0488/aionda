'use client';

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Locale } from '@/i18n';
import SearchModal from './SearchModal';

interface SearchContextType {
  isOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
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
  locale: Locale;
}

export default function SearchProvider({ children, locale }: SearchProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openSearch = useCallback(() => setIsOpen(true), []);
  const closeSearch = useCallback(() => setIsOpen(false), []);
  const value = useMemo(
    () => ({ isOpen, openSearch, closeSearch }),
    [isOpen, openSearch, closeSearch]
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
      <SearchModal isOpen={isOpen} onClose={closeSearch} locale={locale} />
    </SearchContext.Provider>
  );
}
