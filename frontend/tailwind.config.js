/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        govNavy: '#002f6c',
        govGray: '#f4f5f7',
        govWhite: '#ffffff',
        govGreen: '#2e7d32',
        govRed: '#c62828',
        govLightBlue: '#e1f5fe'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
