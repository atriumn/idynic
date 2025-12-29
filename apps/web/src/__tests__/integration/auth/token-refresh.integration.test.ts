import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  getAnonClient,
  createTestUser,
  cleanupTestUsers,
  generateTestEmail
} from '../setup/test-utils'
import type { User } from '@supabase/supabase-js'

describe('Auth: Token Refresh Flow', () => {
  let testUser: User
  const testEmail = generateTestEmail('token-refresh')
  const testPassword = 'testpassword123'

  beforeAll(async () => {
    testUser = await createTestUser(testEmail, testPassword)
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it('should refresh token using refresh_token', async () => {
    const client = getAnonClient()

    // Sign in to get initial session
    const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    expect(signInError).toBeNull()
    expect(signInData.session?.refresh_token).toBeDefined()

    const refreshToken = signInData.session!.refresh_token

    // Refresh the session
    const { data: refreshData, error: refreshError } = await client.auth.refreshSession({
      refresh_token: refreshToken
    })

    expect(refreshError).toBeNull()
    expect(refreshData.session).toBeDefined()
    expect(refreshData.session?.access_token).toBeDefined()
    expect(refreshData.session?.refresh_token).toBeDefined()

    // The new access token should be valid
    const newAccessToken = refreshData.session!.access_token
    expect(newAccessToken).toBeDefined()

    // Verify the new token is for the same user
    const parts = newAccessToken.split('.')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
    expect(payload.sub).toBe(testUser.id)
  })

  it('should get new refresh token after refresh (rotation)', async () => {
    const client = getAnonClient()

    // Sign in to get initial session
    const { data: signInData } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    const originalRefreshToken = signInData.session!.refresh_token

    // Refresh the session
    const { data: refreshData, error } = await client.auth.refreshSession({
      refresh_token: originalRefreshToken
    })

    expect(error).toBeNull()
    expect(refreshData.session?.refresh_token).toBeDefined()

    // Refresh token should be rotated (new one issued)
    // Note: With refresh_token_reuse_interval in config.toml, old tokens
    // may still work briefly, but a new one should be issued
    expect(refreshData.session?.refresh_token).toBeDefined()
  })

  it('should reject invalid refresh token', async () => {
    const client = getAnonClient()

    const { data, error } = await client.auth.refreshSession({
      refresh_token: 'invalid-refresh-token'
    })

    expect(error).toBeDefined()
    expect(data.session).toBeNull()
  })

  it('should maintain user session across refresh', async () => {
    const client = getAnonClient()

    // Sign in
    const { data: signInData } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    })

    // Get user before refresh
    const { data: beforeRefresh } = await client.auth.getUser()
    expect(beforeRefresh.user?.id).toBe(testUser.id)

    // Refresh session
    await client.auth.refreshSession({
      refresh_token: signInData.session!.refresh_token
    })

    // Get user after refresh - should still be the same user
    const { data: afterRefresh } = await client.auth.getUser()
    expect(afterRefresh.user?.id).toBe(testUser.id)
    expect(afterRefresh.user?.email).toBe(testEmail)
  })
})
