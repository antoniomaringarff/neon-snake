import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API port: 3003 (changed from 3000 to match server config)
const API_PORT = process.env.VITE_API_PORT || process.env.API_PORT || 3003;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8008,
    proxy: {
      '/api': {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  // In production, API calls will go to the same domain (handled by nginx/reverse proxy)
  base: '/'
})
