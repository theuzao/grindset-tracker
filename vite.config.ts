import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/anki-api': {
        target: 'http://localhost:8765',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anki-api/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', 'http://localhost');
          });
        },
      },
      '/canvas-api': {
        target: process.env.CANVAS_URL || 'https://canvas.instructure.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/canvas-api/, '/api/v1'),
      },
    },
  },
})
