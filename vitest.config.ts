import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: { alias: { "@": resolve(__dirname, ".") } },
  test: {
    environment: "node",
    // Tests share one database and drop it between cases, so they must not
    // interleave. Correctness over speed for a suite this small.
    fileParallelism: false,
    env: {
      MONGODB_URI: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27077",
      MONGODB_DB: "drop_test",
    },
  },
});
