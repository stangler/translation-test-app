import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#f7f1e4',
        text: '#2f3b52',
        red: '#d6473c',
        'red-light': '#f5e8e7',
        'card-bg': '#fffdf8',
        border: '#d4c9b0',
        blue: '#5c7a99',
        green: '#6f8f6a',
        gold: '#c99a3b',
      },
      fontFamily: {
        sans: ['var(--sans)'],
        mono: ['var(--mono)'],
      },
    },
  },
  plugins: [],
}
export default config