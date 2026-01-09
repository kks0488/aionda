'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';

export default function Footer() {
  const t = useTranslations('footer');
  const params = useParams();
  const locale = params.locale as string || 'ko';

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-8 mt-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="font-bold text-lg text-accent">AI온다</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {locale === 'ko' ? 'AI가 온다' : 'AI is Coming'}
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
            <Link
              href={`/${locale}/about`}
              className="hover:text-gray-900 dark:hover:text-gray-100"
            >
              {locale === 'ko' ? '소개' : 'About'}
            </Link>
            <Link
              href={`/${locale}/privacy`}
              className="hover:text-gray-900 dark:hover:text-gray-100"
            >
              {t('privacy')}
            </Link>
            <Link
              href={`/${locale}/terms`}
              className="hover:text-gray-900 dark:hover:text-gray-100"
            >
              {t('terms')}
            </Link>
            <a
              href="/feed.xml"
              className="hover:text-gray-900 dark:hover:text-gray-100"
              title="RSS Feed"
            >
              RSS
            </a>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© {new Date().getFullYear()} {t('copyright')}</p>
          <p className="mt-2">
            Curated from{' '}
            <a
              href="https://gall.dcinside.com/mgallery/board/lists?id=thesingularity"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              DC Inside Singularity Gallery
            </a>
            {' '}• Powered by AI
          </p>
        </div>
      </div>
    </footer>
  );
}
