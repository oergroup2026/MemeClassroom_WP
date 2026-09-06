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
          50: '#fff1f5',
          100: '#ffe4ec',
          200: '#fcccdb',
          300: '#fa99b7',
          400: '#f55b8b',
          500: '#eb2868',
          600: '#E0115F', // Ruby Primary
          650: '#c7094e',
          700: '#b00742',
          750: '#960638',
          800: '#7d0831',
          900: '#680a2c',
          950: '#3d0116',
        },
        ruby: {
          50: '#fff1f5',
          100: '#ffe4ec',
          200: '#fcccdb',
          300: '#fa99b7',
          400: '#f55b8b',
          500: '#eb2868',
          600: '#E0115F', // Ruby Core
          650: '#c7094e',
          700: '#b00742',
          750: '#960638',
          800: '#7d0831',
          900: '#680a2c',
          950: '#3d0116',
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
