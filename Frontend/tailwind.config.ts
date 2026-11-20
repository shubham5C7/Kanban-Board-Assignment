import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#c7d9fe',
          300: '#a5bffd',
          400: '#7e9dfa',
          500: '#5375f4',
          600: '#3b54e7',
          700: '#2f41cb',
          800: '#2937a4',
          900: '#263381',
        },
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.08), 0 1px 2px -1px rgba(0, 0, 0, 0.08)',
        float: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'highlight-fade': 'highlightFade 1.4s ease-out forwards',
        'fade-in': 'fadeIn 180ms ease-out',
        'slide-in': 'slideIn 220ms cubic-bezier(0.2, 0, 0, 1)',
      },
      keyframes: {
        highlightFade: {
          '0%': { backgroundColor: 'rgba(99, 102, 241, 0.25)', borderColor: '#6366f1' },
          '100%': { backgroundColor: 'transparent' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
