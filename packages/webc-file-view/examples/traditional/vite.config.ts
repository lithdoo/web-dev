import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'webc-file-view': resolve(__dirname, '../../src/index.ts')
    }
  },
  server: {
    port: 3000
  }
})