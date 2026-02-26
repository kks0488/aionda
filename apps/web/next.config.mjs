import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'mdx', 'ts', 'tsx'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dcimg*.dcinside.com',
      },
    ],
  },
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        './content/**',
        './public/images/**',
        '../../packages/**',
        '../../scripts/**',
        '../../data/**',
      ],
    },
  },
};

export default withNextIntl(nextConfig);
