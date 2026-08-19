import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Vite 只做开发服务器 + 构建：入口 src/index.html，引用 src/main.mjs。
// main.mjs 用相对路径导入父仓库的 lib/client/*.mjs，Vite 会一起打包。
export default defineConfig({
  root: resolve(__dirname, 'src'),
  base: './',
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '127.0.0.1',
    // Tauri v2 需要 devUrl 指向这里。允许读取上层 lib/ 源码。
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true,
  },
})
