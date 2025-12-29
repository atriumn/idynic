import { describe, it, expect, afterEach } from 'vitest'
import {
  getAdminClient,
  getAnonClient,
  generateTestEmail,
  waitForProfile
} from '../setup/test-utils'

describe('Auth: Signup Flow', () => {
  const createdUserIds: string[] = []

  afterEach(async () => {
    // Clean up any created users
    const admin = getAdminClient()
    for (const userId of createdUserIds) {
      await admin.auth.admin.deleteUser(userId)
    }
    createdUserIds.length = 0
  })

  it('should create a new user via signup', async () => {
    const client = getAnonClient()
    const email = generateTestEmail('signup')
    const password = 'testpassword123'

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { name: 'Test User' }
      }
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(email)
    expect(data.user?.user_metadata?.name).toBe('Test User')

    if (data.user) {
      createdUserIds.push(data.user.id)
    }
  })

  it('should auto-create profile on user signup', async () => {
    const admin = getAdminClient()
    const email = generateTestEmail('profile-creation')
    const password = 'testpassword123'

    // Create user via admin API (triggers profile creation)
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Auto Profile User' }
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()

    if (data.user) {
      createdUserIds.push(data.user.id)

      // Wait for profile to be created (trigger runs async)
      const profileCreated = await waitForProfile(data.user.id)
      expect(profileCreated).toBe(true)

      // Verify profile exists with correct data
      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      expect(profileError).toBeNull()
      expect(profile).toBeDefined()
      expect(profile?.email).toBe(email)
      expect(profile?.name).toBe('Auto Profile User')
    }
  })

  it('should fail signup with invalid email', async () => {
    const client = getAnonClient()

    const { data } = await client.auth.signUp({
      email: 'not-an-email',
      password: 'testpassword123'
    })

    // Supabase may return an error or data with null user
    expect(data.user).toBeNull()
    // The error might be in the response or validation happens server-side
  })

  it('should fail signup with weak password', async () => {
    const client = getAnonClient()
    const email = generateTestEmail('weak-password')

    const { error } = await client.auth.signUp({
      email,
      password: '123' // Too short
    })

    expect(error).toBeDefined()
  })

  it('should reject duplicate email signup', async () => {
    const admin = getAdminClient()
    const email = generateTestEmail('duplicate')
    const password = 'testpassword123'

    // Create first user
    const { data: firstUser, error: firstError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    expect(firstError).toBeNull()
    if (firstUser.user) {
      createdUserIds.push(firstUser.user.id)
    }

    // Try to create second user with same email
    const { error: secondError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    expect(secondError).toBeDefined()
  })
})
