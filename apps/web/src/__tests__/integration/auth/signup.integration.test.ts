import { describe, it, expect, afterEach } from 'vitest'
import {
  getAdminClient,
  getAnonClient,
  generateTestEmail,
  cleanupTestUsers
} from '../setup/test-utils'

describe('Auth: Signup Flow', () => {
  afterEach(async () => {
    await cleanupTestUsers()
  })

  it('should create a new user with email and password', async () => {
    const email = generateTestEmail('signup')
    const password = 'testpassword123'

    const client = getAnonClient()

    const { data, error } = await client.auth.signUp({
      email,
      password
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(email)
    expect(data.user?.id).toBeDefined()

    // Clean up
    if (data.user?.id) {
      const admin = getAdminClient()
      await admin.auth.admin.deleteUser(data.user.id)
    }
  })

  it('should auto-create a profile when user signs up', async () => {
    const email = generateTestEmail('signup-profile')
    const password = 'testpassword123'

    // Create user via admin API (auto-confirms email)
    const admin = getAdminClient()
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    expect(userError).toBeNull()
    expect(userData.user).toBeDefined()

    // Check that a profile was created by the trigger
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', userData.user!.id)
      .single()

    expect(profileError).toBeNull()
    expect(profile).toBeDefined()
    expect(profile?.id).toBe(userData.user!.id)
    expect(profile?.email).toBe(email)

    // Clean up
    await admin.auth.admin.deleteUser(userData.user!.id)
  })

  it('should reject signup with weak password', async () => {
    const email = generateTestEmail('weak-password')
    const weakPassword = '123' // Too short

    const client = getAnonClient()

    const { data, error } = await client.auth.signUp({
      email,
      password: weakPassword
    })

    // Supabase should reject weak passwords
    expect(error).toBeDefined()
    // User should not be created
    expect(data.user?.id).toBeUndefined()
  })

  it('should reject signup with invalid email', async () => {
    const invalidEmail = 'not-an-email'
    const password = 'testpassword123'

    const client = getAnonClient()

    const { data, error } = await client.auth.signUp({
      email: invalidEmail,
      password
    })

    // Supabase should reject invalid emails
    expect(error).toBeDefined()
    expect(data.user?.id).toBeUndefined()
  })

  it('should reject duplicate email signup', async () => {
    const email = generateTestEmail('duplicate')
    const password = 'testpassword123'

    // Create first user via admin
    const admin = getAdminClient()
    const { data: firstUser, error: firstError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    })

    expect(firstError).toBeNull()
    expect(firstUser.user).toBeDefined()

    // Try to sign up with same email
    const client = getAnonClient()
    const { data } = await client.auth.signUp({
      email,
      password
    })

    // Supabase returns a fake user for security (prevents email enumeration)
    // but the user won't have a session
    expect(data.session).toBeNull()

    // Clean up
    await admin.auth.admin.deleteUser(firstUser.user!.id)
  })
})
