import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import path from "node:path";

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: "./tsconfig.json",
      outDir: "dist",
      entryRoot: "src",
      exclude: ["test/**"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: {
        index: path.resolve(__dirname, "src/index.ts"),
        "constraints/index": path.resolve(__dirname, "src/constraints/index.ts"),
        "utils/index": path.resolve(__dirname, "src/utils/index.ts"),
        "controls/index": path.resolve(__dirname, "src/controls/index.ts"),
        "easing/index": path.resolve(__dirname, "src/easing/index.ts"),
      },
      formats: ["es"],
    },
    rolldownOptions: {
      // Externalised: vue (consumer's app provides it) and strata (a normal
      // runtime dependency, deduped via the consumer's install).
      external: ["vue", /^@mattfletcher94\/strata/],
      output: {
        chunkFileNames: "_chunks/[name]-[hash].js",
      },
    },
  },
});
