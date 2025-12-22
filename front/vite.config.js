import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// API port: 3000 (matching server config)
const API_PORT = process.env.VITE_API_PORT || process.env.API_PORT || 3000;

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
    // Agregar hash a los archivos para evitar caché
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    terserOptions: {
      compress: {
        drop_console: false, // Mantener console.logs para debug en producción
        drop_debugger: true
      }
    }
  },
  // In production, API calls will go to the same domain (handled by nginx/reverse proxy)
  base: '/'
})
