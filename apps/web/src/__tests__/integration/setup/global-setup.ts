import { execSync } from 'child_process'
import path from 'path'

export default async function globalSetup() {
  console.log('\n🔧 Setting up integration tests...')

  const projectRoot = path.resolve(__dirname, '../../../../../..')

  // Check if Supabase is already running
  try {
    execSync('supabase status', {
      stdio: 'pipe',
      cwd: projectRoot
    })
    console.log('✅ Supabase already running')
  } catch {
    console.log('🚀 Starting Supabase...')
    try {
      execSync('supabase start', {
        stdio: 'inherit',
        cwd: projectRoot
      })
      console.log('✅ Supabase started')
    } catch (error) {
      console.error('❌ Failed to start Supabase:', error)
      throw new Error('Failed to start Supabase. Please run "supabase start" manually.')
    }
  }

  // Reset database to clean state
  console.log('🔄 Resetting database...')
  try {
    // Reset without seed to get a clean slate
    execSync('supabase db reset --no-seed', {
      stdio: 'inherit',
      cwd: projectRoot
    })
    console.log('✅ Database reset complete')
  } catch (error) {
    console.error('❌ Failed to reset database:', error)
    throw new Error('Failed to reset database')
  }

  // Apply test fixtures
  console.log('📦 Applying test fixtures...')
  try {
    const fixturesPath = path.resolve(__dirname, 'test-fixtures.sql')
    execSync(`psql "postgresql://postgres:postgres@localhost:54322/postgres" -f "${fixturesPath}"`, {
      stdio: 'inherit',
      cwd: projectRoot
    })
    console.log('✅ Test fixtures applied')
  } catch {
    // Fixtures are optional, don't fail if file doesn't exist
    console.log('⚠️ No test fixtures applied (file may not exist or psql not available)')
  }

  console.log('✅ Integration test setup complete\n')
}
