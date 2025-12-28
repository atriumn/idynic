import { waitFor } from '@testing-library/react-native';
import { renderHook } from '../test-utils';
import {
  useIdentityClaims,
  hasAnyClaims,
  getTotalClaimCount,
} from '../../hooks/use-identity-claims';
import { supabase } from '../../lib/supabase';
import { mockSession, mockGroupedClaims, mockEmptyGroupedClaims } from '../mocks/api-responses';

// Mock expo-linking
jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(() => Promise.resolve()),
    },
    from: jest.fn(),
  },
  markSessionInvalid: jest.fn(),
}));

const mockFrom = supabase.from as jest.Mock;
const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockOnAuthStateChange = supabase.auth.onAuthStateChange as jest.Mock;

// Helper to set up authenticated state
function setupAuthenticatedSession() {
  mockGetSession.mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });

  mockOnAuthStateChange.mockImplementation((callback) => {
    setTimeout(() => callback('SIGNED_IN', mockSession), 0);
    return {
      data: {
        subscription: { unsubscribe: jest.fn() },
      },
    };
  });
}

// Helper to set up unauthenticated state
function setupUnauthenticatedSession() {
  mockGetSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  mockOnAuthStateChange.mockReturnValue({
    data: {
      subscription: { unsubscribe: jest.fn() },
    },
  });
}

describe('useIdentityClaims', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when user is authenticated', () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it('fetches and groups claims by type', async () => {
      const mockClaimsData = [
        {
          id: 'claim-1',
          type: 'skill',
          label: 'TypeScript',
          description: 'Strong proficiency',
          confidence: 0.95,
          claim_evidence: [
            {
              evidence: {
                id: 'ev-1',
                text: 'Used TypeScript for 5 years',
                evidence_type: 'work',
                source_type: 'resume',
                evidence_date: '2023-01-01',
              },
            },
          ],
        },
        {
          id: 'claim-2',
          type: 'achievement',
          label: 'Product Launch',
          description: 'Led successful launch',
          confidence: 0.85,
          claim_evidence: [],
        },
      ];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => {
          return Promise.resolve({ data: mockClaimsData, error: null }).then(resolve);
        },
      });

      const { result } = renderHook(() => useIdentityClaims());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.skill).toHaveLength(1);
      expect(result.current.data?.skill[0].label).toBe('TypeScript');
      expect(result.current.data?.achievement).toHaveLength(1);
      expect(result.current.data?.attribute).toHaveLength(0);
    });

    it('extracts evidence from nested claim_evidence structure', async () => {
      const mockClaimsData = [
        {
          id: 'claim-1',
          type: 'skill',
          label: 'React',
          description: null,
          confidence: 0.90,
          claim_evidence: [
            {
              evidence: {
                id: 'ev-1',
                text: 'Built React apps',
                evidence_type: 'work',
                source_type: 'story',
                evidence_date: '2023-06-15',
              },
            },
            {
              evidence: {
                id: 'ev-2',
                text: 'React Native experience',
                evidence_type: 'work',
                source_type: 'resume',
                evidence_date: null,
              },
            },
          ],
        },
      ];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => {
          return Promise.resolve({ data: mockClaimsData, error: null }).then(resolve);
        },
      });

      const { result } = renderHook(() => useIdentityClaims());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const skillClaim = result.current.data?.skill[0];
      expect(skillClaim?.evidence).toHaveLength(2);
      expect(skillClaim?.evidence[0].text).toBe('Built React apps');
    });

    it('handles empty claims', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => {
          return Promise.resolve({ data: [], error: null }).then(resolve);
        },
      });

      const { result } = renderHook(() => useIdentityClaims());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.skill).toHaveLength(0);
      expect(result.current.data?.achievement).toHaveLength(0);
      expect(result.current.data?.attribute).toHaveLength(0);
      expect(result.current.data?.education).toHaveLength(0);
      expect(result.current.data?.certification).toHaveLength(0);
    });

    it('handles null claim_evidence gracefully', async () => {
      const mockClaimsData = [
        {
          id: 'claim-1',
          type: 'skill',
          label: 'Python',
          description: null,
          confidence: 0.80,
          claim_evidence: null,
        },
      ];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => {
          return Promise.resolve({ data: mockClaimsData, error: null }).then(resolve);
        },
      });

      const { result } = renderHook(() => useIdentityClaims());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.skill[0].evidence).toHaveLength(0);
    });
  });

  describe('when user is not authenticated', () => {
    beforeEach(() => {
      setupUnauthenticatedSession();
    });

    it('does not fetch claims when not authenticated', async () => {
      const { result } = renderHook(() => useIdentityClaims());

      await waitFor(() => {
        expect(result.current.fetchStatus).toBe('idle');
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it('handles database error from supabase response', async () => {
      // Supabase returns errors in the response, not as promise rejections
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: (value: unknown) => void) => {
          // Return error in the Supabase response format
          return Promise.resolve({ data: null, error: { message: 'Database error' } }).then(resolve);
        },
      });

      const { result } = renderHook(() => useIdentityClaims());

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });
});

describe('helper functions', () => {
  describe('hasAnyClaims', () => {
    it('returns true when there are claims', () => {
      expect(hasAnyClaims(mockGroupedClaims)).toBe(true);
    });

    it('returns false when all claim arrays are empty', () => {
      expect(hasAnyClaims(mockEmptyGroupedClaims)).toBe(false);
    });

    it('returns false for undefined input', () => {
      expect(hasAnyClaims(undefined)).toBe(false);
    });
  });

  describe('getTotalClaimCount', () => {
    it('returns correct count of all claims', () => {
      // mockGroupedClaims has 2 skills, 1 achievement, 1 attribute = 4 total
      expect(getTotalClaimCount(mockGroupedClaims)).toBe(4);
    });

    it('returns 0 for empty claims', () => {
      expect(getTotalClaimCount(mockEmptyGroupedClaims)).toBe(0);
    });

    it('returns 0 for undefined input', () => {
      expect(getTotalClaimCount(undefined)).toBe(0);
    });
  });
});
