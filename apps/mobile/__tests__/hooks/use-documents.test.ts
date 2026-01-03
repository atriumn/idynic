import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useDocuments,
  useDocument,
  useDeleteDocument,
} from '../../hooks/use-documents';
import { supabase } from '../../lib/supabase';
import { createWrapper } from '../test-utils';
import { mockSession } from '../mocks/api-responses';

// Mock supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;

const mockDocumentListResult = {
  id: 'doc-123',
  type: 'resume',
  filename: 'resume.pdf',
  status: 'completed',
  created_at: '2024-01-01T00:00:00Z',
  evidence: { count: 5 },
};

const mockDocumentDetailResult = {
  id: 'doc-123',
  type: 'resume',
  filename: 'resume.pdf',
  raw_text: 'Sample resume text content',
  status: 'completed',
  created_at: '2024-01-01T00:00:00Z',
};

const mockEvidenceResults = [
  {
    id: 'ev-1',
    text: 'Managed a team of 5 engineers',
    evidence_type: 'accomplishment',
    source_type: 'resume',
    evidence_date: '2023-06-15',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'ev-2',
    text: 'TypeScript expert',
    evidence_type: 'skill_listed',
    source_type: 'resume',
    evidence_date: null,
    created_at: '2024-01-02T00:00:00Z',
  },
];

function setupAuthenticatedSession() {
  mockGetSession.mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });
  mockOnAuthStateChange.mockImplementation((callback) => {
    callback('SIGNED_IN', mockSession);
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
}

describe('useDocuments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches documents when authenticated', async () => {
    setupAuthenticatedSession();

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [mockDocumentListResult],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockQueryBuilder);

    const { result } = renderHook(() => useDocuments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([
      {
        id: 'doc-123',
        type: 'resume',
        filename: 'resume.pdf',
        status: 'completed',
        created_at: '2024-01-01T00:00:00Z',
        evidence_count: 5,
      },
    ]);
  });

  it('handles documents with array evidence format', async () => {
    setupAuthenticatedSession();

    const docWithArrayEvidence = {
      ...mockDocumentListResult,
      evidence: [{ id: '1' }, { id: '2' }, { id: '3' }],
    };

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [docWithArrayEvidence],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockQueryBuilder);

    const { result } = renderHook(() => useDocuments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.[0].evidence_count).toBe(3);
  });

  it('is disabled when not authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback('SIGNED_OUT', null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useDocuments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('handles fetch error', async () => {
    setupAuthenticatedSession();

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      }),
    };
    mockFrom.mockReturnValue(mockQueryBuilder);

    const { result } = renderHook(() => useDocuments(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches document detail with evidence when authenticated', async () => {
    setupAuthenticatedSession();

    // First call for document, second for evidence
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Document query
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: mockDocumentDetailResult,
            error: null,
          }),
        };
      } else {
        // Evidence query
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: mockEvidenceResults,
            error: null,
          }),
        };
      }
    });

    const { result } = renderHook(() => useDocument('doc-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({
      id: 'doc-123',
      type: 'resume',
      filename: 'resume.pdf',
      raw_text: 'Sample resume text content',
      status: 'completed',
      created_at: '2024-01-01T00:00:00Z',
      evidence: [
        {
          id: 'ev-1',
          text: 'Managed a team of 5 engineers',
          evidence_type: 'accomplishment',
          source_type: 'resume',
          evidence_date: '2023-06-15',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'ev-2',
          text: 'TypeScript expert',
          evidence_type: 'skill_listed',
          source_type: 'resume',
          evidence_date: null,
          created_at: '2024-01-02T00:00:00Z',
        },
      ],
    });
  });

  it('is disabled when document ID is null', async () => {
    setupAuthenticatedSession();

    const { result } = renderHook(() => useDocument(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  it('is disabled when not authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback('SIGNED_OUT', null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useDocument('doc-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useDeleteDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a document without storage path', async () => {
    setupAuthenticatedSession();

    const mockDocWithoutStorage = {
      id: 'doc-123',
      storage_path: null,
    };

    // Setup mock chain
    const singleMock = jest.fn().mockResolvedValue({
      data: mockDocWithoutStorage,
      error: null,
    });

    const deleteMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockFrom.mockImplementation((table) => {
      if (table === 'documents') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: singleMock,
          delete: deleteMock,
        };
      }
      return {};
    });

    const { result } = renderHook(() => useDeleteDocument(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('doc-123');
    });

    expect(deleteMock).toHaveBeenCalled();
  });

  it('deletes a document with storage path', async () => {
    setupAuthenticatedSession();

    const mockDocWithStorage = {
      id: 'doc-123',
      storage_path: 'resumes/user-123/file.pdf',
    };

    const singleMock = jest.fn().mockResolvedValue({
      data: mockDocWithStorage,
      error: null,
    });

    const deleteMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    const removeStorageMock = jest.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ remove: removeStorageMock });

    mockFrom.mockImplementation((table) => {
      if (table === 'documents') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: singleMock,
          delete: deleteMock,
        };
      }
      return {};
    });

    const { result } = renderHook(() => useDeleteDocument(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('doc-123');
    });

    expect(removeStorageMock).toHaveBeenCalledWith(['resumes/user-123/file.pdf']);
    expect(deleteMock).toHaveBeenCalled();
  });

  it('throws error when not authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback('SIGNED_OUT', null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useDeleteDocument(), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync('doc-123');
      })
    ).rejects.toThrow('Not authenticated');
  });
});
