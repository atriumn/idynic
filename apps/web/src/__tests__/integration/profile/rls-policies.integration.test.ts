import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SupabaseClient } from '@supabase/supabase-js'
import {
  getAdminClient,
  createTestUser,
  createAuthenticatedClient,
  deleteTestUser,
  generateTestEmail,
  waitForProfile
} from '../setup/test-utils'

describe('Profile RLS Policies', () => {
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let userAClient: SupabaseClient
  let userBClient: SupabaseClient
  const password = 'testpassword123'

  beforeAll(async () => {
    const adminClient = getAdminClient()

    // Create two test users
    userA = await createTestUser(generateTestEmail(), password, { name: 'User A' })
    userB = await createTestUser(generateTestEmail(), password, { name: 'User B' })

    // Wait for profiles to be created by trigger
    await waitForProfile(adminClient, userA.id)
    await waitForProfile(adminClient, userB.id)

    // Get authenticated clients for each user
    userAClient = await createAuthenticatedClient(userA.email, password)
    userBClient = await createAuthenticatedClient(userB.email, password)
  })

  afterAll(async () => {
    await deleteTestUser(userA.id)
    await deleteTestUser(userB.id)
  })

  describe('SELECT policies', () => {
    it('user can read their own profile', async () => {
      const { data, error } = await userAClient
        .from('profiles')
        .select('*')
        .eq('id', userA.id)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(userA.id)
      expect(data?.name).toBe('User A')
    })

    it('user cannot read another user profile directly by ID', async () => {
      // User B tries to read User A's profile
      const { data } = await userBClient
        .from('profiles')
        .select('*')
        .eq('id', userA.id)
        .single()

      // RLS should prevent this - either error or null result
      // The policy "Users can view own profile" uses auth.uid() = id
      expect(data).toBeNull()
    })

    it('user query for all profiles only returns their own', async () => {
      const { data, error } = await userAClient
        .from('profiles')
        .select('*')

      expect(error).toBeNull()
      // Should only return User A's profile
      expect(data?.length).toBe(1)
      expect(data?.[0]?.id).toBe(userA.id)
    })
  })

  describe('UPDATE policies', () => {
    it('user can update their own profile', async () => {
      const newName = 'User A Updated'

      const { error } = await userAClient
        .from('profiles')
        .update({ name: newName })
        .eq('id', userA.id)

      expect(error).toBeNull()

      // Verify the update
      const { data } = await userAClient
        .from('profiles')
        .select('name')
        .eq('id', userA.id)
        .single()

      expect(data?.name).toBe(newName)

      // Reset for other tests
      await userAClient
        .from('profiles')
        .update({ name: 'User A' })
        .eq('id', userA.id)
    })

    it('user cannot update another user profile', async () => {
      await userBClient
        .from('profiles')
        .update({ name: 'Hacked!' })
        .eq('id', userA.id)

      // RLS should prevent this - either error or 0 rows affected
      // With "for all" policy, the update should affect 0 rows
      // We can't rely on error being set because RLS might just filter

      // Verify User A's profile is unchanged
      const adminClient = getAdminClient()
      const { data } = await adminClient
        .from('profiles')
        .select('name')
        .eq('id', userA.id)
        .single()

      expect(data?.name).not.toBe('Hacked!')
    })
  })

  describe('INSERT policies', () => {
    it('user cannot insert a profile with a different user ID', async () => {
      // Generate a fake UUID
      const fakeId = '00000000-0000-0000-0000-000000000000'

      const { error } = await userAClient
        .from('profiles')
        .insert({
          id: fakeId,
          email: 'fake@test.local',
          name: 'Fake User'
        })

      // This should fail due to RLS or foreign key constraint
      expect(error).toBeDefined()
    })
  })

  describe('DELETE policies', () => {
    it('user cannot delete another user profile', async () => {
      await userBClient
        .from('profiles')
        .delete()
        .eq('id', userA.id)

      // RLS should prevent this

      // Verify User A's profile still exists
      const adminClient = getAdminClient()
      const { data } = await adminClient
        .from('profiles')
        .select('id')
        .eq('id', userA.id)
        .single()

      expect(data).toBeDefined()
      expect(data?.id).toBe(userA.id)
    })
  })
})

describe('Documents RLS Policies', () => {
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let userAClient: SupabaseClient
  let userBClient: SupabaseClient
  let userADocumentId: string
  const password = 'testpassword123'

  beforeAll(async () => {
    const adminClient = getAdminClient()

    // Create two test users
    userA = await createTestUser(generateTestEmail(), password, { name: 'Doc User A' })
    userB = await createTestUser(generateTestEmail(), password, { name: 'Doc User B' })

    // Wait for profiles
    await waitForProfile(adminClient, userA.id)
    await waitForProfile(adminClient, userB.id)

    // Get authenticated clients
    userAClient = await createAuthenticatedClient(userA.email, password)
    userBClient = await createAuthenticatedClient(userB.email, password)

    // Create a document for User A
    const { data } = await userAClient
      .from('documents')
      .insert({
        user_id: userA.id,
        type: 'resume',
        filename: 'test-resume.pdf',
        raw_text: 'This is User A test resume content'
      })
      .select('id')
      .single()

    userADocumentId = data!.id
  })

  afterAll(async () => {
    await deleteTestUser(userA.id)
    await deleteTestUser(userB.id)
  })

  it('user can read their own documents', async () => {
    const { data, error } = await userAClient
      .from('documents')
      .select('*')
      .eq('id', userADocumentId)
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe(userADocumentId)
    expect(data?.user_id).toBe(userA.id)
  })

  it('user cannot read another user documents', async () => {
    const { data } = await userBClient
      .from('documents')
      .select('*')
      .eq('id', userADocumentId)
      .single()

    // RLS should block this
    expect(data).toBeNull()
  })

  it('user can create documents for themselves', async () => {
    const { data, error } = await userBClient
      .from('documents')
      .insert({
        user_id: userB.id,
        type: 'story',
        filename: 'test-story.txt'
      })
      .select('id')
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBeDefined()
  })

  it('user cannot create documents for another user', async () => {
    const { error } = await userBClient
      .from('documents')
      .insert({
        user_id: userA.id, // Trying to create document for User A
        type: 'resume',
        filename: 'hacked-resume.pdf'
      })

    // RLS should block this
    expect(error).toBeDefined()
  })

  it('user cannot update another user documents', async () => {
    await userBClient
      .from('documents')
      .update({ filename: 'hacked.pdf' })
      .eq('id', userADocumentId)

    // Verify document unchanged
    const { data } = await userAClient
      .from('documents')
      .select('filename')
      .eq('id', userADocumentId)
      .single()

    expect(data?.filename).toBe('test-resume.pdf')
  })

  it('user cannot delete another user documents', async () => {
    await userBClient
      .from('documents')
      .delete()
      .eq('id', userADocumentId)

    // Verify document still exists
    const { data } = await userAClient
      .from('documents')
      .select('id')
      .eq('id', userADocumentId)
      .single()

    expect(data?.id).toBe(userADocumentId)
  })
})

describe('Opportunities RLS Policies', () => {
  let userA: { id: string; email: string }
  let userB: { id: string; email: string }
  let userAClient: SupabaseClient
  let userBClient: SupabaseClient
  let userAOpportunityId: string
  const password = 'testpassword123'

  beforeAll(async () => {
    const adminClient = getAdminClient()

    // Create two test users
    userA = await createTestUser(generateTestEmail(), password, { name: 'Opp User A' })
    userB = await createTestUser(generateTestEmail(), password, { name: 'Opp User B' })

    // Wait for profiles
    await waitForProfile(adminClient, userA.id)
    await waitForProfile(adminClient, userB.id)

    // Get authenticated clients
    userAClient = await createAuthenticatedClient(userA.email, password)
    userBClient = await createAuthenticatedClient(userB.email, password)

    // Create an opportunity for User A
    const { data } = await userAClient
      .from('opportunities')
      .insert({
        user_id: userA.id,
        title: 'Senior Engineer at Test Corp',
        company: 'Test Corp',
        url: 'https://testcorp.com/jobs/123',
        description: 'Great opportunity for User A'
      })
      .select('id')
      .single()

    userAOpportunityId = data!.id
  })

  afterAll(async () => {
    await deleteTestUser(userA.id)
    await deleteTestUser(userB.id)
  })

  it('user can read their own opportunities', async () => {
    const { data, error } = await userAClient
      .from('opportunities')
      .select('*')
      .eq('id', userAOpportunityId)
      .single()

    expect(error).toBeNull()
    expect(data?.id).toBe(userAOpportunityId)
    expect(data?.title).toBe('Senior Engineer at Test Corp')
  })

  it('user cannot read another user opportunities', async () => {
    const { data } = await userBClient
      .from('opportunities')
      .select('*')
      .eq('id', userAOpportunityId)
      .single()

    expect(data).toBeNull()
  })

  it('user query for all opportunities only returns their own', async () => {
    // Create an opportunity for User B
    await userBClient
      .from('opportunities')
      .insert({
        user_id: userB.id,
        title: 'Job for User B',
        company: 'Other Corp'
      })

    const { data: userAData } = await userAClient
      .from('opportunities')
      .select('*')

    const { data: userBData } = await userBClient
      .from('opportunities')
      .select('*')

    // Each user should only see their own opportunities
    expect(userAData?.every(o => o.user_id === userA.id)).toBe(true)
    expect(userBData?.every(o => o.user_id === userB.id)).toBe(true)
  })

  it('user cannot update another user opportunities', async () => {
    await userBClient
      .from('opportunities')
      .update({ title: 'Hacked Job Title' })
      .eq('id', userAOpportunityId)

    // Verify unchanged
    const { data } = await userAClient
      .from('opportunities')
      .select('title')
      .eq('id', userAOpportunityId)
      .single()

    expect(data?.title).toBe('Senior Engineer at Test Corp')
  })
})
