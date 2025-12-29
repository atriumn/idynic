export default async function globalTeardown() {
  console.log('\n=== Integration Test Teardown ===\n')

  // Note: We intentionally do NOT stop Supabase here
  // This allows for faster subsequent test runs during development
  // The database is reset at the start of each test run anyway

  console.log('Teardown complete (Supabase left running for faster re-runs)')
  console.log('To stop Supabase manually, run: supabase stop')

  console.log('\n=== Integration Test Teardown Complete ===\n')
}
