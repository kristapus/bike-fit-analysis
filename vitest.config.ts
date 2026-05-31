import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["engine/**/*.ts"],
      exclude: [],
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      all: true,
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
