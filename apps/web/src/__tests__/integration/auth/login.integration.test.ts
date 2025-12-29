import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getAnonClient,
  createTestUser,
  deleteTestUser,
  generateTestEmail
} from '../setup/test-utils'

describe('Auth: Login', () => {
  let testUser: { id: string; email: string }
  const testPassword = 'testpassword123'

  beforeAll(async () => {
    // Create a test user for login tests
    testUser = await createTestUser(generateTestEmail(), testPassword, {
      name: 'Login Test User'
    })
  })

  afterAll(async () => {
    await deleteTestUser(testUser.id)
  })

  it('logs in with valid credentials', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: testPassword
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(testUser.email)
    expect(data.user?.id).toBe(testUser.id)
    expect(data.session).toBeDefined()
    expect(data.session?.access_token).toBeDefined()
  })

  it('returns session with valid JWT tokens', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: testPassword
    })

    expect(error).toBeNull()
    expect(data.session).toBeDefined()
    expect(data.session?.access_token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/) // JWT format
    expect(data.session?.refresh_token).toBeDefined()
    expect(data.session?.expires_in).toBeGreaterThan(0)
    expect(data.session?.token_type).toBe('bearer')
  })

  it('rejects login with wrong password', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: 'wrongpassword'
    })

    expect(error).toBeDefined()
    expect(error?.message).toMatch(/invalid.*credentials/i)
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('rejects login with non-existent email', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: 'nonexistent@test.local',
      password: testPassword
    })

    expect(error).toBeDefined()
    expect(error?.message).toMatch(/invalid.*credentials/i)
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('allows access to protected resources after login', async () => {
    const client = getAnonClient()

    // Login
    const { error: loginError } = await client.auth.signInWithPassword({
      email: testUser.email,
      password: testPassword
    })
    expect(loginError).toBeNull()

    // Access protected resource (user's own profile)
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('id', testUser.id)
      .single()

    expect(profileError).toBeNull()
    expect(profile).toBeDefined()
    expect(profile?.id).toBe(testUser.id)
  })

  it('denies access to protected resources without login', async () => {
    const client = getAnonClient()

    // Try to access profiles without being logged in
    const { data: profiles, error } = await client
      .from('profiles')
      .select('*')

    // RLS should block access - either error or empty result
    // Depending on RLS policy, it might return empty array instead of error
    expect(profiles?.length || 0).toBe(0)
  })
})
