import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/index.ts',
      name: 'chaxai-agent',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format}.js`,
    },
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      external: [
        '@langchain/core',
        '@langchain/deepseek',
        'koa',
        'langchain',
        'uuid'
      ],
    },
  },
  plugins: [tsconfigPaths()],
});
