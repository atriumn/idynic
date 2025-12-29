import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  deleteTestUser,
  getAnonClient,
  createAuthenticatedClient,
  generateTestEmail
} from '../setup/test-utils'

describe('Auth - Login Integration', () => {
  let testUserId: string
  let testEmail: string
  const testPassword = 'testPassword123!'

  beforeAll(async () => {
    // Create a test user for login tests
    const user = await createTestUser(undefined, testPassword)
    testUserId = user.userId
    testEmail = user.email
  })

  afterAll(async () => {
    if (testUserId) {
      await deleteTestUser(testUserId)
    }
  })

  it('logs in successfully with valid credentials', async () => {
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
    expect(data.session?.refresh_token).toBeDefined()
  })

  it('returns a valid JWT session token', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    expect(error).toBeNull()
    expect(data.session).toBeDefined()

    // Verify token structure (JWT has 3 parts separated by dots)
    const accessToken = data.session?.access_token
    expect(accessToken).toBeDefined()
    const tokenParts = accessToken?.split('.')
    expect(tokenParts?.length).toBe(3)

    // Decode and verify payload contains user info
    if (tokenParts) {
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
      expect(payload.sub).toBe(testUserId)
      expect(payload.email).toBe(testEmail)
      expect(payload.role).toBe('authenticated')
    }
  })

  it('fails to login with invalid password', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail,
      password: 'wrongPassword123!'
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/invalid|credentials/i)
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('fails to login with non-existent user', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: 'nonexistent@test.local',
      password: testPassword
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/invalid|credentials/i)
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('can access protected resources after login', async () => {
    const client = await createAuthenticatedClient(testEmail, testPassword)

    // Try to access own profile (protected by RLS)
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', testUserId)
      .single()

    expect(error).toBeNull()
    expect(profile).toBeDefined()
    expect(profile?.id).toBe(testUserId)
    expect(profile?.email).toBe(testEmail)
  })

  it('can get current user after login', async () => {
    const client = await createAuthenticatedClient(testEmail, testPassword)

    const { data, error } = await client.auth.getUser()

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.id).toBe(testUserId)
    expect(data.user?.email).toBe(testEmail)
  })
})
