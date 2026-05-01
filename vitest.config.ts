import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@db": path.resolve(__dirname, "db"),
      "@assets": path.resolve(__dirname, "assets"),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["__tests__/**/*.test.ts"],
    setupFiles: ["./__tests__/setup.ts"],
    pool: "forks",
  },
});
