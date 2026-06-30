/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        purple: {
          50: '#f0f5fc',
          100: '#e1ecf7',
          600: '#0056B3', // Coursera commanding Royal Blue
          650: '#004191',
          700: '#004191',
          750: '#003370',
          800: '#002554',
        },
        indigo: {
          50: '#eef9fa',
          600: '#007A87', // Coursera vibrant Teal
          650: '#006670',
          700: '#00525A',
        }
      }
    },
  },
  plugins: [],
}
