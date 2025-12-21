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

    // Mock claims with shared evidence
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'claim-1',
              type: 'skill',
              label: 'React',
              confidence: 0.85,
              claim_evidence: [
                { evidence_id: 'ev-1', strength: 'strong', evidence: { id: 'ev-1', text: 'Built React apps', source_type: 'resume', evidence_date: null } }
              ]
            },
            {
              id: 'claim-2',
              type: 'skill',
              label: 'TypeScript',
              confidence: 0.75,
              claim_evidence: [
                { evidence_id: 'ev-1', strength: 'medium', evidence: { id: 'ev-1', text: 'Built React apps', source_type: 'resume', evidence_date: null } }
              ]
            },
          ],
          error: null,
        }),
      }),
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
    // Claims share evidence ev-1, so there should be an edge
    expect(data.edges).toHaveLength(1);
    expect(data.edges[0]).toMatchObject({
      source: 'claim-1',
      target: 'claim-2',
      sharedEvidence: ['ev-1'],
    });
  });

  it('returns empty graph when no claims exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.nodes).toEqual([]);
    expect(data.edges).toEqual([]);
    expect(data.evidence).toEqual([]);
  });
});
