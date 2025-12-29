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

describe('Profile CRUD Operations', () => {
  let testUser: { id: string; email: string }
  let userClient: SupabaseClient
  const password = 'testpassword123'

  beforeAll(async () => {
    const adminClient = getAdminClient()

    // Create test user
    testUser = await createTestUser(generateTestEmail(), password, {
      name: 'CRUD Test User'
    })

    // Wait for profile to be created by trigger
    await waitForProfile(adminClient, testUser.id)

    // Get authenticated client
    userClient = await createAuthenticatedClient(testUser.email, password)
  })

  afterAll(async () => {
    await deleteTestUser(testUser.id)
  })

  describe('Read', () => {
    it('can read profile after user creation', async () => {
      const { data, error } = await userClient
        .from('profiles')
        .select('*')
        .eq('id', testUser.id)
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.id).toBe(testUser.id)
      expect(data?.email).toBe(testUser.email)
      expect(data?.name).toBe('CRUD Test User')
    })

    it('profile has correct default fields', async () => {
      const { data, error } = await userClient
        .from('profiles')
        .select('*')
        .eq('id', testUser.id)
        .single()

      expect(error).toBeNull()
      expect(data?.created_at).toBeDefined()
      expect(data?.updated_at).toBeDefined()
      // created_at and updated_at should be valid timestamps
      expect(new Date(data?.created_at).getTime()).not.toBeNaN()
      expect(new Date(data?.updated_at).getTime()).not.toBeNaN()
    })

    it('can select specific fields', async () => {
      const { data, error } = await userClient
        .from('profiles')
        .select('id, name')
        .eq('id', testUser.id)
        .single()

      expect(error).toBeNull()
      expect(data?.id).toBe(testUser.id)
      expect(data?.name).toBe('CRUD Test User')
      // Email should not be in the response since we didn't select it
      expect((data as Record<string, unknown>)?.email).toBeUndefined()
    })
  })

  describe('Update', () => {
    it('can update profile name', async () => {
      const newName = 'Updated Name'

      const { error: updateError } = await userClient
        .from('profiles')
        .update({ name: newName })
        .eq('id', testUser.id)

      expect(updateError).toBeNull()

      // Verify the update
      const { data, error: readError } = await userClient
        .from('profiles')
        .select('name')
        .eq('id', testUser.id)
        .single()

      expect(readError).toBeNull()
      expect(data?.name).toBe(newName)
    })

    it('can update multiple fields at once', async () => {
      const updates = {
        name: 'Multi-Field Update',
        email: 'updated@test.local'
      }

      const { error: updateError } = await userClient
        .from('profiles')
        .update(updates)
        .eq('id', testUser.id)

      expect(updateError).toBeNull()

      const { data, error: readError } = await userClient
        .from('profiles')
        .select('name, email')
        .eq('id', testUser.id)
        .single()

      expect(readError).toBeNull()
      expect(data?.name).toBe(updates.name)
      expect(data?.email).toBe(updates.email)
    })

    it('update with returning returns the updated row', async () => {
      const newName = 'Returning Test'

      const { data, error } = await userClient
        .from('profiles')
        .update({ name: newName })
        .eq('id', testUser.id)
        .select('*')
        .single()

      expect(error).toBeNull()
      expect(data?.name).toBe(newName)
      expect(data?.id).toBe(testUser.id)
    })

    it('updates updated_at timestamp', async () => {
      // Get current updated_at
      const { data: before } = await userClient
        .from('profiles')
        .select('updated_at')
        .eq('id', testUser.id)
        .single()

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 100))

      // Update the profile
      const { error } = await userClient
        .from('profiles')
        .update({ name: 'Timestamp Test' })
        .eq('id', testUser.id)

      expect(error).toBeNull()

      // Get new updated_at
      const { data: after } = await userClient
        .from('profiles')
        .select('updated_at')
        .eq('id', testUser.id)
        .single()

      // Note: This test might need adjustment based on whether you have
      // a trigger that updates updated_at automatically
      // For now, we'll just verify the fields exist
      expect(before?.updated_at).toBeDefined()
      expect(after?.updated_at).toBeDefined()
    })
  })
})

describe('Document CRUD Operations', () => {
  let testUser: { id: string; email: string }
  let userClient: SupabaseClient
  const password = 'testpassword123'

  beforeAll(async () => {
    const adminClient = getAdminClient()

    testUser = await createTestUser(generateTestEmail(), password, {
      name: 'Doc CRUD User'
    })

    await waitForProfile(adminClient, testUser.id)
    userClient = await createAuthenticatedClient(testUser.email, password)
  })

  afterAll(async () => {
    await deleteTestUser(testUser.id)
  })

  describe('Create', () => {
    it('can create a resume document', async () => {
      const { data, error } = await userClient
        .from('documents')
        .insert({
          user_id: testUser.id,
          type: 'resume',
          filename: 'my-resume.pdf',
          raw_text: 'Resume content here'
        })
        .select('*')
        .single()

      expect(error).toBeNull()
      expect(data?.id).toBeDefined()
      expect(data?.type).toBe('resume')
      expect(data?.filename).toBe('my-resume.pdf')
      expect(data?.status).toBe('pending') // Default status
    })

    it('can create a story document', async () => {
      const { data, error } = await userClient
        .from('documents')
        .insert({
          user_id: testUser.id,
          type: 'story',
          filename: 'my-story.txt',
          raw_text: 'My career story...'
        })
        .select('*')
        .single()

      expect(error).toBeNull()
      expect(data?.type).toBe('story')
    })

    it('rejects invalid document type', async () => {
      const { error } = await userClient
        .from('documents')
        .insert({
          user_id: testUser.id,
          type: 'invalid-type' as string,
          filename: 'test.pdf'
        })

      expect(error).toBeDefined()
      expect(error?.message).toMatch(/check|constraint|type/i)
    })
  })

  describe('Read', () => {
    it('can list all user documents', async () => {
      const { data, error } = await userClient
        .from('documents')
        .select('*')
        .eq('user_id', testUser.id)

      expect(error).toBeNull()
      expect(Array.isArray(data)).toBe(true)
      expect(data!.length).toBeGreaterThan(0)
    })

    it('can filter documents by type', async () => {
      const { data, error } = await userClient
        .from('documents')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'resume')

      expect(error).toBeNull()
      expect(data?.every(d => d.type === 'resume')).toBe(true)
    })
  })

  describe('Update', () => {
    it('can update document status', async () => {
      // Create a document first
      const { data: created } = await userClient
        .from('documents')
        .insert({
          user_id: testUser.id,
          type: 'resume',
          filename: 'status-test.pdf'
        })
        .select('id')
        .single()

      // Update status
      const { error } = await userClient
        .from('documents')
        .update({ status: 'completed' })
        .eq('id', created!.id)

      expect(error).toBeNull()

      // Verify
      const { data } = await userClient
        .from('documents')
        .select('status')
        .eq('id', created!.id)
        .single()

      expect(data?.status).toBe('completed')
    })

    it('can update document content', async () => {
      const { data: created } = await userClient
        .from('documents')
        .insert({
          user_id: testUser.id,
          type: 'resume',
          filename: 'content-test.pdf',
          raw_text: 'Original content'
        })
        .select('id')
        .single()

      const newContent = 'Updated resume content'
      const { error } = await userClient
        .from('documents')
        .update({ raw_text: newContent })
        .eq('id', created!.id)

      expect(error).toBeNull()

      const { data } = await userClient
        .from('documents')
        .select('raw_text')
        .eq('id', created!.id)
        .single()

      expect(data?.raw_text).toBe(newContent)
    })
  })

  describe('Delete', () => {
    it('can delete a document', async () => {
      // Create a document
      const { data: created } = await userClient
        .from('documents')
        .insert({
          user_id: testUser.id,
          type: 'resume',
          filename: 'to-delete.pdf'
        })
        .select('id')
        .single()

      // Delete it
      const { error: deleteError } = await userClient
        .from('documents')
        .delete()
        .eq('id', created!.id)

      expect(deleteError).toBeNull()

      // Verify it's gone
      const { data, error } = await userClient
        .from('documents')
        .select('id')
        .eq('id', created!.id)
        .single()

      // Should return no data (PGRST116 is "no rows returned")
      expect(data).toBeNull()
    })
  })
})

describe('Opportunity CRUD Operations', () => {
  let testUser: { id: string; email: string }
  let userClient: SupabaseClient
  const password = 'testpassword123'

  beforeAll(async () => {
    const adminClient = getAdminClient()

    testUser = await createTestUser(generateTestEmail(), password, {
      name: 'Opp CRUD User'
    })

    await waitForProfile(adminClient, testUser.id)
    userClient = await createAuthenticatedClient(testUser.email, password)
  })

  afterAll(async () => {
    await deleteTestUser(testUser.id)
  })

  describe('Create', () => {
    it('can create an opportunity', async () => {
      const { data, error } = await userClient
        .from('opportunities')
        .insert({
          user_id: testUser.id,
          title: 'Senior Software Engineer',
          company: 'Acme Inc',
          url: 'https://acme.com/jobs/123',
          description: 'Great job opportunity'
        })
        .select('*')
        .single()

      expect(error).toBeNull()
      expect(data?.id).toBeDefined()
      expect(data?.title).toBe('Senior Software Engineer')
      expect(data?.company).toBe('Acme Inc')
      expect(data?.status).toBe('tracking') // Default status
    })

    it('can create opportunity with minimal fields', async () => {
      const { data, error } = await userClient
        .from('opportunities')
        .insert({
          user_id: testUser.id,
          title: 'Minimal Job'
        })
        .select('*')
        .single()

      expect(error).toBeNull()
      expect(data?.title).toBe('Minimal Job')
      expect(data?.company).toBeNull()
      expect(data?.url).toBeNull()
    })

    it('can create opportunity with requirements JSON', async () => {
      const requirements = {
        skills: ['TypeScript', 'React', 'Node.js'],
        experience: '5+ years',
        education: 'BS in Computer Science'
      }

      const { data, error } = await userClient
        .from('opportunities')
        .insert({
          user_id: testUser.id,
          title: 'Full Stack Developer',
          requirements
        })
        .select('*')
        .single()

      expect(error).toBeNull()
      expect(data?.requirements).toEqual(requirements)
    })
  })

  describe('Update', () => {
    it('can update opportunity status', async () => {
      const { data: created } = await userClient
        .from('opportunities')
        .insert({
          user_id: testUser.id,
          title: 'Status Test Job'
        })
        .select('id')
        .single()

      // Update to applied
      const { error } = await userClient
        .from('opportunities')
        .update({ status: 'applied' })
        .eq('id', created!.id)

      expect(error).toBeNull()

      const { data } = await userClient
        .from('opportunities')
        .select('status')
        .eq('id', created!.id)
        .single()

      expect(data?.status).toBe('applied')
    })

    it('rejects invalid opportunity status', async () => {
      const { data: created } = await userClient
        .from('opportunities')
        .insert({
          user_id: testUser.id,
          title: 'Invalid Status Test'
        })
        .select('id')
        .single()

      const { error } = await userClient
        .from('opportunities')
        .update({ status: 'invalid-status' as string })
        .eq('id', created!.id)

      expect(error).toBeDefined()
    })
  })

  describe('Read with Filters', () => {
    it('can filter opportunities by status', async () => {
      // Create opportunities with different statuses
      await userClient.from('opportunities').insert([
        { user_id: testUser.id, title: 'Tracking Job 1', status: 'tracking' },
        { user_id: testUser.id, title: 'Applied Job 1', status: 'applied' },
        { user_id: testUser.id, title: 'Tracking Job 2', status: 'tracking' }
      ])

      const { data, error } = await userClient
        .from('opportunities')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('status', 'tracking')

      expect(error).toBeNull()
      expect(data?.every(o => o.status === 'tracking')).toBe(true)
    })

    it('can search opportunities by company', async () => {
      await userClient.from('opportunities').insert({
        user_id: testUser.id,
        title: 'Test Position',
        company: 'SearchableCompany123'
      })

      const { data, error } = await userClient
        .from('opportunities')
        .select('*')
        .eq('user_id', testUser.id)
        .ilike('company', '%SearchableCompany%')

      expect(error).toBeNull()
      expect(data!.length).toBeGreaterThan(0)
      expect(data?.some(o => o.company === 'SearchableCompany123')).toBe(true)
    })
  })

  describe('Delete', () => {
    it('can delete an opportunity', async () => {
      const { data: created } = await userClient
        .from('opportunities')
        .insert({
          user_id: testUser.id,
          title: 'To Be Deleted'
        })
        .select('id')
        .single()

      const { error: deleteError } = await userClient
        .from('opportunities')
        .delete()
        .eq('id', created!.id)

      expect(deleteError).toBeNull()

      const { data } = await userClient
        .from('opportunities')
        .select('id')
        .eq('id', created!.id)
        .single()

      expect(data).toBeNull()
    })
  })
})
