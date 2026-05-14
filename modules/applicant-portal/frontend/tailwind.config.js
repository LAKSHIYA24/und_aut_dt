/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        govNavy: '#0b2f4a',
        govGray: '#f3f5f7',
        govGreen: '#1f5f3f',
        govRed: '#9b1c1c',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
