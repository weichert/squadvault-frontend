import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Minimal Vitest config. The ONLY new dependency is `vitest` itself: the `@/` path
// alias is resolved here inline (mirroring tsconfig `paths`) rather than by pulling in
// `vite-tsconfig-paths`, and the suite runs in the `node` environment because both
// functions under test are pure (no DOM / React), so no jsdom is needed either.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
