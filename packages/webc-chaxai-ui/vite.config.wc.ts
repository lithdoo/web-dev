import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  define: {
    // 全面替换process相关引用，避免在浏览器中出现process未定义错误
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'index.wc.ts'),
      name: 'WebcFileViewWC',
      fileName: () => 'webc-file-view.wc.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: [
        { format: 'iife', name: 'WebcFileViewWC' }
      ]
    }
  }
});
