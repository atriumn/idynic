import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/identity/graph/route';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: mockFrom,
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => mockSupabase),
}));

describe('GET /api/identity/graph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns graph structure with nodes and edges', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });

    // Mock claims with shared document (both evidence items reference doc-1)
    mockFrom.mockImplementation((table: string) => {
      if (table === 'identity_claims') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'claim-1',
                  type: 'skill',
                  label: 'React',
                  confidence: 0.85,
                  description: null,
                  claim_evidence: [
                    { evidence_id: 'ev-1', strength: 'strong', evidence: { id: 'ev-1', text: 'Built React apps', source_type: 'resume', evidence_date: null, document_id: 'doc-1' } }
                  ]
                },
                {
                  id: 'claim-2',
                  type: 'skill',
                  label: 'TypeScript',
                  confidence: 0.75,
                  description: null,
                  claim_evidence: [
                    { evidence_id: 'ev-2', strength: 'medium', evidence: { id: 'ev-2', text: 'Used TypeScript', source_type: 'resume', evidence_date: null, document_id: 'doc-1' } }
                  ]
                },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === 'documents') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: [
                { id: 'doc-1', type: 'resume', filename: 'resume.pdf', created_at: '2024-01-01T00:00:00Z' }
              ],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toHaveLength(2);
    expect(data.nodes[0]).toMatchObject({
      id: 'claim-1',
      type: 'skill',
      label: 'React',
      confidence: 0.85,
    });
    // Claims share document doc-1, so there should be an edge
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0]).toMatchObject({
      source: 'claim-1',
      target: 'claim-2',
      sharedEvidence: ['doc-1'],  // Now contains shared document IDs
    });
    // Verify documents and documentClaimEdges are returned
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0]).toMatchObject({
      id: "doc-1",
      type: "resume",
    });
    // Name now includes date: "resume.pdf (1/1/2024)" or similar depending on locale
    expect(data.documents[0].name).toMatch(/^resume\.pdf \(\d+\/\d+\/\d+\)$/);
    expect(data.documentClaimEdges).toHaveLength(2);
  });

  it('returns empty graph when no claims exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockFrom.mockImplementation((table: string) => {
      if (table === 'identity_claims') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
    expect(data.evidence).toEqual([]);
    expect(data.documents).toEqual([]);
    expect(data.documentClaimEdges).toEqual([]);
  });
});
