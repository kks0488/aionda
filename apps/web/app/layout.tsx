import type { Metadata } from 'next';
import { BASE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'AI온다 - AI가 온다',
    template: '%s | AI온다',
  },
  description: 'AI 기술과 트렌드를 검증된 정보로 전달하는 블로그. Curated AI & Technology insights from Korea.',
  keywords: ['AI', '인공지능', 'artificial intelligence', 'GPT', 'LLM', 'machine learning', '머신러닝', 'tech news', 'AI news'],
  authors: [{ name: 'AI온다', url: BASE_URL }],
  creator: 'AI온다',
  publisher: 'AI온다',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    alternateLocale: 'en_US',
    url: BASE_URL,
    siteName: 'AI온다',
    title: 'AI온다 - AI가 온다',
    description: 'AI 기술과 트렌드를 검증된 정보로 전달하는 블로그',
    images: [
      {
        url: `${BASE_URL}/api/og-default`,
        width: 1200,
        height: 630,
        alt: 'AI온다',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI온다 - AI가 온다',
    description: 'AI 기술과 트렌드를 검증된 정보로 전달하는 블로그',
    images: [`${BASE_URL}/api/og-default`],
  },
  verification: {
    google: '', // Google Search Console 인증 코드 추가 예정
  },
  alternates: {
    canonical: BASE_URL,
    languages: {
      'en': `${BASE_URL}/en`,
      'ko': `${BASE_URL}/ko`,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
