import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@laravel-zero/client/react": fileURLToPath(
        new URL("./packages/client/src/react/index.ts", import.meta.url),
      ),
      "@laravel-zero/client": fileURLToPath(
        new URL("./packages/client/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["packages/**/*.test.{ts,tsx}", "tests/interop/**/*.test.ts"],
  },
});
