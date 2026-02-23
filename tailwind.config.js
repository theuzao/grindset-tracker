/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'primary': '#2e2ed1',
        'background-dark': '#0e0e0e',
        'background-light': '#f6f8f6',
        'bg': {
          primary: '#0e0e0e',
          secondary: '#141414',
          tertiary: '#1a1a1a',
          hover: '#222222',
        },
        'accent': {
          DEFAULT: '#2e2ed1',
          secondary: '#2424a8',
        },
        'border': {
          DEFAULT: '#30363D',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(46, 46, 209, 0.3)',
        'glow-sm': '0 0 10px rgba(46, 46, 209, 0.2)',
      },
    },
  },
  plugins: [],
}
