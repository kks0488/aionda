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
        <span className="material-symbols-outlined text-xl">check_circle</span>
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
            <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
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
          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
        ) : (
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        )}
      </button>
    </form>
  );
}
