import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()], // 移除自定义元素模式
  define: {
    // 全面替换process相关引用，避免在浏览器中出现process未定义错误
    'process.env.NODE_ENV': JSON.stringify('production'),
    'process': JSON.stringify({ env: { NODE_ENV: 'production' } }),
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WebcFileView',
      fileName: (format) => `webc-file-view.${format}.js`,
    },
    cssCodeSplit: true,
    rollupOptions: {
      external: ['vue'],
      output: [
        { format: 'es' }
      ]
    }
  }
});

