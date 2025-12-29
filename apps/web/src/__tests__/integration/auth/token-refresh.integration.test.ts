import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getAnonClient,
  createTestUser,
  deleteTestUser,
  generateTestEmail
} from '../setup/test-utils'

describe('Auth: Token Refresh Flow', () => {
  const testEmail = generateTestEmail('refresh')
  const testPassword = 'testpassword123'
  let testUserId: string

  beforeAll(async () => {
    const result = await createTestUser(testEmail, testPassword, { name: 'Refresh Test User' })
    testUserId = result.userId
  })

  afterAll(async () => {
    await deleteTestUser(testUserId)
  })

  it('should receive a refresh token on login', async () => {
    const client = getAnonClient()

    const { data } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    expect(data.session?.refresh_token).toBeDefined()
    expect(data.session?.refresh_token?.length).toBeGreaterThan(0)
  })

  it('should refresh session with valid refresh token', async () => {
    const client = getAnonClient()

    // Login to get initial session
    const { data: loginData } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    const originalAccessToken = loginData.session?.access_token
    const refreshToken = loginData.session?.refresh_token

    expect(originalAccessToken).toBeDefined()
    expect(refreshToken).toBeDefined()

    // Wait a moment to ensure tokens would be different
    await new Promise(resolve => setTimeout(resolve, 100))

    // Refresh the session
    const { data: refreshData, error } = await client.auth.refreshSession()

    expect(error).toBeNull()
    expect(refreshData.session).toBeDefined()
    expect(refreshData.session?.access_token).toBeDefined()
    expect(refreshData.user).toBeDefined()
    expect(refreshData.user?.id).toBe(testUserId)
  })

  it('should get current session after login', async () => {
    const client = getAnonClient()

    // Login
    await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    // Get session
    const { data, error } = await client.auth.getSession()

    expect(error).toBeNull()
    expect(data.session).toBeDefined()
    expect(data.session?.user?.id).toBe(testUserId)
  })

  it('should get current user after login', async () => {
    const client = getAnonClient()

    // Login
    await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    // Get user
    const { data, error } = await client.auth.getUser()

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.id).toBe(testUserId)
    expect(data.user?.email).toBe(testEmail)
  })

  it('should fail to get user without valid session', async () => {
    const client = getAnonClient()

    // Don't login - try to get user directly
    const { data } = await client.auth.getUser()

    // Should fail or return null user
    expect(data.user).toBeNull()
  })

  it('should maintain user identity after refresh', async () => {
    const client = getAnonClient()

    // Login
    const { data: loginData } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    const originalUserId = loginData.user?.id

    // Refresh
    const { data: refreshData } = await client.auth.refreshSession()

    // User ID should be the same
    expect(refreshData.user?.id).toBe(originalUserId)
    expect(refreshData.user?.email).toBe(testEmail)
  })
})
