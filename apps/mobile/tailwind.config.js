/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
    '../../packages/ui/src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#6C63FF',
        'primary-dark': '#5A52D5',
        secondary: '#FF6584',
        background: '#0F0F14',
        surface: '#1A1A24',
        'surface-light': '#252535',
        border: '#2E2E40',
        'text-muted': '#8888A8',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
      maxWidth: {
        app: '390px',
      },
    },
  },
  plugins: [],
};
