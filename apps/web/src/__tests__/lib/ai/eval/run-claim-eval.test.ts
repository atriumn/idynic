import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// Mock the claim grounding module
vi.mock('@/lib/ai/eval/claim-grounding', () => ({
  runClaimGroundingEval: vi.fn().mockResolvedValue({ issues: [], costCents: 5 }),
}));

import { runClaimEval } from '@/lib/ai/eval/run-claim-eval';
import { runClaimGroundingEval } from '@/lib/ai/eval/claim-grounding';

describe('run-claim-eval', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  function createMockSupabase() {
    const mockFrom = vi.fn();
    const mockSelect = vi.fn();
    const mockEq = vi.fn();
    const mockIn = vi.fn();
    const mockInsert = vi.fn();

    // Chain setup
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
    mockEq.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    mockInsert.mockResolvedValue({ error: null });

    return {
      from: mockFrom,
      _mockSelect: mockSelect,
      _mockEq: mockEq,
      _mockIn: mockIn,
      _mockInsert: mockInsert,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase();
  });

  describe('evidence query structure', () => {
    it('should query claim_evidence with strength and evidence.text', async () => {
      // Setup: return claims with evidence counts
      const claimsData = [
        { id: 'claim-1', type: 'skill', label: 'React', description: 'React dev', created_at: '2024-01-01', claim_evidence: [{ count: 1 }] },
        { id: 'claim-2', type: 'skill', label: 'Python', description: 'Python dev', created_at: '2024-01-02', claim_evidence: [{ count: 1 }] },
      ];

      const claimsWithEvidence = [
        {
          id: 'claim-1',
          label: 'React',
          description: 'React dev',
          claim_evidence: [
            { strength: 'strong', evidence: { text: 'Built React apps' } },
          ],
        },
        {
          id: 'claim-2',
          label: 'Python',
          description: 'Python dev',
          claim_evidence: [
            { strength: 'medium', evidence: { text: 'Used Python for scripts' } },
          ],
        },
      ];

      // First call: fetch claims with evidence counts
      mockSupabase._mockEq.mockResolvedValueOnce({ data: claimsData, error: null });
      // Second call: fetch claims with full evidence
      mockSupabase._mockIn.mockResolvedValueOnce({ data: claimsWithEvidence, error: null });

      await runClaimEval(mockSupabase as unknown as Parameters<typeof runClaimEval>[0], 'user-123', 'doc-123');

      // Verify runClaimGroundingEval was called with correct structure
      expect(runClaimGroundingEval).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'claim-1',
            label: 'React',
            description: 'React dev',
            evidence: [{ text: 'Built React apps', strength: 'strong' }],
          }),
          expect.objectContaining({
            id: 'claim-2',
            label: 'Python',
            description: 'Python dev',
            evidence: [{ text: 'Used Python for scripts', strength: 'medium' }],
          }),
        ]),
        { userId: 'user-123' }
      );
    });

    it('should correctly transform nested claim_evidence structure', async () => {
      const claimsData = [
        { id: 'claim-1', type: 'skill', label: 'AWS', description: 'AWS skills', created_at: '2024-01-01', claim_evidence: [{ count: 2 }] },
      ];

      // Multiple pieces of evidence for one claim
      const claimsWithEvidence = [
        {
          id: 'claim-1',
          label: 'AWS',
          description: 'AWS skills',
          claim_evidence: [
            { strength: 'strong', evidence: { text: 'Deployed to Lambda' } },
            { strength: 'medium', evidence: { text: 'Used S3 for storage' } },
          ],
        },
      ];

      mockSupabase._mockEq.mockResolvedValueOnce({ data: claimsData, error: null });
      mockSupabase._mockIn.mockResolvedValueOnce({ data: claimsWithEvidence, error: null });

      await runClaimEval(mockSupabase as unknown as Parameters<typeof runClaimEval>[0], 'user-123', 'doc-123');

      expect(runClaimGroundingEval).toHaveBeenCalledWith(
        [
          {
            id: 'claim-1',
            label: 'AWS',
            description: 'AWS skills',
            evidence: [
              { text: 'Deployed to Lambda', strength: 'strong' },
              { text: 'Used S3 for storage', strength: 'medium' },
            ],
          },
        ],
        { userId: 'user-123' }
      );
    });

    it('should filter out null evidence entries', async () => {
      const claimsData = [
        { id: 'claim-1', type: 'skill', label: 'Docker', description: null, created_at: '2024-01-01', claim_evidence: [{ count: 1 }] },
      ];

      const claimsWithEvidence = [
        {
          id: 'claim-1',
          label: 'Docker',
          description: null,
          claim_evidence: [
            { strength: 'strong', evidence: { text: 'Docker containers' } },
            { strength: 'weak', evidence: null }, // This should be filtered out
          ],
        },
      ];

      mockSupabase._mockEq.mockResolvedValueOnce({ data: claimsData, error: null });
      mockSupabase._mockIn.mockResolvedValueOnce({ data: claimsWithEvidence, error: null });

      await runClaimEval(mockSupabase as unknown as Parameters<typeof runClaimEval>[0], 'user-123', 'doc-123');

      expect(runClaimGroundingEval).toHaveBeenCalledWith(
        [
          {
            id: 'claim-1',
            label: 'Docker',
            description: null,
            evidence: [{ text: 'Docker containers', strength: 'strong' }],
          },
        ],
        { userId: 'user-123' }
      );
    });
  });

  describe('error handling', () => {
    it('should return empty result when claims fetch fails', async () => {
      mockSupabase._mockEq.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const result = await runClaimEval(mockSupabase as unknown as Parameters<typeof runClaimEval>[0], 'user-123', 'doc-123');

      expect(result).toEqual({ issuesFound: 0, issuesStored: 0, costCents: 0 });
      expect(runClaimGroundingEval).not.toHaveBeenCalled();
    });

    it('should continue when evidence fetch fails but log error', async () => {
      const claimsData = [
        { id: 'claim-1', type: 'skill', label: 'React', description: null, created_at: '2024-01-01', claim_evidence: [{ count: 1 }] },
      ];

      mockSupabase._mockEq.mockResolvedValueOnce({ data: claimsData, error: null });
      mockSupabase._mockIn.mockResolvedValueOnce({ data: null, error: { message: 'Evidence fetch failed' } });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await runClaimEval(mockSupabase as unknown as Parameters<typeof runClaimEval>[0], 'user-123', 'doc-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        '[run-claim-eval] Failed to fetch evidence:',
        expect.objectContaining({ message: 'Evidence fetch failed' })
      );
      expect(runClaimGroundingEval).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('sampling', () => {
    it('should respect maxClaimsForAiEval option', async () => {
      // Create 15 claims
      const claimsData = Array.from({ length: 15 }, (_, i) => ({
        id: `claim-${i}`,
        type: 'skill',
        label: `Skill ${i}`,
        description: null,
        created_at: '2024-01-01',
        claim_evidence: [{ count: 1 }],
      }));

      const claimsWithEvidence = Array.from({ length: 5 }, (_, i) => ({
        id: `claim-${i}`,
        label: `Skill ${i}`,
        description: null,
        claim_evidence: [{ strength: 'strong', evidence: { text: `Evidence ${i}` } }],
      }));

      mockSupabase._mockEq.mockResolvedValueOnce({ data: claimsData, error: null });
      mockSupabase._mockIn.mockResolvedValueOnce({ data: claimsWithEvidence, error: null });

      await runClaimEval(mockSupabase as unknown as Parameters<typeof runClaimEval>[0], 'user-123', 'doc-123', { maxClaimsForAiEval: 5 });

      // Should only evaluate 5 claims
      const mockFn = runClaimGroundingEval as Mock;
      const callArgs = mockFn.mock.calls[0][0] as unknown[];
      expect(callArgs.length).toBeLessThanOrEqual(5);
    });
  });
});
