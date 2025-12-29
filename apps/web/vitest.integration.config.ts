import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'integration',
    include: ['src/__tests__/integration/**/*.integration.test.ts'],
    environment: 'node', // Not jsdom - these are server-side tests
    globals: true,
    testTimeout: 30000, // DB operations can be slow
    hookTimeout: 60000,
    globalSetup: './src/__tests__/integration/setup/global-setup.ts',
    pool: 'forks', // Isolate tests to prevent connection issues
    poolOptions: {
      forks: {
        singleFork: true // Run sequentially to avoid DB conflicts
      }
    },
    // Load environment variables from .env.test if it exists
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
