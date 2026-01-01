import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useIdentityGraph, useInvalidateGraph } from '@/lib/hooks/use-identity-graph'
import React from 'react'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('useIdentityGraph', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })
  })

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children)

  const mockGraphData = {
    nodes: [
      {
        id: 'claim-1',
        type: 'skill',
        label: 'TypeScript',
        confidence: 0.85,
        description: 'Proficient in TypeScript',
        claim_evidence: [],
        issues: [],
      },
      {
        id: 'claim-2',
        type: 'experience',
        label: 'Senior Engineer',
        confidence: 0.9,
        description: 'Senior engineering role',
        claim_evidence: [],
        issues: [],
      },
    ],
    edges: [
      { source: 'claim-1', target: 'claim-2', sharedEvidence: ['evidence-1'] },
    ],
    evidence: [
      {
        id: 'evidence-1',
        text: 'Led TypeScript migration',
        sourceType: 'resume',
        date: '2023-01-01',
      },
    ],
    documents: [
      {
        id: 'doc-1',
        type: 'resume',
        name: 'resume.pdf',
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    documentClaimEdges: [{ documentId: 'doc-1', claimId: 'claim-1' }],
  }

  describe('useIdentityGraph', () => {
    it('fetches graph data successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGraphData,
      })

      const { result } = renderHook(() => useIdentityGraph(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/identity/graph')
      expect(result.current.data).toEqual(mockGraphData)
    })

    it('handles fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const { result } = renderHook(() => useIdentityGraph(), { wrapper })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeInstanceOf(Error)
      expect(result.current.error?.message).toBe('Failed to fetch graph')
    })

    it('returns loading state initially', () => {
      mockFetch.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useIdentityGraph(), { wrapper })

      expect(result.current.isLoading).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('uses identity-graph query key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGraphData,
      })

      renderHook(() => useIdentityGraph(), { wrapper })

      await waitFor(() => {
        const queryState = queryClient.getQueryState(['identity-graph'])
        expect(queryState).toBeDefined()
      })
    })
  })

  describe('useInvalidateGraph', () => {
    it('invalidates the identity-graph query', async () => {
      // First, populate the cache
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockGraphData,
      })

      const { result: graphResult } = renderHook(() => useIdentityGraph(), {
        wrapper,
      })

      await waitFor(() => {
        expect(graphResult.current.isSuccess).toBe(true)
      })

      // Now test invalidation
      const { result: invalidateResult } = renderHook(
        () => useInvalidateGraph(),
        { wrapper }
      )

      // Mock the next fetch for refetch after invalidation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockGraphData, nodes: [] }),
      })

      // Call the invalidate function
      invalidateResult.current()

      await waitFor(() => {
        const queryState = queryClient.getQueryState(['identity-graph'])
        expect(queryState?.isInvalidated).toBe(true)
      })
    })

    it('returns a function', () => {
      const { result } = renderHook(() => useInvalidateGraph(), { wrapper })
      expect(typeof result.current).toBe('function')
    })
  })

  describe('graph data structure', () => {
    it('handles empty graph data', async () => {
      const emptyGraph = {
        nodes: [],
        edges: [],
        evidence: [],
        documents: [],
        documentClaimEdges: [],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => emptyGraph,
      })

      const { result } = renderHook(() => useIdentityGraph(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.nodes).toEqual([])
      expect(result.current.data?.edges).toEqual([])
    })

    it('handles graph with issues', async () => {
      const graphWithIssues = {
        ...mockGraphData,
        nodes: [
          {
            ...mockGraphData.nodes[0],
            issues: [
              {
                id: 'issue-1',
                issue_type: 'weak_evidence',
                severity: 'warning',
                message: 'Limited evidence for this claim',
                related_claim_id: null,
                created_at: '2024-01-01T00:00:00Z',
              },
            ],
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => graphWithIssues,
      })

      const { result } = renderHook(() => useIdentityGraph(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.nodes[0].issues?.length).toBe(1)
    })

    it('handles graph with claim evidence', async () => {
      const graphWithEvidence = {
        ...mockGraphData,
        nodes: [
          {
            ...mockGraphData.nodes[0],
            claim_evidence: [
              {
                evidence_id: 'evidence-1',
                strength: 'strong',
                evidence: {
                  id: 'evidence-1',
                  text: 'Built TypeScript libraries',
                  evidence_type: 'accomplishment',
                  source_type: 'resume',
                  evidence_date: '2023-06-01',
                  document_id: 'doc-1',
                },
              },
            ],
          },
        ],
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => graphWithEvidence,
      })

      const { result } = renderHook(() => useIdentityGraph(), { wrapper })

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })

      expect(result.current.data?.nodes[0].claim_evidence?.length).toBe(1)
      expect(result.current.data?.nodes[0].claim_evidence?.[0].strength).toBe(
        'strong'
      )
    })
  })
})
