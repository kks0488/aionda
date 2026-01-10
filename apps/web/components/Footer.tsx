'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function Footer() {
  const params = useParams();
  const locale = (params.locale as string) || 'ko';

  return (
    <footer className="border-t border-gray-100 dark:border-gray-800 py-12 bg-gray-50 dark:bg-[#101922] mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500">all_inclusive</span>
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">© 2025 Aionda</span>
        </div>

        <div className="flex gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
          <Link href={`/${locale}/privacy`} className="hover:text-primary transition-colors">
            Privacy
          </Link>
          <Link href={`/${locale}/terms`} className="hover:text-primary transition-colors">
            Terms
          </Link>
          <Link href={`/${locale}/about`} className="hover:text-primary transition-colors">
            About
          </Link>
          <a href="/feed.xml" className="hover:text-primary transition-colors">
            RSS
          </a>
        </div>
      </div>
    </footer>
  );
}
