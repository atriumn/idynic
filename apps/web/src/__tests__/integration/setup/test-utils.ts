import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Local Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// Counter for generating unique test emails
let testUserCounter = 0

/**
 * Generate a unique test email address
 */
export function generateTestEmail(): string {
  testUserCounter++
  return `test-user-${testUserCounter}-${Date.now()}@test.local`
}

/**
 * Get an admin client with service role key (bypasses RLS)
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
 * Get an anonymous client (for testing public endpoints)
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
 * Create a test user via Supabase Auth admin API
 * This properly triggers the on_auth_user_created hook to auto-create the profile
 */
export async function createTestUser(
  email?: string,
  password: string = 'testpassword123',
  metadata?: Record<string, unknown>
): Promise<{
  userId: string
  email: string
  password: string
}> {
  const adminClient = getAdminClient()
  const testEmail = email || generateTestEmail()

  const { data, error } = await adminClient.auth.admin.createUser({
    email: testEmail,
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

  return {
    userId: data.user.id,
    email: testEmail,
    password
  }
}

/**
 * Delete a test user via Supabase Auth admin API
 * This also cascade-deletes the profile and all related data
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const adminClient = getAdminClient()

  const { error } = await adminClient.auth.admin.deleteUser(userId)

  if (error) {
    throw new Error(`Failed to delete test user: ${error.message}`)
  }
}

/**
 * Create an authenticated Supabase client for a test user
 * Signs in with email/password and returns a client with the session
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
 * Test context manager - creates a test user and authenticated client
 * Automatically cleans up the user after the test
 */
export class TestContext {
  public userId: string = ''
  public email: string = ''
  public password: string = ''
  public client: SupabaseClient | null = null

  async setup(
    email?: string,
    password: string = 'testpassword123',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const user = await createTestUser(email, password, metadata)
    this.userId = user.userId
    this.email = user.email
    this.password = user.password
    this.client = await createAuthenticatedClient(this.email, this.password)
  }

  async cleanup(): Promise<void> {
    if (this.userId) {
      try {
        await deleteTestUser(this.userId)
      } catch (error) {
        console.warn(`Failed to cleanup test user ${this.userId}:`, error)
      }
    }
    this.userId = ''
    this.email = ''
    this.password = ''
    this.client = null
  }

  /**
   * Helper to get the authenticated client (throws if not set up)
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('TestContext not set up. Call setup() first.')
    }
    return this.client
  }
}

/**
 * Wait for a condition to be true (with timeout)
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
