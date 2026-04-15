import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        steer: { DEFAULT: '#6C47FF', light: '#EDE9FE', dark: '#4F35CC' },
        skill: { DEFAULT: '#0F766E', light: '#CCFBF1', dark: '#0D5C56' },
        critical: '#EF4444',
        warning: '#F97316',
        success: '#22C55E',
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      borderRadius: { xl: '16px', '2xl': '24px' },
    },
  },
  plugins: [],
};

export default config;
