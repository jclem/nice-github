import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: true,
    outDir: resolve(root, "dist"),
    minify: false,
    sourcemap: false,
    target: "es2022",
    lib: {
      entry: resolve(root, "src/content.ts"),
      name: "NiceGithubContent",
      formats: ["iife"],
      fileName: () => "content.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      name: "copy-manifest",
      closeBundle() {
        mkdirSync(resolve(root, "dist"), { recursive: true });
        copyFileSync(resolve(root, "manifest.json"), resolve(root, "dist/manifest.json"));
      },
    },
  ],
});
