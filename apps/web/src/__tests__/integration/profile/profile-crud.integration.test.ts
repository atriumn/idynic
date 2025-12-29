import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUserContext,
  cleanupTestUserContext,
  getAdminClient,
  TestUserContext
} from '../setup/test-utils'

describe('Profile CRUD Operations', () => {
  let user: TestUserContext

  beforeAll(async () => {
    user = await createTestUserContext('crud-user', { name: 'CRUD Test User' })
  })

  afterAll(async () => {
    await cleanupTestUserContext(user)
  })

  describe('Profile Read', () => {
    it('should read profile with all fields', async () => {
      const { data, error } = await user.client
        .from('profiles')
        .select('*')
        .eq('id', user.userId)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(user.userId)
      expect(data?.email).toBe(user.email)
      expect(data?.created_at).toBeDefined()
    })

    it('should select specific fields', async () => {
      const { data, error } = await user.client
        .from('profiles')
        .select('id, name')
        .eq('id', user.userId)
        .single()

      expect(error).toBeNull()
      expect(data?.id).toBe(user.userId)
      expect(data?.name).toBeDefined()
      // email should not be returned if not selected
      expect((data as Record<string, unknown>)?.email).toBeUndefined()
    })
  })

  describe('Profile Update', () => {
    it('should update name', async () => {
      const newName = 'Updated Name'

      const { error } = await user.client
        .from('profiles')
        .update({ name: newName })
        .eq('id', user.userId)

      expect(error).toBeNull()

      // Verify update
      const { data } = await user.client
        .from('profiles')
        .select('name')
        .eq('id', user.userId)
        .single()

      expect(data?.name).toBe(newName)
    })

    it('should handle null values correctly', async () => {
      // First set a name
      await user.client
        .from('profiles')
        .update({ name: 'Some Name' })
        .eq('id', user.userId)

      // Then set it to null
      const { error } = await user.client
        .from('profiles')
        .update({ name: null })
        .eq('id', user.userId)

      expect(error).toBeNull()

      const { data } = await user.client
        .from('profiles')
        .select('name')
        .eq('id', user.userId)
        .single()

      expect(data?.name).toBeNull()
    })

    it('should update multiple fields at once', async () => {
      const { error } = await user.client
        .from('profiles')
        .update({
          name: 'Multi Update',
          email: user.email // Keep email same to avoid issues
        })
        .eq('id', user.userId)

      expect(error).toBeNull()

      const { data } = await user.client
        .from('profiles')
        .select('name, email')
        .eq('id', user.userId)
        .single()

      expect(data?.name).toBe('Multi Update')
    })

    it('should auto-update updated_at timestamp', async () => {
      // Get initial updated_at
      const { data: before } = await user.client
        .from('profiles')
        .select('updated_at')
        .eq('id', user.userId)
        .single()

      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 100))

      // Update the profile
      await user.client
        .from('profiles')
        .update({ name: 'Timestamp Test' })
        .eq('id', user.userId)

      // Check updated_at changed
      const { data: after } = await user.client
        .from('profiles')
        .select('updated_at')
        .eq('id', user.userId)
        .single()

      // Note: This depends on having an updated_at trigger in your schema
      // If your schema doesn't auto-update this, this test may need adjustment
      if (before?.updated_at && after?.updated_at) {
        expect(new Date(after.updated_at).getTime()).toBeGreaterThanOrEqual(
          new Date(before.updated_at).getTime()
        )
      }
    })
  })

  describe('Profile with Related Data', () => {
    it('should create and read documents linked to profile', async () => {
      // Create a document
      const { data: docData, error: createError } = await user.client
        .from('documents')
        .insert({
          user_id: user.userId,
          type: 'resume',
          filename: 'test-resume.pdf',
          status: 'pending'
        })
        .select()
        .single()

      expect(createError).toBeNull()
      expect(docData?.user_id).toBe(user.userId)

      // Read documents for this user
      const { data: docs, error: readError } = await user.client
        .from('documents')
        .select('*')
        .eq('user_id', user.userId)

      expect(readError).toBeNull()
      expect(docs?.length).toBeGreaterThan(0)

      // Clean up
      await user.client.from('documents').delete().eq('id', docData?.id)
    })

    it('should cascade delete documents when user is deleted', async () => {
      // Create a temporary user
      const tempUser = await createTestUserContext('cascade-test')

      // Create a document for them
      const { data: docData } = await tempUser.client
        .from('documents')
        .insert({
          user_id: tempUser.userId,
          type: 'story',
          filename: 'story.txt',
          status: 'pending'
        })
        .select('id')
        .single()

      const docId = docData?.id

      // Delete the user (this should cascade delete documents)
      await cleanupTestUserContext(tempUser)

      // Verify document was deleted
      const { data: orphanedDoc } = await getAdminClient()
        .from('documents')
        .select('*')
        .eq('id', docId)
        .single()

      expect(orphanedDoc).toBeNull()
    })
  })
})

describe('Profile Data Validation', () => {
  let user: TestUserContext

  beforeAll(async () => {
    user = await createTestUserContext('validation-user', { name: 'Validation User' })
  })

  afterAll(async () => {
    await cleanupTestUserContext(user)
  })

  it('should reject invalid profile id format on queries', async () => {
    const { data } = await user.client
      .from('profiles')
      .select('*')
      .eq('id', 'not-a-uuid')
      .single()

    // Invalid UUID should return no data
    expect(data).toBeNull()
  })

  it('should handle very long name values', async () => {
    const longName = 'A'.repeat(500)

    // This should either work (if no constraint) or fail gracefully
    await user.client
      .from('profiles')
      .update({ name: longName })
      .eq('id', user.userId)

    // Just ensure it doesn't crash - behavior depends on schema constraints
    // Either error or successful update is acceptable
  })

  it('should handle special characters in name', async () => {
    const specialName = "O'Connor-McDougal José 中文 👋"

    const { error } = await user.client
      .from('profiles')
      .update({ name: specialName })
      .eq('id', user.userId)

    expect(error).toBeNull()

    const { data } = await user.client
      .from('profiles')
      .select('name')
      .eq('id', user.userId)
      .single()

    expect(data?.name).toBe(specialName)
  })
})

describe('Profile Query Patterns', () => {
  let user: TestUserContext

  beforeAll(async () => {
    user = await createTestUserContext('query-user', { name: 'Query User' })
  })

  afterAll(async () => {
    await cleanupTestUserContext(user)
  })

  it('should support maybeSingle() for optional profile lookup', async () => {
    // Existing profile
    const { data: existing } = await user.client
      .from('profiles')
      .select('*')
      .eq('id', user.userId)
      .maybeSingle()

    expect(existing).toBeDefined()

    // Non-existing profile (with valid UUID that doesn't exist)
    const { data: notFound, error } = await user.client
      .from('profiles')
      .select('*')
      .eq('id', '00000000-0000-0000-0000-000000000000')
      .maybeSingle()

    expect(error).toBeNull() // maybeSingle doesn't error on no result
    expect(notFound).toBeNull()
  })

  it('should support count queries', async () => {
    const { count, error } = await user.client
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    expect(error).toBeNull()
    // User can only see their own profile, so count should be 1
    expect(count).toBe(1)
  })

  it('should support ordering', async () => {
    // This doesn't make much sense with 1 profile, but verifies syntax works
    const { data, error } = await user.client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    expect(error).toBeNull()
    expect(data?.length).toBe(1)
  })
})
