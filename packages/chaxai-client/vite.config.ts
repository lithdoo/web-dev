import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ChaxaiCommon',
      formats: ['es', 'cjs'],
      fileName: (format) => `chaxai-common.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      output: [
        {
          format: 'es',
          entryFileNames: 'chaxai-common.js',
          preserveModules: false,
        },
        {
          format: 'cjs',
          entryFileNames: 'chaxai-common.cjs',
          preserveModules: false,
        },
      ],
      external: [],
    },
    target: 'esnext',
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
