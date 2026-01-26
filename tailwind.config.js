/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],

  theme: {
    extend: {
      colors: {
        primary: '#0b1120',
        'theme-primary': '#1d4ed8',
        secondary: '#0b1120',
        accent: '#14b8a6',
        'app-primary': '#1d4ed8',
        alt: '#f4b000',
        mtn: '#1d4ed8',
        'dstv-blue': '#0071b0',
        light: {
          100: '#f3f3f3',
          200: '#a8b5db',
          300: '#9ca4ab',
        },
        dark: {
          100: '#111827',
          200: '#0b1120',
          300: '#9ca4ab',
        },
      },
    },
  },
  plugins: [],
}
