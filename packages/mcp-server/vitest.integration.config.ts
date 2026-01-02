import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'integration',
    include: ['src/__tests__/integration/**/*.integration.test.ts', 'src/__tests__/e2e/**/*.e2e.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 30000, // 30s for API operations
    hookTimeout: 60000, // 60s for setup/teardown
    sequence: {
      concurrent: false, // Run sequentially to avoid race conditions
    },
    retry: 1, // Retry once on failure for flaky network tests
  },
})
