'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function Footer() {
  const params = useParams();
  const locale = (params.locale as string) || 'ko';
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 dark:border-gray-800 py-12 bg-gray-50 dark:bg-[#101922] mt-auto">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-500 dark:text-slate-400">
            © {year} Aionda
          </span>
        </div>

        <div className="flex gap-6 text-sm font-medium text-slate-500 dark:text-slate-400">
          <Link href={`/${locale}/posts`} className="hover:text-primary transition-colors">
            {locale === 'ko' ? '글' : 'Posts'}
          </Link>
          <Link href={`/${locale}/tags`} className="hover:text-primary transition-colors">
            {locale === 'ko' ? '태그' : 'Tags'}
          </Link>
          <Link href={`/${locale}/privacy`} className="hover:text-primary transition-colors">
            {locale === 'ko' ? '개인정보 처리방침' : 'Privacy'}
          </Link>
          <Link href={`/${locale}/terms`} className="hover:text-primary transition-colors">
            {locale === 'ko' ? '이용약관' : 'Terms'}
          </Link>
          <Link href={`/${locale}/about`} className="hover:text-primary transition-colors">
            {locale === 'ko' ? '소개' : 'About'}
          </Link>
          <a href="/feed.xml" className="hover:text-primary transition-colors">
            RSS
          </a>
        </div>
      </div>
    </footer>
  );
}
