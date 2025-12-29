import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getAnonClient,
  createTestUser,
  deleteTestUser,
  generateTestEmail
} from '../setup/test-utils'

describe('Auth: Login Flow', () => {
  const testEmail = generateTestEmail('login')
  const testPassword = 'testpassword123'
  let testUserId: string

  beforeAll(async () => {
    // Create a test user for login tests
    const result = await createTestUser(testEmail, testPassword, { name: 'Login Test User' })
    testUserId = result.userId
  })

  afterAll(async () => {
    await deleteTestUser(testUserId)
  })

  it('should login with valid credentials', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(testEmail)
    expect(data.session).toBeDefined()
    expect(data.session?.access_token).toBeDefined()
  })

  it('should return a valid session with JWT', async () => {
    const client = getAnonClient()

    const { data } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    expect(data.session).toBeDefined()
    expect(data.session?.access_token).toBeDefined()
    expect(data.session?.refresh_token).toBeDefined()
    expect(data.session?.expires_in).toBeGreaterThan(0)

    // Verify the access token format (should be a JWT)
    const token = data.session?.access_token
    expect(token?.split('.').length).toBe(3) // JWT has 3 parts
  })

  it('should fail with incorrect password', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail,
      password: 'wrongpassword'
    })

    expect(error).toBeDefined()
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('should fail with non-existent user', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: 'nonexistent@test.local',
      password: 'anypassword'
    })

    expect(error).toBeDefined()
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('should allow access to protected data after login', async () => {
    const client = getAnonClient()

    // Login first
    const { data: authData } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    expect(authData.user).toBeDefined()

    // Now try to access the user's own profile
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single()

    expect(profileError).toBeNull()
    expect(profile).toBeDefined()
    expect(profile?.id).toBe(testUserId)
  })

  it('should be able to sign out', async () => {
    const client = getAnonClient()

    // Login
    await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    // Sign out
    const { error } = await client.auth.signOut()

    expect(error).toBeNull()

    // Session should be cleared
    const { data } = await client.auth.getSession()
    expect(data.session).toBeNull()
  })
})
