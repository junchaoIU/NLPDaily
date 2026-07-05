/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ink': {
          DEFAULT: '#0f1419',
          light: '#1a1f2e',
          lighter: '#252b3d',
        },
        'parchment': {
          DEFAULT: '#e8e4d9',
          dim: '#c5c0b4',
          muted: '#8a8579',
        },
        'amber-gold': {
          DEFAULT: '#d4a574',
          light: '#e8c9a0',
          dark: '#b88a5a',
        },
        'wine': {
          DEFAULT: '#7a3b3b',
          light: '#9a5a5a',
        },
      },
      fontFamily: {
        'display': ['Fraunces', 'serif'],
        'body': ['Manrope', 'sans-serif'],
        'serif-body': ['Newsreader', 'serif'],
      },
    },
  },
  plugins: [],
}
