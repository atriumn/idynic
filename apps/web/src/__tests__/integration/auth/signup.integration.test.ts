import { describe, it, expect, afterEach } from 'vitest'
import {
  getAdminClient,
  generateTestEmail,
  deleteTestUser
} from '../setup/test-utils'

describe('Auth - Signup Integration', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    // Cleanup all created users
    for (const userId of createdUserIds) {
      try {
        await deleteTestUser(userId)
      } catch {
        // Ignore cleanup errors
      }
    }
    createdUserIds.length = 0
  })

  it('creates a new user with valid credentials', async () => {
    const email = generateTestEmail()
    const password = 'validPassword123!'

    const adminClient = getAdminClient()
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(email)
    expect(data.user?.id).toBeDefined()

    if (data.user?.id) {
      createdUserIds.push(data.user.id)
    }
  })

  it('auto-creates a profile when user signs up', async () => {
    const email = generateTestEmail()
    const password = 'validPassword123!'

    const adminClient = getAdminClient()

    // Create user
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: 'Test User'
      }
    })

    expect(createError).toBeNull()
    expect(userData.user).toBeDefined()

    if (userData.user?.id) {
      createdUserIds.push(userData.user.id)

      // Check that profile was auto-created (via trigger)
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('*')
        .eq('id', userData.user.id)
        .single()

      expect(profileError).toBeNull()
      expect(profile).toBeDefined()
      expect(profile?.email).toBe(email)
      expect(profile?.name).toBe('Test User')
    }
  })

  it('fails to create user with invalid email format', async () => {
    const adminClient = getAdminClient()

    const { error } = await adminClient.auth.admin.createUser({
      email: 'invalid-email',
      password: 'validPassword123!'
    })

    // Supabase should reject invalid email
    expect(error).not.toBeNull()
  })

  it('fails to create user with too short password', async () => {
    const email = generateTestEmail()
    const adminClient = getAdminClient()

    const { error } = await adminClient.auth.admin.createUser({
      email,
      password: '12345' // Too short (min 6 characters per config)
    })

    // Supabase should reject short password
    expect(error).not.toBeNull()
  })

  it('fails to create duplicate user', async () => {
    const email = generateTestEmail()
    const password = 'validPassword123!'

    const adminClient = getAdminClient()

    // Create first user
    const { data: firstUser, error: firstError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    expect(firstError).toBeNull()
    if (firstUser.user?.id) {
      createdUserIds.push(firstUser.user.id)
    }

    // Try to create duplicate
    const { error: secondError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    // Should fail with duplicate error
    expect(secondError).not.toBeNull()
    expect(secondError?.message).toMatch(/already|exists|registered|duplicate/i)
  })
})
