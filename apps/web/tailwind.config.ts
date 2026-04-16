import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        /* Brand */
        steer: {
          DEFAULT: '#7c3aed',
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          dark: '#5b21b6',
          light: '#ede9fe',
        },
        skill: {
          DEFAULT: '#0d9488',
          50:  '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          dark: '#0f766e',
          light: '#ccfbf1',
        },
        /* Semantic shorthands */
        critical: '#ef4444',
        warning:  '#f59e0b',
        success:  '#10b981',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        xl:   '16px',
        '2xl':'24px',
        '3xl':'32px',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / .05)',
        sm: '0 1px 3px 0 rgb(0 0 0 / .08), 0 1px 2px -1px rgb(0 0 0 / .06)',
      },
      animation: {
        'fade-in-up':  'fadeInUp 0.3s ease forwards',
        'fade-in':     'fadeIn 0.25s ease forwards',
        'scale-in':    'scaleIn 0.2s ease forwards',
        'slide-right': 'slideInRight 0.25s ease forwards',
      },
    },
  },
  plugins: [],
};

export default config;
