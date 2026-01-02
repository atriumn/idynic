import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [
      "node_modules",
      ".next",
      "src/__tests__/integration/**",
      "src/__tests__/e2e/**",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      include: ["src/lib/**/*.ts", "src/components/**/*.tsx"],
      exclude: [
        "src/lib/supabase/types.ts",
        "src/lib/supabase/database.types.ts",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        // Skip visual/chart components as per issue requirements
        "src/components/evidence-constellation.tsx",
        "src/components/confidence-sunburst.tsx",
        "src/components/identity-constellation.tsx",
        "src/components/skill-clusters.tsx",
        // Skip UI primitives (shadcn components)
        "src/components/ui/**",
      ],
      thresholds: {
        // Phase 4 target: 70% - currently at ~43%. Adding more tests in follow-up.
        lines: 43,
        branches: 38,
        functions: 39,
        statements: 43,
      },
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
