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

import { synthesizeClaimsBatch } from '@/lib/ai/synthesize-claims-batch';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

// Create mock Supabase client
const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
} as unknown as SupabaseClient<Database>;

interface EvidenceItem {
  id: string;
  text: string;
  type: 'accomplishment' | 'skill_listed' | 'trait_indicator' | 'education' | 'certification';
  embedding: number[];
  sourceType?: 'resume' | 'story' | 'certification' | 'inferred';
  evidenceDate?: Date | null;
}

describe('synthesize-claims-batch confidence scoring integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default embedding mock
    mockEmbeddingsCreate.mockResolvedValue({
      object: 'list',
      data: [{ embedding: new Array(1536).fill(0.1), index: 0 }],
      model: 'text-embedding-3-small',
      usage: { prompt_tokens: 10, total_tokens: 10 },
    });

    // Default RAG mock (empty results)
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  describe('new claim creation with enhanced scoring', () => {
    it('should calculate initial confidence using scoring module for resume evidence', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-claim-id', label: 'React' },
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            insert: insertMock,
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

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: null,
                  strength: 'medium',
                  new_claim: { type: 'skill', label: 'React', description: 'JavaScript library' },
                },
              ]),
            },
          },
        ],
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'React',
          type: 'skill_listed',
          embedding: new Array(1536).fill(0.1),
          sourceType: 'resume',
          evidenceDate: new Date('2024-01-01'),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      // Verify insert was called with confidence calculated by scoring module
      // Batch insert passes an array
      expect(insertMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            user_id: 'user-123',
            type: 'skill',
            label: 'React',
            description: 'JavaScript library',
            // For single evidence with medium strength + resume source + recent date:
            // base (0.5) * (strength 1.0 * source 1.0 * decay ~1.0) = ~0.5
            confidence: expect.any(Number),
          })
        ])
      );

      const insertCalls = insertMock.mock.calls[0][0];
      const insertCall = Array.isArray(insertCalls) ? insertCalls[0] : insertCalls;
      // For single evidence with medium strength + resume source:
      // base (0.5) * (strength 1.0 * source 1.0 * decay for 1yr old skill)
      // Evidence from 2024-01-01 is ~1 year old, causing some decay
      expect(insertCall.confidence).toBeGreaterThan(0.3);
      expect(insertCall.confidence).toBeLessThan(0.45);
    });

    it('should boost confidence for certification source type', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-claim-id', label: 'AWS Certified' },
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            insert: insertMock,
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

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: null,
                  strength: 'strong',
                  new_claim: {
                    type: 'certification',
                    label: 'AWS Certified',
                    description: 'AWS Solutions Architect',
                  },
                },
              ]),
            },
          },
        ],
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'AWS Certified Solutions Architect',
          type: 'certification',
          embedding: new Array(1536).fill(0.1),
          sourceType: 'certification',
          evidenceDate: new Date('2023-01-01'),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      const insertCalls = insertMock.mock.calls[0][0];
      const insertCall = Array.isArray(insertCalls) ? insertCalls[0] : insertCalls;
      // For certification: base (0.5) * (strength 1.2 * source 1.5 * decay 1.0) = 0.9
      // Should be significantly higher than resume-sourced evidence
      expect(insertCall.confidence).toBeGreaterThan(0.85);
      expect(insertCall.confidence).toBeLessThan(0.95);
    });

    it('should reduce confidence for inferred source type', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-claim-id', label: 'Leadership' },
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            insert: insertMock,
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

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: null,
                  strength: 'weak',
                  new_claim: { type: 'attribute', label: 'Leadership', description: 'Leads teams' },
                },
              ]),
            },
          },
        ],
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'Inferred leadership from context',
          type: 'trait_indicator',
          embedding: new Array(1536).fill(0.1),
          sourceType: 'inferred',
          evidenceDate: new Date('2024-01-01'),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      const insertCalls = insertMock.mock.calls[0][0];
      const insertCall = Array.isArray(insertCalls) ? insertCalls[0] : insertCalls;
      // For inferred: base (0.5) * (strength 0.7 * source 0.6 * decay ~1.0) = ~0.21
      // Should be significantly lower than resume-sourced evidence
      expect(insertCall.confidence).toBeLessThan(0.3);
      expect(insertCall.confidence).toBeGreaterThan(0.15);
    });

    it('should default to resume source when sourceType is missing', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-claim-id', label: 'TypeScript' },
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            insert: insertMock,
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

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: null,
                  strength: 'medium',
                  new_claim: { type: 'skill', label: 'TypeScript', description: 'Programming language' },
                },
              ]),
            },
          },
        ],
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'TypeScript',
          type: 'skill_listed',
          embedding: new Array(1536).fill(0.1),
          // No sourceType provided
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      const insertCalls = insertMock.mock.calls[0][0];
      const insertCall = Array.isArray(insertCalls) ? insertCalls[0] : insertCalls;
      // Should use resume (1.0) as default: base (0.5) * (strength 1.0 * source 1.0 * decay 1.0) = 0.5
      expect(insertCall.confidence).toBeCloseTo(0.5, 1);
    });
  });

  describe('recalculateConfidence with enhanced scoring', () => {
    it('should recalculate confidence using source_type weighting', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { type: 'skill' },
                  error: null,
                }),
              }),
              in: vi.fn().mockResolvedValue({
                data: [{
                  id: 'claim-1',
                  type: 'skill',
                  claim_evidence: [
                    { strength: 'strong', evidence: { source_type: 'certification', evidence_date: '2023-01-01' } },
                    { strength: 'medium', evidence: { source_type: 'resume', evidence_date: '2024-01-01' } },
                  ]
                }],
                error: null,
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'claim_evidence') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    strength: 'strong',
                    evidence: { source_type: 'certification', evidence_date: '2023-01-01' },
                  },
                  {
                    strength: 'medium',
                    evidence: { source_type: 'resume', evidence_date: '2024-01-01' },
                  },
                ],
                error: null,
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: 'Existing Claim',
                  strength: 'medium',
                  new_claim: null,
                },
              ]),
            },
          },
        ],
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'claim-1',
            type: 'skill',
            label: 'Existing Claim',
            description: null,
            confidence: 0.5,
            similarity: 0.8,
          },
        ],
        error: null,
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'New evidence',
          type: 'skill_listed',
          embedding: new Array(1536).fill(0.1),
          sourceType: 'resume',
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      // Verify update was called with recalculated confidence
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          confidence: expect.any(Number),
          updated_at: expect.any(String),
        })
      );

      const updateCall = updateMock.mock.calls[0][0];
      // With 2 evidence: base (0.7) * avg(strong*cert*decay + medium*resume*decay)
      // Both from 2023-2024 have some recency decay for skills
      expect(updateCall.confidence).toBeGreaterThan(0.55);
      expect(updateCall.confidence).toBeLessThan(0.75);
    });

    it('should apply recency decay when recalculating skill confidence', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { type: 'skill' },
                  error: null,
                }),
              }),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'claim-1', type: 'skill', claim_evidence: [{ strength: 'medium', evidence: { source_type: 'resume', evidence_date: '2021-01-01' } }] }],
                error: null,
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'claim_evidence') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    strength: 'medium',
                    // 4 years old = 1 half-life for skills = 50% decay
                    evidence: { source_type: 'resume', evidence_date: '2021-01-01' },
                  },
                ],
                error: null,
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: 'Old Skill',
                  strength: 'medium',
                  new_claim: null,
                },
              ]),
            },
          },
        ],
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'claim-1',
            type: 'skill',
            label: 'Old Skill',
            description: null,
            confidence: 0.5,
            similarity: 0.8,
          },
        ],
        error: null,
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'New evidence',
          type: 'skill_listed',
          embedding: new Array(1536).fill(0.1),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      const updateCall = updateMock.mock.calls[0][0];
      // Single old evidence: base (0.5) * (strength 1.0 * source 1.0 * decay ~0.5) = ~0.25
      // Should be significantly reduced due to age
      expect(updateCall.confidence).toBeLessThan(0.35);
      expect(updateCall.confidence).toBeGreaterThan(0.15);
    });

    it('should not apply decay for education claims', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { type: 'education' },
                  error: null,
                }),
              }),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'claim-1', type: 'education', claim_evidence: [{ strength: 'strong', evidence: { source_type: 'resume', evidence_date: '2005-01-01' } }] }],
                error: null,
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'claim_evidence') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    strength: 'strong',
                    // 20 years old - but education doesn't decay
                    evidence: { source_type: 'resume', evidence_date: '2005-01-01' },
                  },
                ],
                error: null,
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: 'CS Degree',
                  strength: 'strong',
                  new_claim: null,
                },
              ]),
            },
          },
        ],
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'claim-1',
            type: 'education',
            label: 'CS Degree',
            description: null,
            confidence: 0.5,
            similarity: 0.8,
          },
        ],
        error: null,
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'New evidence',
          type: 'education',
          embedding: new Array(1536).fill(0.1),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      const updateCall = updateMock.mock.calls[0][0];
      // Single education with strong: base (0.5) * (strength 1.2 * source 1.0 * decay 1.0) = 0.6
      // Should NOT be reduced despite old date
      expect(updateCall.confidence).toBeGreaterThan(0.55);
      expect(updateCall.confidence).toBeLessThan(0.65);
    });

    it('should handle missing evidence dates gracefully', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { type: 'skill' },
                  error: null,
                }),
              }),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'claim-1', type: 'skill', claim_evidence: [{ strength: 'medium', evidence: { source_type: 'resume', evidence_date: null } }] }],
                error: null,
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'claim_evidence') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    strength: 'medium',
                    evidence: { source_type: 'resume', evidence_date: null },
                  },
                ],
                error: null,
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: 'Skill',
                  strength: 'medium',
                  new_claim: null,
                },
              ]),
            },
          },
        ],
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'claim-1',
            type: 'skill',
            label: 'Skill',
            description: null,
            confidence: 0.5,
            similarity: 0.8,
          },
        ],
        error: null,
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'Evidence',
          type: 'skill_listed',
          embedding: new Array(1536).fill(0.1),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      const updateCall = updateMock.mock.calls[0][0];
      // No date = no penalty: base (0.5) * (strength 1.0 * source 1.0 * decay 1.0) = 0.5
      expect(updateCall.confidence).toBeCloseTo(0.5, 1);
    });

    it('should combine multiple evidence with different source types correctly', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { type: 'skill' },
                  error: null,
                }),
              }),
              in: vi.fn().mockResolvedValue({
                data: [{
                  id: 'claim-1',
                  type: 'skill',
                  claim_evidence: [
                    { strength: 'strong', evidence: { source_type: 'certification', evidence_date: '2024-01-01' } },
                    { strength: 'medium', evidence: { source_type: 'story', evidence_date: '2023-01-01' } },
                    { strength: 'weak', evidence: { source_type: 'inferred', evidence_date: '2024-06-01' } },
                  ]
                }],
                error: null,
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'claim_evidence') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    strength: 'strong',
                    evidence: { source_type: 'certification', evidence_date: '2024-01-01' },
                  },
                  {
                    strength: 'medium',
                    evidence: { source_type: 'story', evidence_date: '2023-01-01' },
                  },
                  {
                    strength: 'weak',
                    evidence: { source_type: 'inferred', evidence_date: '2024-06-01' },
                  },
                ],
                error: null,
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: 'Mixed Skill',
                  strength: 'medium',
                  new_claim: null,
                },
              ]),
            },
          },
        ],
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'claim-1',
            type: 'skill',
            label: 'Mixed Skill',
            description: null,
            confidence: 0.5,
            similarity: 0.8,
          },
        ],
        error: null,
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'New evidence',
          type: 'skill_listed',
          embedding: new Array(1536).fill(0.1),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      const updateCall = updateMock.mock.calls[0][0];
      // Three evidence: base (0.8) * avg(cert + story + inferred weights with decay)
      // Dates from 2023-2024 cause decay for skills
      expect(updateCall.confidence).toBeGreaterThan(0.5);
      expect(updateCall.confidence).toBeLessThan(0.7);
    });
  });

  describe('edge cases', () => {
    it('should handle claims with no evidence gracefully', async () => {
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { type: 'skill' },
                  error: null,
                }),
              }),
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'claim-1', type: 'skill', claim_evidence: [] }],
                error: null,
              }),
            }),
            update: updateMock,
          };
        }
        if (table === 'claim_evidence') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [], // No evidence
                error: null,
              }),
            }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: 'Empty Claim',
                  strength: 'medium',
                  new_claim: null,
                },
              ]),
            },
          },
        ],
      });

      mockRpc.mockResolvedValue({
        data: [
          {
            id: 'claim-1',
            type: 'skill',
            label: 'Empty Claim',
            description: null,
            confidence: 0.5,
            similarity: 0.8,
          },
        ],
        error: null,
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'Evidence',
          type: 'skill_listed',
          embedding: new Array(1536).fill(0.1),
        },
      ];

      // Should not throw
      await expect(synthesizeClaimsBatch(mockSupabase, 'user-123', evidence)).resolves.toBeDefined();
    });

    it('should cap confidence at 0.95 even with strong certification evidence', async () => {
      const insertMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'new-claim-id', label: 'Expert Certification' },
            error: null,
          }),
        }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'identity_claims') {
          return {
            insert: insertMock,
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
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

      mockChatCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify([
                {
                  evidence_id: 'ev1',
                  match: null,
                  strength: 'strong',
                  new_claim: {
                    type: 'certification',
                    label: 'Expert Certification',
                    description: 'Top tier cert',
                  },
                },
              ]),
            },
          },
        ],
      });

      const evidence: EvidenceItem[] = [
        {
          id: 'ev1',
          text: 'Expert level certification',
          type: 'certification',
          embedding: new Array(1536).fill(0.1),
          sourceType: 'certification',
          evidenceDate: new Date('2024-01-01'),
        },
      ];

      await synthesizeClaimsBatch(mockSupabase, 'user-123', evidence);

      // Batch insert passes an array, so access first item
      const insertCalls = insertMock.mock.calls[0][0];
      const insertCall = Array.isArray(insertCalls) ? insertCalls[0] : insertCalls;
      // Even with strong + certification + recent, should be capped at 0.95
      expect(insertCall.confidence).toBeLessThanOrEqual(0.95);
    });
  });
});
