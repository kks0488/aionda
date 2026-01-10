'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Post } from '@/lib/posts';
import type { Locale } from '@/i18n';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  posts: Post[];
  locale: Locale;
}

export default function SearchModal({ isOpen, onClose, posts, locale }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Post[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSelectedIndex(-1);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = posts.filter(
      (post) =>
        post.title.toLowerCase().includes(lowerQuery) ||
        post.description.toLowerCase().includes(lowerQuery) ||
        post.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    );
    setResults(filtered.slice(0, 5));
    setSelectedIndex(filtered.length > 0 ? 0 : -1);
  }, [posts]);

  useEffect(() => {
    handleSearch(query);
  }, [query, handleSearch]);

  // Focus trap and keyboard navigation
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      inputRef.current?.focus();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            router.push(`/${locale}/posts/${results[selectedIndex].slug}`);
            onClose();
          }
          break;
        case 'Tab':
          // Focus trap - keep focus within modal
          if (!modalRef.current) return;
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            'input, button, a, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
          break;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex, router, locale]);

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(-1);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] sm:pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl mx-4 max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
          <span className="material-symbols-outlined text-slate-400" aria-hidden="true">search</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === 'ko' ? '검색어를 입력하세요...' : 'Search articles...'}
            className="flex-1 bg-transparent text-lg focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            id="search-modal-title"
            aria-label={locale === 'ko' ? '기사 검색' : 'Search articles'}
            aria-autocomplete="list"
            aria-controls="search-results"
            aria-activedescendant={selectedIndex >= 0 ? `result-${selectedIndex}` : undefined}
          />
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 rounded"
            aria-label={locale === 'ko' ? '검색 닫기' : 'Close search'}
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {results.length > 0 ? (
            <ul
              id="search-results"
              role="listbox"
              className="divide-y divide-gray-100 dark:divide-gray-800"
              aria-label={locale === 'ko' ? '검색 결과' : 'Search results'}
            >
              {results.map((post, index) => (
                <li
                  key={post.slug}
                  id={`result-${index}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <Link
                    href={`/${locale}/posts/${post.slug}`}
                    onClick={onClose}
                    className={`flex items-start gap-4 p-4 transition-colors ${
                      index === selectedIndex
                        ? 'bg-primary/10 dark:bg-primary/20'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="material-symbols-outlined text-primary mt-1" aria-hidden="true">article</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {post.title}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-1">
                        {post.description}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {post.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {index === selectedIndex && (
                      <span className="material-symbols-outlined text-primary" aria-hidden="true">
                        keyboard_return
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : query ? (
            <div className="p-8 text-center text-slate-600 dark:text-slate-300" role="status">
              <span className="material-symbols-outlined text-4xl mb-2" aria-hidden="true">search_off</span>
              <p>{locale === 'ko' ? '검색 결과가 없습니다' : 'No results found'}</p>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-600 dark:text-slate-300" role="status">
              <span className="material-symbols-outlined text-4xl mb-2" aria-hidden="true">manage_search</span>
              <p>{locale === 'ko' ? '검색어를 입력하세요' : 'Start typing to search'}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">keyboard_return</span>
              {locale === 'ko' ? '선택' : 'Select'}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" aria-hidden="true">keyboard_arrow_up</span>
              <span className="material-symbols-outlined text-sm" aria-hidden="true">keyboard_arrow_down</span>
              {locale === 'ko' ? '이동' : 'Navigate'}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">close</span>
            {locale === 'ko' ? '닫기' : 'Close'}
          </span>
        </div>
      </div>
    </div>
  );
}
