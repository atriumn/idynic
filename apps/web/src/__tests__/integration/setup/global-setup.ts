import { execSync } from 'child_process'
import path from 'path'

export default async function globalSetup() {
  console.log('\n=== Integration Test Setup ===\n')

  // Get the supabase directory (relative to the repo root)
  const repoRoot = path.resolve(__dirname, '../../../../../../')
  const supabaseDir = path.join(repoRoot, 'supabase')

  console.log(`Repo root: ${repoRoot}`)
  console.log(`Supabase dir: ${supabaseDir}`)

  // Check if Supabase is already running
  try {
    const status = execSync('supabase status', {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    console.log('Supabase is running')
    console.log(status)
  } catch (error) {
    // Supabase not running - start it
    console.log('Starting Supabase...')
    try {
      execSync('supabase start', {
        cwd: repoRoot,
        stdio: 'inherit'
      })
      console.log('Supabase started successfully')
    } catch (startError) {
      console.error('Failed to start Supabase:', startError)
      throw new Error('Failed to start Supabase. Make sure the Supabase CLI is installed.')
    }
  }

  // Reset database to clean state with seed data
  console.log('\nResetting database...')
  try {
    execSync('supabase db reset', {
      cwd: repoRoot,
      stdio: 'inherit'
    })
    console.log('Database reset successfully')
  } catch (resetError) {
    console.error('Failed to reset database:', resetError)
    throw new Error('Failed to reset database')
  }

  // Apply test fixtures
  console.log('\nApplying test fixtures...')
  const fixturesPath = path.join(__dirname, 'test-fixtures.sql')
  try {
    execSync(`psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f "${fixturesPath}"`, {
      cwd: repoRoot,
      stdio: 'inherit'
    })
    console.log('Test fixtures applied successfully')
  } catch (fixturesError) {
    // Fixtures are optional - don't fail if they can't be applied
    console.warn('Could not apply test fixtures (this may be OK if file does not exist):', fixturesError)
  }

  console.log('\n=== Integration Test Setup Complete ===\n')
}
