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
      // Inline vendored strata's types into our .d.ts output so consumers
      // get a self-contained type surface.
      bundledPackages: ["@mattfletcher94/strata"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@mattfletcher94/strata": path.resolve(__dirname, "./vendors/strata/index.js"),
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
      // Strata is bundled into our output; only vue stays external
      // (consumer's app provides it).
      external: ["vue"],
      output: {
        chunkFileNames: "_chunks/[name]-[hash].js",
      },
    },
  },
});
