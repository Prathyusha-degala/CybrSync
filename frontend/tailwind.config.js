/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'ui-monospace', 'Consolas', 'monospace'],
      },
      keyframes: {
        fadein: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
        flow: { from: { backgroundPosition: '0 0' }, to: { backgroundPosition: '24px 0' } },
      },
      animation: {
        fadein: 'fadein .35s ease-out both',
        flow: 'flow 1s linear infinite',
      },
    },
  },
  plugins: [],
}
