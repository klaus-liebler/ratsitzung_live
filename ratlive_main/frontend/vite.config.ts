import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, "../wwwroot/app"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/main.ts"),
      output: {
        entryFileNames: "ratsitzung.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
