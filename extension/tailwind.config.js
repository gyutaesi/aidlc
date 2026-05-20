/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        moaring: {
          primary: '#3b82f6',
          'primary-hover': '#2563eb',
        },
      },
    },
  },
  plugins: [],
}
