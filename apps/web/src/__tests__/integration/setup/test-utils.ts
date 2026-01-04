import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Local Supabase default credentials
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * Test user tracking for cleanup
 */
const createdUserIds: string[] = [];

/**
 * Get the admin/service role client.
 * This bypasses RLS and should only be used for test setup/cleanup.
 */
export function getAdminClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Get an anonymous client (no auth).
 * Useful for testing unauthenticated access.
 */
export function getAnonClient(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Create a test user via the admin API.
 * The user's email is automatically confirmed.
 *
 * @param email - Email for the test user
 * @param password - Password for the test user
 * @returns The created user
 */
export async function createTestUser(
  email: string,
  password: string = "testpassword123",
): Promise<User> {
  const admin = getAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email for testing
  });

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`);
  }

  if (!data.user) {
    throw new Error("No user returned from createUser");
  }

  // Track for cleanup
  createdUserIds.push(data.user.id);

  return data.user;
}

/**
 * Delete a test user and all their data.
 *
 * @param userId - The user ID to delete
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const admin = getAdminClient();

  // Delete the user (this should cascade to related data due to foreign keys)
  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    console.warn(`Failed to delete test user ${userId}: ${error.message}`);
  }

  // Remove from tracking
  const index = createdUserIds.indexOf(userId);
  if (index > -1) {
    createdUserIds.splice(index, 1);
  }
}

/**
 * Create a Supabase client authenticated as a specific user.
 * This signs in the user and returns a client with their session.
 *
 * @param email - User's email
 * @param password - User's password
 * @returns Authenticated Supabase client
 */
export async function createAuthenticatedClient(
  email: string,
  password: string = "testpassword123",
): Promise<SupabaseClient<Database>> {
  // Create a fresh client for this user
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Sign in the user
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(`Failed to sign in test user: ${error.message}`);
  }

  return client;
}

/**
 * Create a test user and return an authenticated client for them.
 * Convenience function that combines createTestUser + createAuthenticatedClient.
 *
 * @param email - Email for the test user
 * @param password - Password for the test user
 * @returns Object containing the user and authenticated client
 */
export async function createTestUserWithClient(
  email: string,
  password: string = "testpassword123",
): Promise<{ user: User; client: SupabaseClient<Database> }> {
  const user = await createTestUser(email, password);
  const client = await createAuthenticatedClient(email, password);

  return { user, client };
}

/**
 * Clean up all test users created during the current test run.
 * Call this in afterAll() or afterEach() as needed.
 */
export async function cleanupTestUsers(): Promise<void> {
  const admin = getAdminClient();

  for (const userId of [...createdUserIds]) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch (error) {
      console.warn(`Failed to cleanup user ${userId}:`, error);
    }
  }

  // Clear the tracking array
  createdUserIds.length = 0;
}

/**
 * Generate a unique test email to avoid collisions between tests.
 *
 * @param prefix - Optional prefix for the email
 * @returns Unique email address
 */
export function generateTestEmail(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@test.local`;
}

/**
 * Wait for a condition to be true, with timeout.
 * Useful for waiting on async operations.
 *
 * @param condition - Function that returns true when ready
 * @param timeout - Maximum time to wait in ms
 * @param interval - Check interval in ms
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Assert that an operation throws an error (for RLS tests).
 *
 * @param operation - Async operation to run
 * @param expectedErrorMessage - Optional substring to match in error
 */
export async function expectRlsError(
  operation: () => Promise<unknown>,
  expectedErrorMessage?: string,
): Promise<void> {
  try {
    await operation();
    throw new Error(
      "Expected operation to throw an RLS error, but it succeeded",
    );
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (
        error.message ===
        "Expected operation to throw an RLS error, but it succeeded"
      ) {
        throw error;
      }
      if (
        expectedErrorMessage &&
        !error.message.includes(expectedErrorMessage)
      ) {
        throw new Error(
          `Expected error message to contain "${expectedErrorMessage}", got: ${error.message}`,
        );
      }
    }
    // Error was thrown as expected
  }
}
