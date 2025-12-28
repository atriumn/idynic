import { renderHook, waitFor, act } from '@testing-library/react-native';
import {
  useSharedLinks,
  useCreateSharedLink,
  useRevokeSharedLink,
  useDeleteSharedLink,
} from '../../hooks/use-shared-links';
import { supabase } from '../../lib/supabase';
import { createWrapper } from '../test-utils';
import { mockSession } from '../mocks/api-responses';

// Mock crypto.getRandomValues
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
});

// Mock supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockFrom = supabase.from as jest.Mock;

const mockSharedLinkDbResult = {
  id: 'link-123',
  token: 'abc123token',
  expires_at: '2024-12-31T00:00:00Z',
  revoked_at: null,
  created_at: '2024-01-01T00:00:00Z',
  tailored_profile_id: 'profile-123',
  tailored_profiles: {
    id: 'profile-123',
    opportunity_id: 'opp-123',
    opportunities: {
      id: 'opp-123',
      title: 'Senior Engineer',
      company: 'TechCorp',
    },
  },
  shared_link_views: [{ id: 'view-1' }, { id: 'view-2' }],
};

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

describe('useSharedLinks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches shared links when authenticated', async () => {
    setupAuthenticatedSession();

    const mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({
        data: [mockSharedLinkDbResult],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(mockQueryBuilder);

    const { result } = renderHook(() => useSharedLinks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([
      {
        id: 'link-123',
        token: 'abc123token',
        expiresAt: '2024-12-31T00:00:00Z',
        revokedAt: null,
        createdAt: '2024-01-01T00:00:00Z',
        tailoredProfileId: 'profile-123',
        opportunity: {
          id: 'opp-123',
          title: 'Senior Engineer',
          company: 'TechCorp',
        },
        viewCount: 2,
      },
    ]);
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

    const { result } = renderHook(() => useSharedLinks(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });
  });
});

describe('useCreateSharedLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns existing link if one exists', async () => {
    setupAuthenticatedSession();

    const existingLink = {
      id: 'link-existing',
      token: 'existing-token',
      expires_at: '2024-12-31T00:00:00Z',
    };

    mockFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: existingLink, error: null }),
    });

    const { result } = renderHook(() => useCreateSharedLink(), {
      wrapper: createWrapper(),
    });

    let response: { id: string; token: string; url: string } | undefined;
    await act(async () => {
      response = await result.current.mutateAsync({
        tailoredProfileId: 'profile-123',
      });
    });

    expect(response).toEqual({
      id: 'link-existing',
      token: 'existing-token',
      expiresAt: '2024-12-31T00:00:00Z',
      url: 'https://idynic.com/shared/existing-token',
    });
  });

  it('creates new link if none exists', async () => {
    setupAuthenticatedSession();

    const newLink = {
      id: 'link-new',
      token: 'new-token',
      expires_at: '2024-12-31T00:00:00Z',
    };

    // First call checks for existing, second call inserts
    const selectMock = jest.fn().mockReturnThis();
    const eqMock = jest.fn().mockReturnThis();
    const isMock = jest.fn().mockReturnThis();
    const singleMock = jest.fn();
    const insertMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: newLink, error: null }),
      }),
    });

    // First query (check existing) returns null
    singleMock.mockResolvedValueOnce({ data: null, error: null });

    mockFrom.mockReturnValue({
      select: selectMock,
      eq: eqMock,
      is: isMock,
      single: singleMock,
      insert: insertMock,
    });

    const { result } = renderHook(() => useCreateSharedLink(), {
      wrapper: createWrapper(),
    });

    let response: { id: string; token: string; url: string } | undefined;
    await act(async () => {
      response = await result.current.mutateAsync({
        tailoredProfileId: 'profile-123',
        expiresInDays: 30,
      });
    });

    expect(response?.id).toBe('link-new');
    expect(insertMock).toHaveBeenCalled();
  });
});

describe('useRevokeSharedLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('revokes a shared link', async () => {
    setupAuthenticatedSession();

    const updateMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom.mockReturnValue({ update: updateMock });

    const { result } = renderHook(() => useRevokeSharedLink(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('link-123');
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) })
    );
  });
});

describe('useDeleteSharedLink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deletes a shared link', async () => {
    setupAuthenticatedSession();

    const deleteMock = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockFrom.mockReturnValue({ delete: deleteMock });

    const { result } = renderHook(() => useDeleteSharedLink(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync('link-123');
    });

    expect(deleteMock).toHaveBeenCalled();
  });
});
