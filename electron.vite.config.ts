import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    build: {
      outDir: "out/main",
      rollupOptions: { input: { index: resolve("uygulama/ana/ana.ts") } },
    },
  },
  preload: {
    build: {
      outDir: "out/preload",
      rollupOptions: {
        input: { index: resolve("uygulama/onyukle/onyukle.ts") },
        // Sandbox'lı preload ESM olamaz.
        output: { format: "cjs", entryFileNames: "[name].cjs" },
      },
    },
  },
  renderer: {
    root: "uygulama/arayuz",
    plugins: [react()],
    build: {
      outDir: "out/renderer",
      rollupOptions: { input: { index: resolve("uygulama/arayuz/index.html") } },
    },
  },
});
