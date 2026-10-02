import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dev server proxies /api to FastAPI so the browser sees a single origin
// (cookies stay SameSite=Strict + HttpOnly, no CORS in play).
const target = process.env.CYBRSYNC_API || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target, changeOrigin: false, secure: !target.includes('localhost') && !target.includes('127.0.0.1') },
    },
  },
  build: { sourcemap: false },
})
