export default async function globalTeardown() {
  console.log('\n🧹 Integration test teardown...')

  // Note: We don't stop Supabase here since it might be used for local development
  // or other test runs. The database is reset at the start of each test run anyway.

  console.log('✅ Teardown complete!\n')
}
