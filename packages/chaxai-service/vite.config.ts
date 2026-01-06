import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

// 后端项目的 Vite 配置
export default defineConfig({
  // 配置为库模式，适合后端项目
build: {
    // 输出目录
    outDir: 'dist',
    // 配置为库模式
    lib: {
      // 入口文件
      entry: './src/index.ts',
      // 库的名称
      name: 'chaxai-service',
      // 输出格式：ES 模块和 CommonJS
      formats: ['es', 'cjs'],
      // 文件名
      fileName: (format) => `index.${format}.js`,
    },
    // 不生成 sourcemap
    sourcemap: false,
    // 清空输出目录
    emptyOutDir: true,
    // 配置 Rollup
    rollupOptions: {
      // 外部依赖，不打包到输出文件中
      external: [
        '@langchain/core',
        '@langchain/deepseek',
        'koa',
        'langchain',
        'uuid'
      ],
    },
  },
  // 使用 tsconfig-paths 插件，支持 tsconfig.json 中的路径别名
  plugins: [tsconfigPaths()],
});
