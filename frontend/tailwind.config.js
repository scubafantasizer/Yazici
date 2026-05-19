/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg0: '#0d0e14',
        bg1: '#13141d',
        bg2: '#1a1b27',
        bg3: '#22243a',
        border: '#2a2c42',
        accent: '#7c6af7',
        text: '#cdd6f4',
        text2: '#7f849c',
      }
    },
  },
  plugins: [],
}

