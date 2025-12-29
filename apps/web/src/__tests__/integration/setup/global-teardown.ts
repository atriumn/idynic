export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up integration tests...')

  // Note: We intentionally don't stop Supabase here because:
  // 1. It takes time to restart for the next test run
  // 2. The developer might want to inspect the database after tests
  // 3. The next test run will reset the database anyway

  console.log('✅ Teardown complete (Supabase left running for development)\n')
}
