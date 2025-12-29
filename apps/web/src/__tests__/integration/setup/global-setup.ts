import { execSync, spawnSync } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

export default async function globalSetup() {
  console.log('\n🚀 Starting integration test setup...')

  // Find the supabase directory (relative to monorepo root)
  const monorepoRoot = path.resolve(__dirname, '../../../../../../')
  const supabaseDir = path.join(monorepoRoot, 'supabase')

  if (!fs.existsSync(supabaseDir)) {
    throw new Error(`Supabase directory not found at ${supabaseDir}`)
  }

  // Check if Supabase is already running
  const isRunning = checkSupabaseRunning(monorepoRoot)

  if (!isRunning) {
    console.log('📦 Starting local Supabase...')
    try {
      execSync('supabase start', {
        cwd: monorepoRoot,
        stdio: 'inherit'
      })
    } catch {
      // Supabase might already be starting/running
      console.log('⚠️ Supabase start command returned an error (may already be running)')
    }

    // Wait for Supabase to be ready
    await waitForSupabase(monorepoRoot)
  } else {
    console.log('✅ Supabase already running')
  }

  // Reset database to clean state
  console.log('🔄 Resetting database...')
  try {
    execSync('supabase db reset', {
      cwd: monorepoRoot,
      stdio: 'inherit'
    })
  } catch (error) {
    console.error('Failed to reset database:', error)
    throw error
  }

  // Apply test fixtures if they exist
  const fixturesPath = path.join(__dirname, 'test-fixtures.sql')
  if (fs.existsSync(fixturesPath)) {
    console.log('📋 Applying test fixtures...')
    try {
      // Use spawnSync with explicit arguments to avoid shell injection vulnerabilities
      const result = spawnSync('psql', [
        'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
        '-f',
        fixturesPath
      ], {
        cwd: monorepoRoot,
        stdio: 'inherit'
      })
      if (result.status !== 0) {
        console.log('⚠️ Note: Some fixtures may not have been applied')
      }
    } catch {
      // Fixtures might have already been applied or table doesn't exist yet
      console.log('⚠️ Note: Some fixtures may not have been applied')
    }
  }

  console.log('✅ Integration test setup complete!\n')
}

function checkSupabaseRunning(cwd: string): boolean {
  try {
    const result = spawnSync('supabase', ['status'], {
      cwd,
      encoding: 'utf8',
      timeout: 10000
    })
    return result.status === 0 && result.stdout.includes('API URL')
  } catch {
    return false
  }
}

async function waitForSupabase(cwd: string, maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    if (checkSupabaseRunning(cwd)) {
      return
    }
    console.log(`⏳ Waiting for Supabase... (${i + 1}/${maxAttempts})`)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  throw new Error('Supabase failed to start within timeout')
}
