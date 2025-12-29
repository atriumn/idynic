import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Default local Supabase credentials (from supabase start)
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// Cached admin client
let adminClient: SupabaseClient | null = null

/**
 * Get an admin client with service role privileges.
 * This client bypasses RLS and can access any data.
 */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  }
  return adminClient
}

/**
 * Get an anonymous client (no authentication).
 * Used to test unauthenticated access scenarios.
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
 * Create a test user via the admin API.
 * The profile is auto-created by the database trigger.
 */
export async function createTestUser(
  email: string,
  password: string,
  metadata?: { name?: string }
): Promise<{ userId: string; email: string }> {
  const admin = getAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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
    email: data.user.email!
  }
}

/**
 * Delete a test user and all associated data.
 * Uses the admin API to bypass RLS.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = getAdminClient()

  const { error } = await admin.auth.admin.deleteUser(userId)

  if (error) {
    console.warn(`Warning: Failed to delete test user ${userId}: ${error.message}`)
  }
}

/**
 * Create an authenticated Supabase client for a test user.
 * This client will have the user's session and be subject to RLS.
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
    throw new Error(`Failed to sign in test user: ${error.message}`)
  }

  return client
}

/**
 * Generate a unique test email to avoid conflicts between tests.
 */
export function generateTestEmail(prefix = 'test'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}@test.local`
}

/**
 * Test user context - holds user info and their authenticated client.
 * Makes it easy to manage test users in beforeAll/afterAll hooks.
 */
export interface TestUserContext {
  userId: string
  email: string
  password: string
  client: SupabaseClient
}

/**
 * Create a full test user context with authenticated client.
 * Convenience function for setting up test users in tests.
 */
export async function createTestUserContext(
  emailPrefix = 'user',
  metadata?: { name?: string }
): Promise<TestUserContext> {
  const email = generateTestEmail(emailPrefix)
  const password = 'testpassword123'

  const { userId } = await createTestUser(email, password, metadata)
  const client = await createAuthenticatedClient(email, password)

  return {
    userId,
    email,
    password,
    client
  }
}

/**
 * Clean up a test user context.
 */
export async function cleanupTestUserContext(context: TestUserContext): Promise<void> {
  await deleteTestUser(context.userId)
}

/**
 * Wait for a profile to be created (it's created by a trigger on user signup).
 * Sometimes there's a small delay.
 */
export async function waitForProfile(
  userId: string,
  maxAttempts = 10,
  delayMs = 100
): Promise<boolean> {
  const admin = getAdminClient()

  for (let i = 0; i < maxAttempts; i++) {
    const { data } = await admin.from('profiles').select('id').eq('id', userId).single()
    if (data) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
  }

  return false
}
