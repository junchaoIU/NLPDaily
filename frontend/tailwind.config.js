/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0f1419',
          light: '#1a1f2e',
          lighter: '#2a3040',
        },
        parchment: {
          DEFAULT: '#e8e4d9',
          muted: '#a0a0a0',
        },
        'amber-gold': {
          DEFAULT: '#d4a853',
          light: '#e8c87a',
        },
        wine: '#8b3a3a',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        body: ['Manrope', 'sans-serif'],
        'serif-body': ['Newsreader', 'serif'],
      },
    },
  },
  plugins: [],
}
