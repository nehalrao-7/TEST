import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Unit tests run in Node (the lib/ helpers are framework-agnostic).
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
