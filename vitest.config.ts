import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Match the build (vite.config.ts) — resolve strata to the vendored copy
      // so tests don't depend on an installed/undeclared node_modules package.
      "@mattfletcher94/strata": path.resolve(__dirname, "./vendors/strata/index.js"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "happy-dom",
  },
});
