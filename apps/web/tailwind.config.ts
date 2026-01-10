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
        display: ['var(--font-space-grotesk)', 'var(--font-noto-sans-kr)', 'sans-serif'],
        body: ['var(--font-space-grotesk)', 'var(--font-noto-sans-kr)', 'sans-serif'],
      },
      colors: {
        primary: '#0d7ff2',
        accent: '#0d7ff2',
        background: {
          light: '#ffffff',
          dark: '#101922',
        },
        surface: {
          light: '#f8f9fa',
          dark: '#1a2332',
        },
        foreground: {
          DEFAULT: '#0f172a', // slate-900 (light) - use dark:text-white for dark mode
          muted: '#64748b',   // slate-500 (light) - use dark:text-slate-400 for dark mode
        },
        muted: {
          DEFAULT: '#f1f5f9', // slate-100 (light) - use dark:bg-slate-800 for dark mode
          foreground: '#64748b', // slate-500 (light) - use dark:text-slate-400 for dark mode
        },
        border: {
          DEFAULT: '#e2e8f0', // slate-200
          dark: '#334155',    // slate-700
        },
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
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
              backgroundColor: '#f1f5f9',
              padding: '0.2em 0.4em',
              borderRadius: '0.375rem',
              fontWeight: '400',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            a: {
              color: '#0d7ff2',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              '&:hover': {
                opacity: '0.8',
              },
            },
            blockquote: {
              borderLeftColor: '#0d7ff2',
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
