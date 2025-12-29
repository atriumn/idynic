/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
// @ts-expect-error - types not available in web package
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    name: 'integration',
    include: ['src/__tests__/integration/**/*.integration.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 60000,
    globalSetup: './src/__tests__/integration/setup/global-setup.ts',
    // Run tests sequentially since they share the same database
    sequence: {
      concurrent: false
    },
    // Retry on failure due to potential db state issues
    retry: 1
  }
})
