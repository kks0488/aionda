'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
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
  }, [posts]);

  useEffect(() => {
    handleSearch(query);
  }, [query, handleSearch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-800">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={locale === 'ko' ? '검색어를 입력하세요...' : 'Search articles...'}
            className="flex-1 bg-transparent text-lg focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
            autoFocus
          />
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 rounded"
          >
            ESC
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length > 0 ? (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {results.map((post) => (
                <li key={post.slug}>
                  <Link
                    href={`/${locale}/posts/${post.slug}`}
                    onClick={onClose}
                    className="flex items-start gap-4 p-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary mt-1">article</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                        {post.title}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
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
                  </Link>
                </li>
              ))}
            </ul>
          ) : query ? (
            <div className="p-8 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
              <p>{locale === 'ko' ? '검색 결과가 없습니다' : 'No results found'}</p>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <span className="material-symbols-outlined text-4xl mb-2">manage_search</span>
              <p>{locale === 'ko' ? '검색어를 입력하세요' : 'Start typing to search'}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">keyboard_return</span>
              {locale === 'ko' ? '선택' : 'Select'}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">keyboard_arrow_up</span>
              <span className="material-symbols-outlined text-sm">keyboard_arrow_down</span>
              {locale === 'ko' ? '이동' : 'Navigate'}
            </span>
          </div>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">close</span>
            {locale === 'ko' ? '닫기' : 'Close'}
          </span>
        </div>
      </div>
    </div>
  );
}
