import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Vercel can return 402 for `/_next/image` optimization requests on some plans/quotas.
    // We serve images directly from `/public` to avoid broken thumbnails/covers.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dcimg*.dcinside.com',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
