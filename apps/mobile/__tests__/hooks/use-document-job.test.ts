import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useDocumentJob } from '../../hooks/use-document-job';
import { supabase } from '../../lib/supabase';

// Mock supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;

function createMockQueryBuilder(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnValue({
      then: (cb: (result: { data: unknown; error: unknown }) => void) => {
        cb({ data, error });
        return { catch: jest.fn() };
      },
    }),
  };
}

function createMockChannel() {
  return {
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  };
}

describe('useDocumentJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockChannel.mockReturnValue(createMockChannel());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null job when jobId is null', () => {
    const { result } = renderHook(() => useDocumentJob(null));

    expect(result.current.job).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.displayMessages).toEqual([]);
  });

  it('fetches job when jobId is provided', async () => {
    const mockJob = {
      id: 'job-123',
      status: 'processing',
      phase: 'parsing',
      highlights: [],
    };
    mockFrom.mockReturnValue(createMockQueryBuilder(mockJob));

    const { result } = renderHook(() => useDocumentJob('job-123'));

    await waitFor(() => {
      expect(result.current.job).toEqual(mockJob);
    });

    expect(mockFrom).toHaveBeenCalledWith('document_jobs');
  });

  it('sets error on fetch failure', async () => {
    mockFrom.mockReturnValue(
      createMockQueryBuilder(null, { message: 'Not found' })
    );

    const { result } = renderHook(() => useDocumentJob('job-123'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('subscribes to realtime updates', async () => {
    const mockJob = { id: 'job-123', status: 'processing', phase: 'parsing', highlights: [] };
    mockFrom.mockReturnValue(createMockQueryBuilder(mockJob));
    const channel = createMockChannel();
    mockChannel.mockReturnValue(channel);

    renderHook(() => useDocumentJob('job-123'));

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalledWith('job-job-123');
    });

    expect(channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        table: 'document_jobs',
      }),
      expect.any(Function)
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it('unsubscribes on unmount', async () => {
    const mockJob = { id: 'job-123', status: 'processing', phase: 'parsing', highlights: [] };
    mockFrom.mockReturnValue(createMockQueryBuilder(mockJob));
    const channel = createMockChannel();
    mockChannel.mockReturnValue(channel);

    const { unmount } = renderHook(() => useDocumentJob('job-123'));

    await waitFor(() => {
      expect(mockChannel).toHaveBeenCalled();
    });

    unmount();

    expect(channel.unsubscribe).toHaveBeenCalled();
  });

  it('formats highlights in displayMessages', async () => {
    const mockJob = {
      id: 'job-123',
      status: 'processing',
      phase: 'parsing',
      highlights: [
        { type: 'skill', text: 'React' },
        { type: 'achievement', text: 'Led team' },
      ],
    };
    mockFrom.mockReturnValue(createMockQueryBuilder(mockJob));

    const { result } = renderHook(() => useDocumentJob('job-123'));

    await waitFor(() => {
      expect(result.current.job).toBeTruthy();
    });

    // displayMessages should include formatted highlights
    expect(result.current.displayMessages.length).toBeGreaterThan(0);
  });

  it('clears state when jobId becomes null', async () => {
    const mockJob = { id: 'job-123', status: 'completed', phase: null, highlights: [] };
    mockFrom.mockReturnValue(createMockQueryBuilder(mockJob));

    const { result, rerender } = renderHook(
      (props: { jobId: string | null }) => useDocumentJob(props.jobId),
      { initialProps: { jobId: 'job-123' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.job).toBeTruthy();
    });

    rerender({ jobId: null });

    expect(result.current.job).toBeNull();
  });
});
