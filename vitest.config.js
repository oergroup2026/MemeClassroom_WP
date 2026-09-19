import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Rules tests share one emulator instance, so they must not run in
    // parallel with each other — each clears the database between cases.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
