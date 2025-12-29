import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  createTestUserWithClient,
  cleanupTestUsers,
  generateTestEmail
} from '../setup/test-utils'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

describe('Opportunity CRUD Operations', () => {
  let user: User
  let client: SupabaseClient<Database>

  beforeAll(async () => {
    const result = await createTestUserWithClient(generateTestEmail('opp-crud'))
    user = result.user
    client = result.client
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  describe('Create Opportunities', () => {
    it('should create a basic opportunity', async () => {
      const { data, error } = await client
        .from('opportunities')
        .insert({
          user_id: user.id,
          title: 'Software Engineer',
          company: 'Tech Corp',
          status: 'tracking'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data?.title).toBe('Software Engineer')
      expect(data?.company).toBe('Tech Corp')
      expect(data?.status).toBe('tracking')
      expect(data?.user_id).toBe(user.id)
    })

    it('should create opportunity with URL and description', async () => {
      const { data, error } = await client
        .from('opportunities')
        .insert({
          user_id: user.id,
          title: 'Senior Frontend Developer',
          company: 'Startup Inc',
          url: 'https://example.com/jobs/123',
          description: 'Looking for a senior frontend developer with React experience',
          status: 'tracking'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.url).toBe('https://example.com/jobs/123')
      expect(data?.description).toContain('frontend developer')
    })

    it('should create opportunity with requirements', async () => {
      const requirements = {
        required: ['5+ years experience', 'React', 'TypeScript'],
        preferred: ['GraphQL', 'AWS']
      }

      const { data, error } = await client
        .from('opportunities')
        .insert({
          user_id: user.id,
          title: 'Full Stack Engineer',
          company: 'Enterprise Co',
          requirements,
          status: 'applied'
        })
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.requirements).toEqual(requirements)
    })

    it('should create opportunity with all statuses', async () => {
      const statuses = ['tracking', 'applied', 'interviewing', 'offer', 'rejected', 'archived']

      for (const status of statuses) {
        const { data, error } = await client
          .from('opportunities')
          .insert({
            user_id: user.id,
            title: `Job with status ${status}`,
            company: 'Status Test Corp',
            status: status as 'tracking' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'archived'
          })
          .select()
          .single()

        expect(error).toBeNull()
        expect(data?.status).toBe(status)
      }
    })
  })

  describe('Read Opportunities', () => {
    let testOppId: string

    beforeAll(async () => {
      const { data } = await client
        .from('opportunities')
        .insert({
          user_id: user.id,
          title: 'Read Test Job',
          company: 'Read Test Corp',
          status: 'tracking'
        })
        .select()
        .single()
      testOppId = data!.id
    })

    it('should read opportunity by ID', async () => {
      const { data, error } = await client
        .from('opportunities')
        .select('*')
        .eq('id', testOppId)
        .single()

      expect(error).toBeNull()
      expect(data?.id).toBe(testOppId)
      expect(data?.title).toBe('Read Test Job')
    })

    it('should list all user opportunities', async () => {
      const { data, error } = await client
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      expect(error).toBeNull()
      expect(data).toBeDefined()
      expect(data!.length).toBeGreaterThan(0)
    })

    it('should filter opportunities by status', async () => {
      const { data, error } = await client
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'tracking')

      expect(error).toBeNull()
      data?.forEach((opp) => {
        expect(opp.status).toBe('tracking')
      })
    })

    it('should filter opportunities by company', async () => {
      const { data, error } = await client
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .ilike('company', '%Corp%')

      expect(error).toBeNull()
      data?.forEach((opp) => {
        expect(opp.company?.toLowerCase()).toContain('corp')
      })
    })

    it('should search opportunities by title', async () => {
      const { data, error } = await client
        .from('opportunities')
        .select('*')
        .eq('user_id', user.id)
        .ilike('title', '%Engineer%')

      expect(error).toBeNull()
      data?.forEach((opp) => {
        expect(opp.title.toLowerCase()).toContain('engineer')
      })
    })
  })

  describe('Update Opportunities', () => {
    let oppToUpdate: string

    beforeAll(async () => {
      const { data } = await client
        .from('opportunities')
        .insert({
          user_id: user.id,
          title: 'Update Test Job',
          company: 'Update Test Corp',
          status: 'tracking'
        })
        .select()
        .single()
      oppToUpdate = data!.id
    })

    it('should update opportunity status', async () => {
      const { data, error } = await client
        .from('opportunities')
        .update({ status: 'applied' })
        .eq('id', oppToUpdate)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.status).toBe('applied')
    })

    it('should update opportunity to interviewing', async () => {
      const { data, error } = await client
        .from('opportunities')
        .update({ status: 'interviewing' })
        .eq('id', oppToUpdate)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.status).toBe('interviewing')
    })

    it('should update opportunity details', async () => {
      const updates = {
        title: 'Updated Senior Engineer',
        company: 'Updated Corp',
        url: 'https://updated-url.com/job',
        description: 'Updated job description'
      }

      const { data, error } = await client
        .from('opportunities')
        .update(updates)
        .eq('id', oppToUpdate)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.title).toBe(updates.title)
      expect(data?.company).toBe(updates.company)
      expect(data?.url).toBe(updates.url)
      expect(data?.description).toBe(updates.description)
    })

    it('should update opportunity requirements', async () => {
      const newRequirements = {
        required: ['10+ years experience', 'Leadership'],
        preferred: ['MBA']
      }

      const { data, error } = await client
        .from('opportunities')
        .update({ requirements: newRequirements })
        .eq('id', oppToUpdate)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.requirements).toEqual(newRequirements)
    })

    it('should archive opportunity', async () => {
      const { data, error } = await client
        .from('opportunities')
        .update({ status: 'archived' })
        .eq('id', oppToUpdate)
        .select()
        .single()

      expect(error).toBeNull()
      expect(data?.status).toBe('archived')
    })
  })

  describe('Delete Opportunities', () => {
    it('should delete an opportunity', async () => {
      // Create an opportunity to delete
      const { data: created } = await client
        .from('opportunities')
        .insert({
          user_id: user.id,
          title: 'To Delete Job',
          company: 'Delete Corp',
          status: 'tracking'
        })
        .select()
        .single()

      const { error } = await client.from('opportunities').delete().eq('id', created!.id)

      expect(error).toBeNull()

      // Verify deletion
      const { data: verify } = await client
        .from('opportunities')
        .select('id')
        .eq('id', created!.id)

      expect(verify?.length ?? 0).toBe(0)
    })
  })
})

describe('Opportunity Matches', () => {
  let user: User
  let client: SupabaseClient<Database>
  let opportunityId: string
  let claimId: string

  beforeAll(async () => {
    const result = await createTestUserWithClient(generateTestEmail('matches'))
    user = result.user
    client = result.client

    // Create a document and claim
    const { data: doc } = await client
      .from('documents')
      .insert({
        user_id: user.id,
        type: 'resume',
        filename: 'matches-test.pdf',
        status: 'completed'
      })
      .select()
      .single()

    const { data: claim } = await client
      .from('claims')
      .insert({
        user_id: user.id,
        document_id: doc!.id,
        claim_type: 'skill',
        value: { name: 'React' },
        evidence_text: 'Built React apps',
        confidence: 0.9
      })
      .select()
      .single()
    claimId = claim!.id

    // Create an opportunity
    const { data: opp } = await client
      .from('opportunities')
      .insert({
        user_id: user.id,
        title: 'React Developer',
        company: 'Match Corp',
        status: 'tracking'
      })
      .select()
      .single()
    opportunityId = opp!.id
  })

  afterAll(async () => {
    await cleanupTestUsers()
  })

  it('should create a match between claim and opportunity', async () => {
    const { data, error } = await client
      .from('matches')
      .insert({
        user_id: user.id,
        opportunity_id: opportunityId,
        claim_id: claimId,
        score: 0.85
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data?.score).toBe(0.85)
    expect(data?.opportunity_id).toBe(opportunityId)
    expect(data?.claim_id).toBe(claimId)
  })

  it('should read matches for an opportunity', async () => {
    const { data, error } = await client
      .from('matches')
      .select('*, claims(*)')
      .eq('opportunity_id', opportunityId)

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data!.length).toBeGreaterThan(0)
  })

  it('should prevent duplicate matches (same claim + opportunity)', async () => {
    // Try to insert a duplicate
    const { error } = await client.from('matches').insert({
      user_id: user.id,
      opportunity_id: opportunityId,
      claim_id: claimId,
      score: 0.75
    })

    // Should fail due to unique constraint
    expect(error).toBeDefined()
    expect(error?.code).toBe('23505') // PostgreSQL unique violation
  })

  it('should update match score', async () => {
    // Get existing match
    const { data: existing } = await client
      .from('matches')
      .select('id')
      .eq('opportunity_id', opportunityId)
      .eq('claim_id', claimId)
      .single()

    const { data, error } = await client
      .from('matches')
      .update({ score: 0.95 })
      .eq('id', existing!.id)
      .select()
      .single()

    expect(error).toBeNull()
    expect(data?.score).toBe(0.95)
  })

  it('should delete a match', async () => {
    // Create a new claim and match to delete
    const { data: newClaim } = await client
      .from('claims')
      .insert({
        user_id: user.id,
        claim_type: 'skill',
        value: { name: 'To Delete' },
        evidence_text: 'Will be deleted',
        confidence: 0.5
      })
      .select()
      .single()

    const { data: newMatch } = await client
      .from('matches')
      .insert({
        user_id: user.id,
        opportunity_id: opportunityId,
        claim_id: newClaim!.id,
        score: 0.5
      })
      .select()
      .single()

    // Delete the match
    const { error } = await client.from('matches').delete().eq('id', newMatch!.id)

    expect(error).toBeNull()
  })
})
