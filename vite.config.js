import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Delhivery Express API (avoids browser CORS during `npm run dev`)
      '/__delhivery': {
        target: 'https://track.delhivery.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__delhivery/, ''),
      },
    },
  },
})
