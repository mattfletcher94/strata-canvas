import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

const srcRoot = path.resolve(__dirname, "../src");

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  resolve: {
    alias: [
      // Subpath exports must be matched before the bare specifier.
      {
        find: "@mattfletcher94/strata-canvas/constraints",
        replacement: path.resolve(srcRoot, "constraints/index.ts"),
      },
      {
        find: "@mattfletcher94/strata-canvas/utils",
        replacement: path.resolve(srcRoot, "utils/index.ts"),
      },
      {
        find: "@mattfletcher94/strata-canvas/controls",
        replacement: path.resolve(srcRoot, "controls/index.ts"),
      },
      {
        find: "@mattfletcher94/strata-canvas/easing",
        replacement: path.resolve(srcRoot, "easing/index.ts"),
      },
      {
        find: "@mattfletcher94/strata-canvas",
        replacement: path.resolve(srcRoot, "index.ts"),
      },
      // Library's internal @/ alias must resolve when consumed from source.
      { find: "@", replacement: srcRoot },
      // @mattfletcher94/strata now resolves from node_modules (public npm).
    ],
  },
  server: { port: 5173, open: true },
});
