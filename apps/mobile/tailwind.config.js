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
        primary: '#FF5C1A',
        'primary-dark': '#D94A10',
        accent: '#FF9500',
        background: '#F7F6F3',
        surface: '#FFFFFF',
        'surface-light': '#EFEFEC',
        border: '#E2E0DA',
        'text-base': '#1C1A17',
        'text-muted': '#7A7670',
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
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
