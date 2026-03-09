/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6C3CE1',
          dark: '#4B2AAA',
          light: '#9B6EF5',
        },
      },
    },
  },
  plugins: [],
};
