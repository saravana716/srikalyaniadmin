import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/expo-push': {
        target: 'https://exp.host/--/api/v2/push/send',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/expo-push/, '')
      }
    }
  }
})
