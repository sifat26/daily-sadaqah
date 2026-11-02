import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#176B45',
        darkGreen: '#104B34',
        gold: '#C9A44C',
        goldLight: '#E8CA7C',
        surfaceBg: '#F8FAF7',
        textMain: '#1F2937',
        textMuted: '#6B7280',
        bkash: '#E2136E',
        nagad: '#F7941D',
      },
      fontFamily: {
        sans: ['Hind Siliguri', 'Noto Sans Bengali', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
