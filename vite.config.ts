import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

declare const process: { env: Record<string, string | undefined> }

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    host: '0.0.0.0',
    port: 5174,
    strictPort: true,
    proxy: { '/api/v1/catalog': { target: 'http://127.0.0.1:8780', changeOrigin: false } },
  },
  preview: {
    host: '0.0.0.0',
    port: 4174,
    strictPort: true,
  },
})
