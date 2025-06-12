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
      // 添加路径别名，让前端可以访问钱包管理文件夹
      '@wallet': '/钱包管理'
    }
  },
  optimizeDeps: {
    include: ['buffer', '@solana/web3.js', 'bip39', 'bs58']
  },
  esbuild: {
    target: 'esnext'
  }
})
