import { defineConfig } from "vite";

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5196",
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: "../wwwroot",
    emptyOutDir: true,
    assetsDir: "app"
  }
});
