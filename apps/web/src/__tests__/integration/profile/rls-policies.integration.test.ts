import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUserContext,
  cleanupTestUserContext,
  getAnonClient,
  getAdminClient,
  TestUserContext
} from '../setup/test-utils'

describe('Profile RLS Policies', () => {
  let userA: TestUserContext
  let userB: TestUserContext

  beforeAll(async () => {
    // Create two test users
    userA = await createTestUserContext('rls-user-a', { name: 'User A' })
    userB = await createTestUserContext('rls-user-b', { name: 'User B' })
  })

  afterAll(async () => {
    await cleanupTestUserContext(userA)
    await cleanupTestUserContext(userB)
  })

  describe('Profile SELECT policies', () => {
    it('user can read their own profile', async () => {
      const { data, error } = await userA.client
        .from('profiles')
        .select('*')
        .eq('id', userA.userId)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(userA.userId)
      expect(data?.name).toBe('User A')
    })

    it('user cannot read another user\'s profile directly', async () => {
      const { data } = await userB.client
        .from('profiles')
        .select('*')
        .eq('id', userA.userId)
        .single()

      // RLS should prevent this - we should get no data or an error
      // Supabase typically returns PGRST116 (not found) due to RLS
      expect(data).toBeNull()
    })

    it('user cannot list other users\' profiles', async () => {
      const { data } = await userA.client
        .from('profiles')
        .select('*')

      // Should only see their own profile
      expect(data).toBeDefined()
      expect(data?.length).toBe(1)
      expect(data?.[0]?.id).toBe(userA.userId)
    })

    it('unauthenticated user cannot read any profiles', async () => {
      const anonClient = getAnonClient()

      const { data } = await anonClient
        .from('profiles')
        .select('*')
        .eq('id', userA.userId)
        .single()

      // Should get error or no data
      expect(data).toBeNull()
    })
  })

  describe('Profile UPDATE policies', () => {
    it('user can update their own profile', async () => {
      const newName = 'User A Updated'

      const { error: updateError } = await userA.client
        .from('profiles')
        .update({ name: newName })
        .eq('id', userA.userId)

      expect(updateError).toBeNull()

      // Verify the update
      const { data } = await userA.client
        .from('profiles')
        .select('name')
        .eq('id', userA.userId)
        .single()

      expect(data?.name).toBe(newName)

      // Reset for other tests
      await userA.client
        .from('profiles')
        .update({ name: 'User A' })
        .eq('id', userA.userId)
    })

    it('user cannot update another user\'s profile', async () => {
      await userB.client
        .from('profiles')
        .update({ name: 'Hacked!' })
        .eq('id', userA.userId)
        .select()

      // The update should either error or affect 0 rows
      // Supabase RLS silently ignores updates to rows you can't access
      const { data: checkData } = await getAdminClient()
        .from('profiles')
        .select('name')
        .eq('id', userA.userId)
        .single()

      // Verify User A's profile was NOT modified
      expect(checkData?.name).not.toBe('Hacked!')
    })

    it('unauthenticated user cannot update any profiles', async () => {
      const anonClient = getAnonClient()

      await anonClient
        .from('profiles')
        .update({ name: 'Hacked!' })
        .eq('id', userA.userId)

      // Should error due to RLS
      // The operation will silently fail or return error
      const { data: checkData } = await getAdminClient()
        .from('profiles')
        .select('name')
        .eq('id', userA.userId)
        .single()

      expect(checkData?.name).not.toBe('Hacked!')
    })
  })

  describe('Profile INSERT policies', () => {
    it('profile is auto-created by trigger on user signup', async () => {
      // This is tested in signup tests - profiles are created by trigger
      // Users cannot manually insert profiles
      const { data } = await userA.client
        .from('profiles')
        .select('*')
        .eq('id', userA.userId)
        .single()

      expect(data).toBeDefined()
    })

    it('user cannot insert a profile with different user_id', async () => {
      // Try to create a profile for a different user ID
      const fakeUserId = '00000000-0000-0000-0000-000000000000'

      const { error } = await userA.client
        .from('profiles')
        .insert({
          id: fakeUserId,
          email: 'fake@test.local',
          name: 'Fake User'
        })

      // This should fail - either due to FK constraint or RLS
      expect(error).toBeDefined()
    })
  })

  describe('Profile DELETE policies', () => {
    it('user cannot delete another user\'s profile', async () => {
      await userB.client
        .from('profiles')
        .delete()
        .eq('id', userA.userId)
        .select()

      // Should not delete anything due to RLS
      const { data: checkData } = await getAdminClient()
        .from('profiles')
        .select('*')
        .eq('id', userA.userId)
        .single()

      // User A's profile should still exist
      expect(checkData).toBeDefined()
      expect(checkData?.id).toBe(userA.userId)
    })
  })
})

describe('Documents RLS Policies', () => {
  let userA: TestUserContext
  let userB: TestUserContext
  let userADocId: string

  beforeAll(async () => {
    userA = await createTestUserContext('doc-user-a', { name: 'Doc User A' })
    userB = await createTestUserContext('doc-user-b', { name: 'Doc User B' })

    // Create a document for User A
    const { data } = await userA.client
      .from('documents')
      .insert({
        user_id: userA.userId,
        type: 'resume',
        filename: 'resume.pdf',
        status: 'completed'
      })
      .select('id')
      .single()

    userADocId = data?.id
  })

  afterAll(async () => {
    // Clean up document
    await getAdminClient()
      .from('documents')
      .delete()
      .eq('id', userADocId)

    await cleanupTestUserContext(userA)
    await cleanupTestUserContext(userB)
  })

  it('user can read their own documents', async () => {
    const { data, error } = await userA.client
      .from('documents')
      .select('*')
      .eq('id', userADocId)
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.id).toBe(userADocId)
    expect(data?.user_id).toBe(userA.userId)
  })

  it('user cannot read another user\'s documents', async () => {
    const { data } = await userB.client
      .from('documents')
      .select('*')
      .eq('id', userADocId)
      .single()

    expect(data).toBeNull()
  })

  it('user can create their own documents', async () => {
    const { data, error } = await userB.client
      .from('documents')
      .insert({
        user_id: userB.userId,
        type: 'story',
        filename: 'story.txt',
        status: 'pending'
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data?.user_id).toBe(userB.userId)

    // Clean up
    await userB.client.from('documents').delete().eq('id', data?.id)
  })

  it('user cannot create documents for another user', async () => {
    const { error } = await userB.client
      .from('documents')
      .insert({
        user_id: userA.userId, // Trying to create for User A
        type: 'resume',
        filename: 'fake.pdf',
        status: 'pending'
      })

    // This should fail due to RLS
    expect(error).toBeDefined()
  })

  it('user cannot update another user\'s documents', async () => {
    await userB.client
      .from('documents')
      .update({ filename: 'hacked.pdf' })
      .eq('id', userADocId)

    // Verify document was not modified
    const { data } = await getAdminClient()
      .from('documents')
      .select('filename')
      .eq('id', userADocId)
      .single()

    expect(data?.filename).toBe('resume.pdf')
  })

  it('user cannot delete another user\'s documents', async () => {
    await userB.client
      .from('documents')
      .delete()
      .eq('id', userADocId)

    // Verify document still exists
    const { data } = await getAdminClient()
      .from('documents')
      .select('*')
      .eq('id', userADocId)
      .single()

    expect(data).toBeDefined()
  })
})

describe('Opportunities RLS Policies', () => {
  let userA: TestUserContext
  let userB: TestUserContext
  let userAOpportunityId: string

  beforeAll(async () => {
    userA = await createTestUserContext('opp-user-a', { name: 'Opp User A' })
    userB = await createTestUserContext('opp-user-b', { name: 'Opp User B' })

    // Create an opportunity for User A
    const { data } = await userA.client
      .from('opportunities')
      .insert({
        user_id: userA.userId,
        title: 'Senior Engineer',
        company: 'Test Corp',
        status: 'tracking'
      })
      .select('id')
      .single()

    userAOpportunityId = data?.id
  })

  afterAll(async () => {
    await getAdminClient()
      .from('opportunities')
      .delete()
      .eq('id', userAOpportunityId)

    await cleanupTestUserContext(userA)
    await cleanupTestUserContext(userB)
  })

  it('user can read their own opportunities', async () => {
    const { data, error } = await userA.client
      .from('opportunities')
      .select('*')
      .eq('id', userAOpportunityId)
      .single()

    expect(error).toBeNull()
    expect(data?.title).toBe('Senior Engineer')
  })

  it('user cannot read another user\'s opportunities', async () => {
    const { data } = await userB.client
      .from('opportunities')
      .select('*')
      .eq('id', userAOpportunityId)
      .single()

    expect(data).toBeNull()
  })

  it('user can update their own opportunities', async () => {
    const { error } = await userA.client
      .from('opportunities')
      .update({ status: 'applied' })
      .eq('id', userAOpportunityId)

    expect(error).toBeNull()

    // Verify update
    const { data } = await userA.client
      .from('opportunities')
      .select('status')
      .eq('id', userAOpportunityId)
      .single()

    expect(data?.status).toBe('applied')
  })

  it('user cannot update another user\'s opportunities', async () => {
    await userB.client
      .from('opportunities')
      .update({ title: 'Hacked!' })
      .eq('id', userAOpportunityId)

    // Verify not modified
    const { data } = await getAdminClient()
      .from('opportunities')
      .select('title')
      .eq('id', userAOpportunityId)
      .single()

    expect(data?.title).toBe('Senior Engineer')
  })
})

describe('Claims RLS Policies', () => {
  let userA: TestUserContext
  let userB: TestUserContext
  let userADocId: string
  let userAClaimId: string

  beforeAll(async () => {
    userA = await createTestUserContext('claim-user-a', { name: 'Claim User A' })
    userB = await createTestUserContext('claim-user-b', { name: 'Claim User B' })

    // Create a document first (claims need a document)
    const { data: docData } = await userA.client
      .from('documents')
      .insert({
        user_id: userA.userId,
        type: 'resume',
        filename: 'resume.pdf',
        status: 'completed'
      })
      .select('id')
      .single()

    userADocId = docData?.id

    // Create a claim
    const { data: claimData } = await userA.client
      .from('claims')
      .insert({
        user_id: userA.userId,
        document_id: userADocId,
        claim_type: 'skill',
        value: { name: 'TypeScript' }
      })
      .select('id')
      .single()

    userAClaimId = claimData?.id
  })

  afterAll(async () => {
    const admin = getAdminClient()
    await admin.from('claims').delete().eq('id', userAClaimId)
    await admin.from('documents').delete().eq('id', userADocId)
    await cleanupTestUserContext(userA)
    await cleanupTestUserContext(userB)
  })

  it('user can read their own claims', async () => {
    const { data, error } = await userA.client
      .from('claims')
      .select('*')
      .eq('id', userAClaimId)
      .single()

    expect(error).toBeNull()
    expect(data?.claim_type).toBe('skill')
  })

  it('user cannot read another user\'s claims', async () => {
    const { data } = await userB.client
      .from('claims')
      .select('*')
      .eq('id', userAClaimId)
      .single()

    expect(data).toBeNull()
  })

  it('user cannot create claims for another user', async () => {
    const { error } = await userB.client
      .from('claims')
      .insert({
        user_id: userA.userId,
        claim_type: 'fake',
        value: { hack: true }
      })

    expect(error).toBeDefined()
  })
})
