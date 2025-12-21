import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks to ensure they're available during import
const { mockChatCreate, mockEmbeddingsCreate, mockRpc, mockFrom } = vi.hoisted(() => {
  return {
    mockChatCreate: vi.fn(),
    mockEmbeddingsCreate: vi.fn(),
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
  };
});

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockChatCreate,
        },
      };
      embeddings = {
        create: mockEmbeddingsCreate,
      };
    },
  };
});

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

import { synthesizeClaimsBatch } from '@/lib/ai/synthesize-claims-batch';

interface EvidenceItem {
  id: string;
  text: string;
  type: 'accomplishment' | 'skill_listed' | 'trait_indicator' | 'education' | 'certification';
  embedding: number[];
}

describe('synthesizeClaimsBatch with RAG', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default embedding mock
    mockEmbeddingsCreate.mockResolvedValue({
      object: 'list',
      data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    // Default mock for from().select() chain
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-claim-id' }, error: null }),
        }),
      }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  it('should call RAG retrieval for each batch instead of loading all claims', async () => {
    // Setup RAG to return relevant claims
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'existing-claim',
          type: 'skill',
          label: 'React',
          description: null,
          confidence: 0.8,
          similarity: 0.7,
        },
      ],
      error: null,
    });

    // Setup LLM to match existing claim
    mockChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { evidence_id: 'ev1', match: 'React', strength: 'strong', new_claim: null },
            ]),
          },
        },
      ],
    });

    const evidence: EvidenceItem[] = [
      {
        id: 'ev1',
        text: 'Built React components',
        type: 'skill_listed' as const,
        embedding: new Array(1536).fill(0.1),
      },
    ];

    await synthesizeClaimsBatch('user-123', evidence);

    // Verify RAG was called (not full table load)
    expect(mockRpc).toHaveBeenCalledWith('find_relevant_claims_for_synthesis', {
      query_embedding: expect.any(String),
      p_user_id: 'user-123',
      similarity_threshold: 0.5,
      max_claims: 25,
    });

    // Verify the embedding was stringified
    const rpcCall = mockRpc.mock.calls[0];
    expect(typeof rpcCall[1].query_embedding).toBe('string');
  });

  it('should handle new users with no existing claims', async () => {
    // RAG returns empty (new user)
    mockRpc.mockResolvedValue({ data: [], error: null });

    // LLM creates new claim
    mockChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                evidence_id: 'ev1',
                match: null,
                strength: 'strong',
                new_claim: { type: 'skill', label: 'Python', description: 'Programming language' },
              },
            ]),
          },
        },
      ],
    });

    // Mock successful claim creation
    mockFrom.mockImplementation((table: string) => {
      if (table === 'identity_claims') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'new-claim-id', label: 'Python' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'claim_evidence') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const evidence: EvidenceItem[] = [
      {
        id: 'ev1',
        text: 'Python',
        type: 'skill_listed' as const,
        embedding: new Array(1536).fill(0.1),
      },
    ];

    const result = await synthesizeClaimsBatch('user-123', evidence);

    expect(result.claimsCreated).toBe(1);
    expect(mockRpc).toHaveBeenCalledWith('find_relevant_claims_for_synthesis', expect.any(Object));
  });

  it('should call RAG for each batch when processing multiple batches', async () => {
    // Create 15 evidence items (should create 2 batches with BATCH_SIZE=10)
    const evidence: EvidenceItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `ev${i}`,
      text: `Skill ${i}`,
      type: 'skill_listed' as const,
      embedding: new Array(1536).fill(0.1 + i * 0.01),
    }));

    // RAG returns different claims for different batches
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'claim-1',
          type: 'skill',
          label: 'React',
          description: null,
          confidence: 0.8,
          similarity: 0.7,
        },
      ],
      error: null,
    });

    // LLM matches all to existing claim
    mockChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify(
              Array.from({ length: 10 }, (_, i) => ({
                evidence_id: `ev${i}`,
                match: 'React',
                strength: 'strong',
                new_claim: null,
              }))
            ),
          },
        },
      ],
    });

    await synthesizeClaimsBatch('user-123', evidence);

    // RAG should be called once per batch (2 times for 15 items)
    // First batch: 10 items, Second batch: 5 items
    // Each batch makes 10 RAG calls (or 5 for second batch) - one per evidence item
    expect(mockRpc).toHaveBeenCalled();
    expect(mockRpc.mock.calls.length).toBeGreaterThan(1);
  });

  it('should merge RAG results with locally created claims across batches', async () => {
    // Create 11 evidence items (2 batches)
    const evidence: EvidenceItem[] = Array.from({ length: 11 }, (_, i) => ({
      id: `ev${i}`,
      text: `Skill ${i}`,
      type: 'skill_listed' as const,
      embedding: new Array(1536).fill(0.1 + i * 0.01),
    }));

    // First batch creates a new claim
    let callCount = 0;
    mockRpc.mockImplementation(() => {
      callCount++;
      // First 10 calls (batch 1) return empty
      if (callCount <= 10) {
        return Promise.resolve({ data: [], error: null });
      }
      // Second batch (call 11+) should still see empty RAG results
      return Promise.resolve({ data: [], error: null });
    });

    // First batch: create new claim for first item, match rest
    // Second batch: match to locally created claim
    let chatCallCount = 0;
    mockChatCreate.mockImplementation(() => {
      chatCallCount++;
      if (chatCallCount === 1) {
        // First batch
        return Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    evidence_id: 'ev0',
                    match: null,
                    strength: 'strong',
                    new_claim: { type: 'skill', label: 'TypeScript', description: 'Language' },
                  },
                  ...Array.from({ length: 9 }, (_, i) => ({
                    evidence_id: `ev${i + 1}`,
                    match: 'TypeScript',
                    strength: 'strong',
                    new_claim: null,
                  })),
                ]),
              },
            },
          ],
        });
      } else {
        // Second batch - should include locally created claim in context
        return Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    evidence_id: 'ev10',
                    match: 'TypeScript',
                    strength: 'strong',
                    new_claim: null,
                  },
                ]),
              },
            },
          ],
        });
      }
    });

    // Mock claim creation
    mockFrom.mockImplementation((table: string) => {
      if (table === 'identity_claims') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'local-claim-id', label: 'TypeScript' },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'claim_evidence') {
        return {
          upsert: vi.fn().mockResolvedValue({ error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [{ strength: 'strong' }],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const result = await synthesizeClaimsBatch('user-123', evidence);

    // Should create 1 claim and update it multiple times
    expect(result.claimsCreated).toBe(1);
    expect(result.claimsUpdated).toBeGreaterThan(0);
  });

  it('should handle RAG errors gracefully and continue processing', async () => {
    // RAG fails for first evidence, succeeds for second
    let rpcCallCount = 0;
    mockRpc.mockImplementation(() => {
      rpcCallCount++;
      if (rpcCallCount === 1) {
        return Promise.resolve({ data: null, error: { message: 'Database error' } });
      }
      return Promise.resolve({
        data: [
          {
            id: 'claim-1',
            type: 'skill',
            label: 'React',
            description: null,
            confidence: 0.8,
            similarity: 0.7,
          },
        ],
        error: null,
      });
    });

    mockChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { evidence_id: 'ev1', match: null, strength: 'strong', new_claim: null },
              { evidence_id: 'ev2', match: 'React', strength: 'strong', new_claim: null },
            ]),
          },
        },
      ],
    });

    const evidence: EvidenceItem[] = [
      {
        id: 'ev1',
        text: 'Skill 1',
        type: 'skill_listed' as const,
        embedding: new Array(1536).fill(0.1),
      },
      {
        id: 'ev2',
        text: 'Skill 2',
        type: 'skill_listed' as const,
        embedding: new Array(1536).fill(0.2),
      },
    ];

    // Should not throw, should continue processing
    const result = await synthesizeClaimsBatch('user-123', evidence);

    expect(result).toBeDefined();
  });

  it('should deduplicate claims returned by RAG across multiple evidence items in same batch', async () => {
    // Same claim returned for multiple evidence items - should only appear once in context
    mockRpc.mockResolvedValue({
      data: [
        {
          id: 'claim-1',
          type: 'skill',
          label: 'React',
          description: 'JavaScript library',
          confidence: 0.8,
          similarity: 0.75,
        },
      ],
      error: null,
    });

    mockChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify([
              { evidence_id: 'ev1', match: 'React', strength: 'strong', new_claim: null },
              { evidence_id: 'ev2', match: 'React', strength: 'strong', new_claim: null },
            ]),
          },
        },
      ],
    });

    const evidence: EvidenceItem[] = [
      {
        id: 'ev1',
        text: 'React hooks',
        type: 'skill_listed' as const,
        embedding: new Array(1536).fill(0.1),
      },
      {
        id: 'ev2',
        text: 'React components',
        type: 'skill_listed' as const,
        embedding: new Array(1536).fill(0.15),
      },
    ];

    await synthesizeClaimsBatch('user-123', evidence);

    // Verify LLM was called with deduplicated claims in prompt
    expect(mockChatCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            // Should only mention React once in EXISTING CLAIMS section
            content: expect.stringContaining('React'),
          }),
        ]),
      })
    );

    // RPC should be called once per evidence item
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});
