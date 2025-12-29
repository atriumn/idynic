import { execSync } from 'child_process'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Global setup for integration tests.
 * This runs once before all integration tests.
 *
 * It:
 * 1. Checks if Supabase is running, starts if not
 * 2. Resets the database to a clean state
 * 3. Applies test fixtures
 */
export default async function globalSetup() {
  console.log('\n[Integration Tests] Starting global setup...')

  // Set environment variables for local Supabase
  setLocalSupabaseEnv()

  // Check if Supabase is running
  const isRunning = await isSupabaseRunning()

  if (!isRunning) {
    console.log('[Integration Tests] Supabase not running. Starting...')
    try {
      // Start Supabase from the repo root
      execSync('supabase start', {
        cwd: getRepoRoot(),
        stdio: 'pipe',
        timeout: 120000 // 2 minutes for Supabase to start
      })
      console.log('[Integration Tests] Supabase started successfully')
    } catch (error) {
      console.error('[Integration Tests] Failed to start Supabase:', error)
      throw new Error('Failed to start Supabase. Run "supabase start" manually and try again.')
    }
  } else {
    console.log('[Integration Tests] Supabase already running')
  }

  // Reset the database to a clean state
  console.log('[Integration Tests] Resetting database...')
  try {
    execSync('supabase db reset --no-seed', {
      cwd: getRepoRoot(),
      stdio: 'pipe',
      timeout: 60000 // 1 minute for db reset
    })
    console.log('[Integration Tests] Database reset successfully')
  } catch (error) {
    console.error('[Integration Tests] Failed to reset database:', error)
    throw new Error('Failed to reset database. Check Supabase logs.')
  }

  // Reload PostgREST schema cache after database reset
  // This is necessary because PostgREST caches the schema and won't see
  // new tables/policies until it reloads
  console.log('[Integration Tests] Reloading PostgREST schema cache...')
  await reloadPostgrestSchema()
  console.log('[Integration Tests] Schema cache reloaded')

  // Apply test fixtures
  console.log('[Integration Tests] Applying test fixtures...')
  await applyTestFixtures()
  console.log('[Integration Tests] Test fixtures applied')

  console.log('[Integration Tests] Global setup complete\n')

  // Return teardown function
  return async () => {
    console.log('\n[Integration Tests] Global teardown complete')
    console.log('[Integration Tests] Note: Supabase is still running. Run "supabase stop" to stop it.\n')
  }
}

/**
 * Set environment variables for local Supabase.
 * These are the default local Supabase credentials.
 */
function setLocalSupabaseEnv() {
  // Local Supabase default URLs and keys
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
}

/**
 * Get the repository root directory.
 */
function getRepoRoot(): string {
  // Navigate from apps/web/src/__tests__/integration/setup to repo root
  return path.resolve(__dirname, '../../../../../../..')
}

/**
 * Check if local Supabase is running by attempting to connect.
 */
async function isSupabaseRunning(): Promise<boolean> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Try a simple health check
    const { error } = await supabase.from('profiles').select('id').limit(1)

    // If we get a connection error, Supabase isn't running
    if (error?.message?.includes('ECONNREFUSED') || error?.message?.includes('fetch failed')) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Apply test fixtures SQL file.
 */
async function applyTestFixtures(): Promise<void> {
  const fixturesPath = path.resolve(__dirname, 'test-fixtures.sql')

  if (!fs.existsSync(fixturesPath)) {
    console.log('[Integration Tests] No test fixtures file found, skipping...')
    return
  }

  const fixtureSql = fs.readFileSync(fixturesPath, 'utf-8')

  if (!fixtureSql.trim()) {
    console.log('[Integration Tests] Test fixtures file is empty, skipping...')
    return
  }

  // Execute the SQL via psql or supabase CLI
  try {
    execSync(`psql "${getPostgresConnectionString()}" -f "${fixturesPath}"`, {
      cwd: getRepoRoot(),
      stdio: 'pipe'
    })
  } catch {
    // If psql fails, try using Supabase's db execute
    try {
      execSync(`supabase db execute --file "${fixturesPath}"`, {
        cwd: getRepoRoot(),
        stdio: 'pipe'
      })
    } catch {
      console.warn('[Integration Tests] Could not apply fixtures via CLI, continuing...')
    }
  }
}

/**
 * Get the local PostgreSQL connection string.
 */
function getPostgresConnectionString(): string {
  return 'postgresql://postgres:postgres@localhost:54322/postgres'
}

/**
 * Reload PostgREST schema cache.
 * After database schema changes, PostgREST needs to reload its schema cache
 * to see new tables and policies. We do this by:
 * 1. Sending a NOTIFY to pgrst channel (the official way)
 * 2. Waiting a bit for PostgREST to process the notification
 * 3. Making a test request to verify the schema is loaded
 */
async function reloadPostgrestSchema(): Promise<void> {
  // Send NOTIFY to PostgREST to reload schema
  try {
    execSync(`psql "${getPostgresConnectionString()}" -c "NOTIFY pgrst, 'reload schema'"`, {
      cwd: getRepoRoot(),
      stdio: 'pipe'
    })
  } catch {
    // If psql fails, try supabase db execute
    try {
      execSync(`supabase db execute -c "NOTIFY pgrst, 'reload schema'"`, {
        cwd: getRepoRoot(),
        stdio: 'pipe'
      })
    } catch {
      console.warn('[Integration Tests] Could not send NOTIFY to PostgREST')
    }
  }

  // Wait for PostgREST to reload (it should be nearly instant, but give it some time)
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Verify by making a test request to ensure schema is loaded
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Try up to 5 times with 1 second delay to wait for schema to be available
  for (let i = 0; i < 5; i++) {
    const { error } = await supabase.from('documents').select('id').limit(1)
    if (!error || error.code !== 'PGRST205') {
      // Schema is loaded (either no error, or a different error like no rows)
      return
    }
    console.log(`[Integration Tests] Schema not yet loaded, waiting... (attempt ${i + 1}/5)`)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  throw new Error('PostgREST schema cache did not reload in time')
}
