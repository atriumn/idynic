import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUserWithClient,
  cleanupTestUsers,
  generateTestEmail
} from '../setup/test-utils'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

describe('Document CRUD Operations', () => {
  let user: User
  let client: SupabaseClient<Database>

  beforeAll(async () => {
    const result = await createTestUserWithClient(generateTestEmail('docs-crud'))
    user = result.user
    client = result.client
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe('Create Documents', () => {
    it('should create a resume document', async () => {
      const { data, error } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'resume',
          filename: 'my-resume.pdf',
          status: 'pending'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.type).toBe('resume')
      expect(data?.filename).toBe('my-resume.pdf')
      expect(data?.status).toBe('pending')
      expect(data?.user_id).toBe(user.id)
    })

    it('should create a story document', async () => {
      const { data, error } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'story',
          filename: 'my-career-story.pdf',
          status: 'pending'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.type).toBe('story')
    })

    it('should create document with raw text', async () => {
      const rawText = 'This is the extracted text from my resume...'

      const { data, error } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'resume',
          filename: 'text-resume.txt',
          raw_text: rawText,
          status: 'completed'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.raw_text).toBe(rawText)
    })

    it('should create document with storage path', async () => {
      const storagePath = 'documents/user-123/resume-abc.pdf'

      const { data, error } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'resume',
          filename: 'cloud-resume.pdf',
          storage_path: storagePath,
          status: 'pending'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.storage_path).toBe(storagePath)
    })
  })

  describe('Read Documents', () => {
    let testDocId: string

    beforeAll(async () => {
      const { data } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'resume',
          filename: 'read-test.pdf',
          status: 'completed'
        })
        .select()
        .single()
      testDocId = data!.id
    })

    it('should read document by ID', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('id', testDocId)
        .single()

      expect(error).toBeNull()
      expect(data?.id).toBe(testDocId)
    })

    it('should list all user documents', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.length).toBeGreaterThan(0)
    })

    it('should filter documents by type', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'resume')

      expect(error).toBeNull()
      expect(data).toBeDefined()
      data?.forEach((doc) => {
        expect(doc.type).toBe('resume')
      })
    })

    it('should filter documents by status', async () => {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed')

      expect(error).toBeNull()
      data?.forEach((doc) => {
        expect(doc.status).toBe('completed')
      })
    })
  })

  describe('Update Documents', () => {
    let docToUpdate: string

    beforeAll(async () => {
      const { data } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'resume',
          filename: 'update-test.pdf',
          status: 'pending'
        })
        .select()
        .single()
      docToUpdate = data!.id
    })

    it('should update document status', async () => {
      const { data, error } = await client
        .from('documents')
        .update({ status: 'processing' })
        .eq('id', docToUpdate)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.status).toBe('processing')
    })

    it('should update document to completed with raw text', async () => {
      const rawText = 'Extracted resume content goes here...'

      const { data, error } = await client
        .from('documents')
        .update({
          status: 'completed',
          raw_text: rawText
        })
        .eq('id', docToUpdate)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.status).toBe('completed')
      expect(data?.raw_text).toBe(rawText)
    })

    it('should update document to failed status', async () => {
      // Create a new document to fail
      const { data: newDoc } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'resume',
          filename: 'will-fail.pdf',
          status: 'processing'
        })
        .select()
        .single()

      const { data, error } = await client
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', newDoc!.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.status).toBe('failed')
    })
  })

  describe('Delete Documents', () => {
    it('should delete a document', async () => {
      // Create a document to delete
      const { data: created } = await client
        .from('documents')
        .insert({
          user_id: user.id,
          type: 'resume',
          filename: 'to-delete.pdf',
          status: 'pending'
        })
        .select()
        .single()

      const { error } = await client.from('documents').delete().eq('id', created!.id)

      expect(error).toBeNull()

      // Verify deletion
      const { data: verify } = await client
        .from('documents')
        .select('id')
        .eq('id', created!.id)

      expect(verify?.length ?? 0).toBe(0)
    })
  })
})

describe('Claims CRUD Operations', () => {
  let user: User
  let client: SupabaseClient<Database>
  let documentId: string

  beforeAll(async () => {
    const result = await createTestUserWithClient(generateTestEmail('claims-crud'))
    user = result.user
    client = result.client

    // Create a document to attach claims to
    const { data } = await client
      .from('documents')
      .insert({
        user_id: user.id,
        type: 'resume',
        filename: 'claims-test.pdf',
        status: 'completed'
      })
      .select()
      .single()
    documentId = data!.id
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe('Create Claims', () => {
    it('should create a skill claim', async () => {
      const { data, error } = await client
        .from('claims')
        .insert({
          user_id: user.id,
          document_id: documentId,
          claim_type: 'skill',
          value: { name: 'TypeScript', level: 'expert' },
          evidence_text: 'Built multiple production apps with TypeScript',
          confidence: 0.95
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.claim_type).toBe('skill')
      expect(data?.value).toEqual({ name: 'TypeScript', level: 'expert' })
      expect(data?.confidence).toBe(0.95)
    })

    it('should create an experience claim', async () => {
      const { data, error } = await client
        .from('claims')
        .insert({
          user_id: user.id,
          document_id: documentId,
          claim_type: 'experience',
          value: {
            title: 'Senior Engineer',
            company: 'Tech Corp',
            years: 3
          },
          evidence_text: 'Worked as Senior Engineer at Tech Corp from 2020-2023',
          confidence: 0.9
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.claim_type).toBe('experience')
    })
  })

  describe('Read Claims', () => {
    it('should list claims for a document', async () => {
      const { data, error } = await client
        .from('claims')
        .select('*')
        .eq('document_id', documentId)

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.length).toBeGreaterThan(0)
    })

    it('should list all claims for user', async () => {
      const { data, error } = await client.from('claims').select('*').eq('user_id', user.id)

      expect(error).toBeNull()
      expect(data).toBeDefined()
    })

    it('should filter claims by type', async () => {
      const { data, error } = await client
        .from('claims')
        .select('*')
        .eq('user_id', user.id)
        .eq('claim_type', 'skill')

      expect(error).toBeNull()
      data?.forEach((claim) => {
        expect(claim.claim_type).toBe('skill')
      })
    })
  })

  describe('Update Claims', () => {
    it('should update claim confidence', async () => {
      // Get a claim
      const { data: existing } = await client
        .from('claims')
        .select('id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      const { data, error } = await client
        .from('claims')
        .update({ confidence: 0.85 })
        .eq('id', existing!.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.confidence).toBe(0.85)
    })

    it('should update claim value', async () => {
      // Get a claim
      const { data: existing } = await client
        .from('claims')
        .select('id')
        .eq('user_id', user.id)
        .eq('claim_type', 'skill')
        .limit(1)
        .single()

      const newValue = { name: 'TypeScript', level: 'advanced', years: 5 }

      const { data, error } = await client
        .from('claims')
        .update({ value: newValue })
        .eq('id', existing!.id)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.value).toEqual(newValue)
    })
  })

  describe('Delete Claims', () => {
    it('should delete a claim', async () => {
      // Create a claim to delete
      const { data: created } = await client
        .from('claims')
        .insert({
          user_id: user.id,
          document_id: documentId,
          claim_type: 'skill',
          value: { name: 'To Delete' },
          evidence_text: 'Will be deleted',
          confidence: 0.5
        })
        .select()
        .single()

      const { error } = await client.from('claims').delete().eq('id', created!.id)

      expect(error).toBeNull()

      // Verify deletion
      const { data: verify } = await client.from('claims').select('id').eq('id', created!.id)

      expect(verify?.length ?? 0).toBe(0)
    })
  })
})
