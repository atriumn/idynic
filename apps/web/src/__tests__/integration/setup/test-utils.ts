import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Local Supabase configuration
// These are the default keys for local development - safe to commit
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/**
 * Returns a Supabase client with service role (admin) privileges.
 * Use this for setup/teardown operations that bypass RLS.
 */
export function getAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Returns a Supabase client with anonymous role.
 * Use this to test unauthenticated access.
 */
export function getAnonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

/**
 * Creates a test user via the admin API.
 * Returns the user object with id.
 */
export async function createTestUser(
  email: string,
  password: string,
  metadata?: { name?: string }
): Promise<{ id: string; email: string }> {
  const adminClient = getAdminClient()

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for testing
    user_metadata: metadata
  })

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`)
  }

  if (!data.user) {
    throw new Error('No user returned from createUser')
  }

  return { id: data.user.id, email: data.user.email! }
}

/**
 * Deletes a test user and all their data via the admin API.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const adminClient = getAdminClient()

  const { error } = await adminClient.auth.admin.deleteUser(userId)

  if (error) {
    // Don't throw on delete errors - user might already be deleted
    console.warn(`Warning: Could not delete test user ${userId}: ${error.message}`)
  }
}

/**
 * Creates an authenticated Supabase client for a user.
 * Signs in with the provided credentials and returns a client with their session.
 */
export async function createAuthenticatedClient(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  const { error } = await client.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    throw new Error(`Failed to sign in: ${error.message}`)
  }

  return client
}

/**
 * Generates a unique email for testing to avoid conflicts.
 */
export function generateTestEmail(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(7)
  return `test-${timestamp}-${random}@test.local`
}

/**
 * Test user helper that creates a user and returns cleanup function.
 * Use this in beforeAll/afterAll blocks.
 */
export async function setupTestUser(
  email?: string,
  password: string = 'testpassword123'
): Promise<{
  user: { id: string; email: string }
  client: SupabaseClient
  cleanup: () => Promise<void>
}> {
  const testEmail = email || generateTestEmail()
  const user = await createTestUser(testEmail, password)
  const client = await createAuthenticatedClient(testEmail, password)

  return {
    user,
    client,
    cleanup: async () => {
      await deleteTestUser(user.id)
    }
  }
}

/**
 * Wait for profile to be created by trigger.
 * The database trigger creates a profile when a user signs up,
 * but it might take a moment to execute.
 */
export async function waitForProfile(
  client: SupabaseClient,
  userId: string,
  maxAttempts: number = 10
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (data) {
      return true
    }

    // Wait 100ms before retrying
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return false
}
