import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getAnonClient,
  createTestUser,
  cleanupTestUsers,
  generateTestEmail
} from '../setup/test-utils'
import type { User } from '@supabase/supabase-js'

describe('Auth: Login Flow', () => {
  let testUser: User
  const testEmail = generateTestEmail('login')
  const testPassword = 'testpassword123'

  beforeAll(async () => {
    // Create a test user for login tests
    testUser = await createTestUser(testEmail, testPassword)
  })

  afterAll(async () => {
    await cleanupTestUsers()
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
    expect(data.user?.id).toBe(testUser.id)
    expect(data.session).toBeDefined()
    expect(data.session?.access_token).toBeDefined()
    expect(data.session?.refresh_token).toBeDefined()
  })

  it('should return a valid JWT access token', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    expect(error).toBeNull()
    expect(data.session?.access_token).toBeDefined()

    // Verify the token is a valid JWT structure
    const token = data.session!.access_token
    const parts = token.split('.')
    expect(parts.length).toBe(3) // header.payload.signature

    // Decode the payload
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    expect(payload.sub).toBe(testUser.id) // subject is user ID
    expect(payload.role).toBe('authenticated')
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000) // not expired
  })

  it('should reject login with wrong password', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: testEmail,
      password: 'wrongpassword'
    })

    expect(error).toBeDefined()
    expect(error?.message).toContain('Invalid login credentials')
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('should reject login with non-existent email', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.signInWithPassword({
      email: 'nonexistent@test.local',
      password: testPassword
    })

    expect(error).toBeDefined()
    expect(error?.message).toContain('Invalid login credentials')
    expect(data.user).toBeNull()
    expect(data.session).toBeNull()
  })

  it('should get the current user after login', async () => {
    const client = getAnonClient()

    // Sign in
    await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    // Get current user
    const { data, error } = await client.auth.getUser()

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    expect(data.user?.email).toBe(testEmail)
    expect(data.user?.id).toBe(testUser.id)
  })

  it('should logout successfully', async () => {
    const client = getAnonClient()

    // Sign in first
    await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    // Verify we're logged in
    const { data: beforeLogout } = await client.auth.getSession()
    expect(beforeLogout.session).toBeDefined()

    // Logout
    const { error } = await client.auth.signOut()
    expect(error).toBeNull()

    // Verify session is cleared
    const { data: afterLogout } = await client.auth.getSession()
    expect(afterLogout.session).toBeNull()
  })
})
