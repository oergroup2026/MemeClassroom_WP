/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        serif: ['Instrument Serif', 'serif'],
        accent: ['Instrument Serif', 'serif'],
      },
      colors: {
        purple: {
          50: '#f5f3ff',
          100: '#ede9fe',
          600: '#7c3aed', // Modern Royal Purple
          650: '#6d28d9',
          700: '#6d28d9',
          750: '#5b21b6',
          800: '#4c1d95',
        },
        indigo: {
          50: '#eef2ff',
          600: '#4f46e5', // Vibrant Indigo
          650: '#4338ca',
          700: '#3730a3',
        },
        // Semantic color aliases to remove "AI-generated" color-naming confusion:
        brandBlue: {
          50: '#f0f5fc',
          100: '#e1ecf7',
          600: '#0056B3',
          650: '#004191',
          700: '#004191',
          750: '#003370',
          800: '#002554',
        },
        brandTeal: {
          50: '#eef9fa',
          600: '#007A87',
          650: '#006670',
          700: '#00525A',
        }
      }
    },
  },
  plugins: [],
}
