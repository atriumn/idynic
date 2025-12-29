import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUser,
  deleteTestUser,
  createAuthenticatedClient,
  getAdminClient,
  getAnonClient
} from '../setup/test-utils'
import type { SupabaseClient } from '@supabase/supabase-js'

describe('Profile RLS Policies Integration', () => {
  let userAId: string
  let userAEmail: string
  let userBId: string
  let userBEmail: string
  let userAClient: SupabaseClient
  let userBClient: SupabaseClient
  const testPassword = 'testPassword123!'

  beforeAll(async () => {
    // Create two test users
    const userA = await createTestUser(undefined, testPassword, { name: 'User A' })
    userAId = userA.userId
    userAEmail = userA.email

    const userB = await createTestUser(undefined, testPassword, { name: 'User B' })
    userBId = userB.userId
    userBEmail = userB.email

    // Get authenticated clients for both users
    userAClient = await createAuthenticatedClient(userAEmail, testPassword)
    userBClient = await createAuthenticatedClient(userBEmail, testPassword)
  })

  afterAll(async () => {
    if (userAId) await deleteTestUser(userAId)
    if (userBId) await deleteTestUser(userBId)
  })

  describe('Profile SELECT policies', () => {
    it('user can SELECT their own profile', async () => {
      const { data, error } = await userAClient
        .from('profiles')
        .select('*')
        .eq('id', userAId)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(userAId)
      expect(data?.email).toBe(userAEmail)
    })

    it('user cannot SELECT another user\'s profile', async () => {
      // User B tries to read User A's profile
      const { data, error } = await userBClient
        .from('profiles')
        .select('*')
        .eq('id', userAId)
        .single()

      // RLS should prevent access - either error or no data
      // Supabase typically returns empty result rather than error for RLS violations
      if (error) {
        // This is acceptable - RLS blocked the query
        expect(error).toBeDefined()
      } else {
        // No error but data should be null/undefined
        expect(data).toBeNull()
      }
    })

    it('user cannot list all profiles', async () => {
      // User A tries to select all profiles (should only get their own)
      const { data, error } = await userAClient
        .from('profiles')
        .select('*')

      expect(error).toBeNull()
      // Should only return user A's profile, not user B's
      expect(data).toBeDefined()
      expect(data?.length).toBe(1)
      expect(data?.[0]?.id).toBe(userAId)
    })
  })

  describe('Profile UPDATE policies', () => {
    it('user can UPDATE their own profile', async () => {
      const newName = 'User A Updated'

      const { data, error } = await userAClient
        .from('profiles')
        .update({ name: newName })
        .eq('id', userAId)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.name).toBe(newName)

      // Verify the update persisted
      const { data: verifyData } = await userAClient
        .from('profiles')
        .select('*')
        .eq('id', userAId)
        .single()

      expect(verifyData?.name).toBe(newName)
    })

    it('user cannot UPDATE another user\'s profile', async () => {
      const hackedName = 'Hacked by User B!'

      // User B tries to update User A's profile
      const { data, error } = await userBClient
        .from('profiles')
        .update({ name: hackedName })
        .eq('id', userAId)
        .select()

      // RLS should prevent the update
      // Either error or the update affects 0 rows
      if (error) {
        expect(error).toBeDefined()
      } else {
        // No error, but update should affect 0 rows
        expect(data).toBeDefined()
        expect(data?.length).toBe(0)
      }

      // Verify User A's profile was NOT changed
      const { data: verifyData } = await getAdminClient()
        .from('profiles')
        .select('name')
        .eq('id', userAId)
        .single()

      expect(verifyData?.name).not.toBe(hackedName)
    })
  })

  describe('Profile INSERT policies', () => {
    it('user cannot INSERT a profile with another user\'s ID', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000'

      // Try to insert a profile with a fake user ID
      const { error } = await userAClient
        .from('profiles')
        .insert({
          id: fakeUserId,
          email: 'fake@test.local',
          name: 'Fake User'
        })
        .select()

      // This should fail - either FK constraint or RLS
      expect(error).not.toBeNull()
    })
  })

  describe('Profile DELETE policies', () => {
    it('user cannot DELETE another user\'s profile', async () => {
      // User B tries to delete User A's profile
      await userBClient
        .from('profiles')
        .delete()
        .eq('id', userAId)

      // RLS should prevent deletion or return success but delete 0 rows
      // Either way, User A's profile should still exist

      // Verify User A's profile still exists
      const { data: verifyData, error: verifyError } = await getAdminClient()
        .from('profiles')
        .select('*')
        .eq('id', userAId)
        .single()

      expect(verifyError).toBeNull()
      expect(verifyData).toBeDefined()
      expect(verifyData?.id).toBe(userAId)
    })
  })

  describe('Anonymous access', () => {
    it('anonymous user cannot SELECT any profiles', async () => {
      const anonClient = getAnonClient()

      const { data } = await anonClient
        .from('profiles')
        .select('*')

      // Without authentication, RLS should block all access
      expect(data).toBeDefined()
      expect(data?.length).toBe(0)
    })

    it('anonymous user cannot UPDATE any profiles', async () => {
      const anonClient = getAnonClient()

      const { data } = await anonClient
        .from('profiles')
        .update({ name: 'Hacked!' })
        .eq('id', userAId)
        .select()

      // Should fail or affect 0 rows
      expect(data?.length ?? 0).toBe(0)

      // Verify profile wasn't changed
      const { data: verifyData } = await getAdminClient()
        .from('profiles')
        .select('name')
        .eq('id', userAId)
        .single()

      expect(verifyData?.name).not.toBe('Hacked!')
    })
  })
})
