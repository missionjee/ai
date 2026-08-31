import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpg', 'bg.jpg'],
      manifest: {
        name: 'HIROTO AI — Institutional Terminal',
        short_name: 'HIROTO AI',
        description: 'High-precision institutional predictive signal intelligence terminal',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'logo.jpg', sizes: '192x192', type: 'image/jpeg', purpose: 'any maskable' },
          { src: 'logo.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg}'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tirangaprediction\.ai\/.*/i,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  }
})
