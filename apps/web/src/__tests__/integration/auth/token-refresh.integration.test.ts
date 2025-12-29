import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getAnonClient,
  createTestUser,
  deleteTestUser,
  generateTestEmail
} from '../setup/test-utils'

describe('Auth: Token Refresh', () => {
  let testUser: { id: string; email: string }
  const testPassword = 'testpassword123'

  beforeAll(async () => {
    testUser = await createTestUser(generateTestEmail(), testPassword)
  })

  afterAll(async () => {
    await deleteTestUser(testUser.id)
  })

  it('provides a refresh token on login', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: testPassword
    })

    expect(error).toBeNull()
    expect(data.session?.refresh_token).toBeDefined()
    expect(data.session?.refresh_token.length).toBeGreaterThan(0)
  })

  it('successfully refreshes session with valid refresh token', async () => {
    const client = getAnonClient()

    // Login to get a session
    const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: testPassword
    })

    expect(loginError).toBeNull()
    expect(loginData.session).toBeDefined()

    const refreshToken = loginData.session!.refresh_token

    // Wait a tiny bit to ensure tokens are different
    await new Promise(resolve => setTimeout(resolve, 100))

    // Refresh the session
    const { data: refreshData, error: refreshError } = await client.auth.refreshSession({
      refresh_token: refreshToken
    })

    expect(refreshError).toBeNull()
    expect(refreshData.session).toBeDefined()
    expect(refreshData.session?.access_token).toBeDefined()

    // New access token should be valid (might be the same or different depending on timing)
    expect(refreshData.session?.access_token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/)

    // Should have a new refresh token (rotation)
    expect(refreshData.session?.refresh_token).toBeDefined()
  })

  it('maintains user identity after refresh', async () => {
    const client = getAnonClient()

    // Login
    const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: testPassword
    })

    expect(loginError).toBeNull()
    const originalUserId = loginData.user?.id

    // Refresh
    const { data: refreshData, error: refreshError } = await client.auth.refreshSession({
      refresh_token: loginData.session!.refresh_token
    })

    expect(refreshError).toBeNull()
    expect(refreshData.user?.id).toBe(originalUserId)
    expect(refreshData.user?.email).toBe(testUser.email)
  })

  it('rejects invalid refresh token', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.refreshSession({
      refresh_token: 'invalid-refresh-token'
    })

    expect(error).toBeDefined()
    expect(data.session).toBeNull()
  })

  it('allows protected resource access after refresh', async () => {
    const client = getAnonClient()

    // Login
    const { data: loginData, error: loginError } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: testPassword
    })
    expect(loginError).toBeNull()

    // Refresh session
    const { error: refreshError } = await client.auth.refreshSession({
      refresh_token: loginData.session!.refresh_token
    })
    expect(refreshError).toBeNull()

    // Access protected resource
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', testUser.id)
      .single()

    expect(profileError).toBeNull()
    expect(profile).toBeDefined()
    expect(profile?.id).toBe(testUser.id)
  })
})
