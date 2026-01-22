// example/with-server/vite.config.ts
import { defineConfig } from "file:///C:/Users/lithd/Documents/trae_projects/webc-file-view/packages/chaxai-client/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/lithd/Documents/trae_projects/webc-file-view/packages/chaxai-client/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { resolve } from "path";
var __vite_injected_original_dirname = "C:\\Users\\lithd\\Documents\\trae_projects\\webc-file-view\\packages\\chaxai-client\\example\\with-server";
var vite_config_default = defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__vite_injected_original_dirname, "../../src")
    }
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      "/ai": {
        target: `http://localhost:${process.env.VITE_SERVER_PORT || 3e3}`,
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    target: "esnext"
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiZXhhbXBsZS93aXRoLXNlcnZlci92aXRlLmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXGxpdGhkXFxcXERvY3VtZW50c1xcXFx0cmFlX3Byb2plY3RzXFxcXHdlYmMtZmlsZS12aWV3XFxcXHBhY2thZ2VzXFxcXGNoYXhhaS1jbGllbnRcXFxcZXhhbXBsZVxcXFx3aXRoLXNlcnZlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcbGl0aGRcXFxcRG9jdW1lbnRzXFxcXHRyYWVfcHJvamVjdHNcXFxcd2ViYy1maWxlLXZpZXdcXFxccGFja2FnZXNcXFxcY2hheGFpLWNsaWVudFxcXFxleGFtcGxlXFxcXHdpdGgtc2VydmVyXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9saXRoZC9Eb2N1bWVudHMvdHJhZV9wcm9qZWN0cy93ZWJjLWZpbGUtdmlldy9wYWNrYWdlcy9jaGF4YWktY2xpZW50L2V4YW1wbGUvd2l0aC1zZXJ2ZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJztcbmltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW3Z1ZSgpXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vc3JjJyksXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogMzAwMSxcbiAgICBvcGVuOiB0cnVlLFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FpJzoge1xuICAgICAgICB0YXJnZXQ6IGBodHRwOi8vbG9jYWxob3N0OiR7cHJvY2Vzcy5lbnYuVklURV9TRVJWRVJfUE9SVCB8fCAzMDAwfWAsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICB0YXJnZXQ6ICdlc25leHQnLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNlLFNBQVMsb0JBQW9CO0FBQ25nQixPQUFPLFNBQVM7QUFDaEIsU0FBUyxlQUFlO0FBRnhCLElBQU0sbUNBQW1DO0FBSXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxJQUFJLENBQUM7QUFBQSxFQUNmLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssUUFBUSxrQ0FBVyxXQUFXO0FBQUEsSUFDckM7QUFBQSxFQUNGO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxPQUFPO0FBQUEsUUFDTCxRQUFRLG9CQUFvQixRQUFRLElBQUksb0JBQW9CLEdBQUk7QUFBQSxRQUNoRSxjQUFjO0FBQUEsUUFDZCxRQUFRO0FBQUEsTUFDVjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsRUFDVjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
