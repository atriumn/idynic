import { describe, it, expect, afterAll } from 'vitest'
import {
  getAdminClient,
  getAnonClient,
  generateTestEmail,
  deleteTestUser,
  waitForProfile
} from '../setup/test-utils'

describe('Auth: Signup', () => {
  const testUserIds: string[] = []

  afterAll(async () => {
    // Cleanup all test users
    for (const userId of testUserIds) {
      await deleteTestUser(userId)
    }
  })

  it('creates a new user with email and password', async () => {
    const email = generateTestEmail()
    const password = 'testpassword123'
    const client = getAnonClient()

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: 'Test User'
        }
      }
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(email)
    expect(data.user?.user_metadata?.name).toBe('Test User')

    if (data.user) {
      testUserIds.push(data.user.id)
    }
  })

  it('auto-creates a profile via database trigger', async () => {
    const email = generateTestEmail()
    const password = 'testpassword123'
    const adminClient = getAdminClient()

    // Create user via admin API (similar to what happens during signup)
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: 'Triggered Profile User'
      }
    })

    expect(createError).toBeNull()
    expect(userData.user).toBeDefined()

    if (userData.user) {
      testUserIds.push(userData.user.id)

      // Wait for profile trigger to execute
      const profileExists = await waitForProfile(adminClient, userData.user.id)
      expect(profileExists).toBe(true)

      // Verify profile data
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single()

      expect(profileError).toBeNull()
      expect(profile).toBeDefined()
      expect(profile?.email).toBe(email)
      expect(profile?.name).toBe('Triggered Profile User')
    }
  })

  it('rejects signup with weak password', async () => {
    const email = generateTestEmail()
    const password = '123' // Too short
    const client = getAnonClient()

    const { data, error } = await client.auth.signUp({
      email,
      password
    })

    // Should fail with password validation error
    expect(error).toBeDefined()
    expect(error?.message).toMatch(/password/i)
    expect(data.user).toBeNull()
  })

  it('rejects signup with invalid email', async () => {
    const email = 'not-an-email'
    const password = 'testpassword123'
    const client = getAnonClient()

    const { data, error } = await client.auth.signUp({
      email,
      password
    })

    // Should fail with email validation error
    expect(error).toBeDefined()
    expect(data.user).toBeNull()
  })

  it('rejects duplicate email signup', async () => {
    const email = generateTestEmail()
    const password = 'testpassword123'
    const adminClient = getAdminClient()
    const anonClient = getAnonClient()

    // First, create a user
    const { data: firstUser, error: firstError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    expect(firstError).toBeNull()
    if (firstUser.user) {
      testUserIds.push(firstUser.user.id)
    }

    // Try to signup with the same email
    const { data: secondData, error: secondError } = await anonClient.auth.signUp({
      email,
      password
    })

    // Supabase doesn't expose duplicate user errors for security reasons
    // It returns a "fake" user but doesn't actually create one
    // The user won't have an identities array if it's a fake response
    expect(secondData.user?.identities?.length || 0).toBe(0)
  })
})
