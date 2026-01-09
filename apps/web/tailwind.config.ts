import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        border: 'var(--border)',
      },
      typography: {
        DEFAULT: {
          css: {
            maxWidth: '72ch',
            fontSize: '1.125rem',
            lineHeight: '1.8',
            h1: {
              fontWeight: '700',
              letterSpacing: '-0.025em',
            },
            h2: {
              fontWeight: '600',
              letterSpacing: '-0.015em',
            },
            h3: {
              fontWeight: '600',
            },
            code: {
              backgroundColor: 'var(--muted)',
              padding: '0.2em 0.4em',
              borderRadius: '0.375rem',
              fontWeight: '400',
              fontFamily: 'var(--font-geist-mono)',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            a: {
              color: 'var(--accent)',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              '&:hover': {
                opacity: '0.8',
              },
            },
            blockquote: {
              borderLeftColor: 'var(--accent)',
              fontStyle: 'normal',
            },
          },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
