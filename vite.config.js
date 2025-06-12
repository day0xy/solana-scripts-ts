import { defineConfig } from 'vite'

export default defineConfig({
  root: './web',
  build: {
    outDir: '../dist-web',
    emptyOutDir: true
  },
  server: {
    port: 3000,
    open: true
  },
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      util: 'util'
    }
  },
  optimizeDeps: {
    include: ['buffer', 'crypto-browserify', 'stream-browserify', 'util']
  }
})
