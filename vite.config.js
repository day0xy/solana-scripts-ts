import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: './web',
  envDir: '../', // 指定 .env 文件在上级目录
  build: {
    outDir: '../dist-web',
    emptyOutDir: true,
    rollupOptions: {
      external: [],
    }
  },
  server: {
    port: 3000,
    open: true
  },
  define: {
    global: 'globalThis',
    'process.env': {},
    'process.browser': true
  },
  resolve: {
    alias: {
      // 添加路径别名，让前端可以访问钱包管理文件夹
      '@wallet': '/钱包管理',
      buffer: 'buffer',
      stream: 'stream-browserify',
      util: 'util'
    }
  },
  optimizeDeps: {
    include: ['buffer', '@solana/web3.js', 'bip39', 'bs58'],
    exclude: []
  },
  esbuild: {
    target: 'esnext'
  }
})
