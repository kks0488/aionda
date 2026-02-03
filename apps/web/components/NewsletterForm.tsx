'use client';

import { useState } from 'react';
import type { Locale } from '@/i18n';

interface NewsletterFormProps {
  locale: Locale;
  variant?: 'hero' | 'inline';
}

export default function NewsletterForm({ locale, variant = 'hero' }: NewsletterFormProps) {
  const [email, setEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsLoading(false);
    setIsSubmitted(true);
    setEmail('');

    // Reset after 3 seconds
    setTimeout(() => setIsSubmitted(false), 3000);
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center justify-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg">
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        <span className="font-medium">
          {locale === 'ko' ? '구독해주셔서 감사합니다!' : 'Thanks for subscribing!'}
        </span>
      </div>
    );
  }

  if (variant === 'hero') {
    return (
      <form onSubmit={handleSubmit} className="flex w-full items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-shadow">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={locale === 'ko' ? '이메일을 입력하세요...' : 'Enter your email for updates...'}
          required
          className="flex-1 border-none bg-transparent px-4 py-3 text-sm focus:ring-0 focus:outline-none placeholder:text-slate-400 dark:text-white"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-primary text-white text-sm font-bold hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isLoading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" aria-hidden="true" />
          ) : (
            locale === 'ko' ? '구독' : 'Join'
          )}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
        className="w-full rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="bg-primary text-white rounded-lg px-3 py-2 hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-white" aria-hidden="true" />
        ) : (
          <span className="text-sm font-bold">{locale === 'ko' ? '구독' : 'Join'}</span>
        )}
      </button>
    </form>
  );
}
