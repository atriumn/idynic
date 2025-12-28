import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useOpportunity, useTailoredProfile, useGenerateTailoredProfile } from '../../hooks/use-opportunity';
import { supabase } from '../../lib/supabase';
import { api } from '../../lib/api';
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
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

// Mock api
jest.mock('../../lib/api', () => ({
  api: {
    opportunities: {
      tailor: jest.fn(),
    },
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;
const mockFrom = supabase.from as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;
const mockTailor = api.opportunities.tailor as jest.Mock;

const mockOpportunityDetail = {
  id: 'opp-123',
  title: 'Senior Engineer',
  company: 'TechCorp',
  company_logo_url: 'https://example.com/logo.png',
  company_url: 'https://techcorp.com',
  url: 'https://techcorp.com/jobs/123',
  location: 'San Francisco, CA',
  employment_type: 'Full-time',
  status: 'new',
  description: 'Join our team...',
  description_html: '<p>Join our team...</p>',
  requirements: { mustHave: ['React'] },
  salary_min: 150000,
  salary_max: 200000,
  salary_currency: 'USD',
  company_role_context: null,
  company_recent_news: null,
  company_challenges: null,
  created_at: '2024-01-01T00:00:00Z',
};

const mockTailoredProfile = {
  id: 'profile-123',
  narrative: 'Your tailored profile...',
  resume_data: {
    summary: 'Experienced engineer...',
    skills: ['React', 'TypeScript'],
    experience: [],
    education: [],
  },
  created_at: '2024-01-01T00:00:00Z',
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

function createMockQueryBuilder(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
}

function createMockChannel() {
  const channel = {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  };
  return channel;
}

describe('useOpportunity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChannel.mockReturnValue(createMockChannel());
  });

  it('fetches opportunity detail when authenticated', async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(createMockQueryBuilder(mockOpportunityDetail));

    const { result } = renderHook(() => useOpportunity('opp-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOpportunityDetail);
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

    const { result } = renderHook(() => useOpportunity('opp-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('is disabled when opportunityId is empty', async () => {
    setupAuthenticatedSession();

    const { result } = renderHook(() => useOpportunity(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('subscribes to realtime updates', async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(createMockQueryBuilder(mockOpportunityDetail));
    const channel = createMockChannel();
    mockChannel.mockReturnValue(channel);

    const { unmount } = renderHook(() => useOpportunity('opp-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith('opportunity-opp-123');
    });

    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'opportunities',
      }),
      expect.any(Function)
    );
    expect(channel.subscribe).toHaveBeenCalled();

    unmount();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });
});

describe('useTailoredProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches tailored profile when authenticated', async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(createMockQueryBuilder(mockTailoredProfile));

    const { result } = renderHook(() => useTailoredProfile('opp-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockTailoredProfile);
  });

  it('returns null when profile not found', async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(
      createMockQueryBuilder(null, { code: 'PGRST116', message: 'Not found' })
    );

    const { result } = renderHook(() => useTailoredProfile('opp-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeNull();
  });

  it('throws on other errors', async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(
      createMockQueryBuilder(null, { code: 'OTHER', message: 'Database error' })
    );

    const { result } = renderHook(() => useTailoredProfile('opp-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useGenerateTailoredProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates tailored profile', async () => {
    setupAuthenticatedSession();
    const generatedProfile = {
      id: 'gen-123',
      opportunity: { id: 'opp-123', title: 'Engineer', company: 'TechCorp' },
      narrative: 'Generated narrative',
      resume_data: {},
      cached: false,
      created_at: '2024-01-01T00:00:00Z',
    };
    mockTailor.mockResolvedValueOnce({ data: generatedProfile });

    const { result } = renderHook(() => useGenerateTailoredProfile('opp-123'), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({});
    });

    expect(mockTailor).toHaveBeenCalledWith('opp-123');
    expect(result.current.data).toEqual(generatedProfile);
  });

  it('throws when not authenticated', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback('SIGNED_OUT', null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useGenerateTailoredProfile('opp-123'), {
      wrapper: createWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({});
      })
    ).rejects.toThrow('Not authenticated');
  });
});
