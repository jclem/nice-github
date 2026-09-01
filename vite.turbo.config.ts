import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: resolve(root, "dist"),
    minify: false,
    sourcemap: false,
    target: "es2022",
    lib: {
      entry: resolve(root, "src/turbo-navigation.ts"),
      name: "NiceGithubTurboNavigation",
      formats: ["iife"],
      fileName: () => "turbo-navigation.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
