import { waitFor } from "@testing-library/react-native";
import { renderHook } from "../test-utils";
import { useProfile } from "../../hooks/use-profile";
import { supabase } from "../../lib/supabase";
import { mockSession, mockProfile } from "../mocks/api-responses";

// Mock expo-linking
jest.mock("expo-linking", () => ({
  getInitialURL: jest.fn(() => Promise.resolve(null)),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// Mock supabase
jest.mock("../../lib/supabase", () => ({
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
    // Trigger callback with session immediately
    setTimeout(() => callback("SIGNED_IN", mockSession), 0);
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

describe("useProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("when user is authenticated", () => {
    beforeEach(() => {
      setupAuthenticatedSession();

      // Mock successful profile fetch
      const mockProfileData = {
        name: mockProfile.contact.name,
        email: mockProfile.contact.email,
        phone: mockProfile.contact.phone,
        location: mockProfile.contact.location,
        linkedin: mockProfile.contact.linkedin,
        github: mockProfile.contact.github,
        website: mockProfile.contact.website,
        logo_url: mockProfile.contact.logo_url,
        identity_headline: mockProfile.identity?.headline,
        identity_bio: mockProfile.identity?.bio,
        identity_archetype: mockProfile.identity?.archetype,
        identity_keywords: mockProfile.identity?.keywords,
        identity_matches: mockProfile.identity?.matches,
        identity_generated_at: mockProfile.identity?.generated_at,
      };

      mockFrom.mockImplementation((table: string) => {
        const builder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: table === "profiles" ? mockProfileData : null,
            error: null,
          }),
          then: (resolve: (value: unknown) => void) => {
            if (table === "profiles") {
              return Promise.resolve({
                data: mockProfileData,
                error: null,
              }).then(resolve);
            }
            return Promise.resolve({
              data: mockProfile.workHistory,
              error: null,
            }).then(resolve);
          },
        };
        return builder;
      });
    });

    it("fetches profile data successfully", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.contact.name).toBe(mockProfile.contact.name);
    });

    it("queries all profile-related tables", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockFrom).toHaveBeenCalledWith("profiles");
      expect(mockFrom).toHaveBeenCalledWith("work_history");
      expect(mockFrom).toHaveBeenCalledWith("identity_claims");
      expect(mockFrom).toHaveBeenCalledWith("evidence");
    });

    it("handles profile with no identity reflection", async () => {
      const mockProfileNoIdentity = {
        name: "Test User",
        email: "test@example.com",
        phone: null,
        location: null,
        linkedin: null,
        github: null,
        website: null,
        logo_url: null,
        identity_headline: null,
        identity_bio: null,
        identity_archetype: null,
        identity_keywords: null,
        identity_matches: null,
        identity_generated_at: null,
      };

      mockFrom.mockImplementation((table: string) => {
        const builder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: table === "profiles" ? mockProfileNoIdentity : null,
            error: null,
          }),
          then: (resolve: (value: unknown) => void) => {
            return Promise.resolve({ data: [], error: null }).then(resolve);
          },
        };
        return builder;
      });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data?.identity).toBeNull();
    });
  });

  describe("when user is not authenticated", () => {
    beforeEach(() => {
      setupUnauthenticatedSession();
    });

    it("does not fetch profile when not authenticated", async () => {
      const { result } = renderHook(() => useProfile());

      // Wait for auth to settle
      await waitFor(() => {
        expect(result.current.fetchStatus).toBe("idle");
      });

      expect(mockFrom).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("handles database error", async () => {
      mockFrom.mockImplementation(() => {
        const builder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error", code: "PGRST116" },
          }),
          then: (resolve: (value: unknown) => void) => {
            return Promise.resolve({
              data: null,
              error: { message: "Database error" },
            }).then(resolve);
          },
        };
        return builder;
      });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe("refetch behavior", () => {
    beforeEach(() => {
      setupAuthenticatedSession();
    });

    it("can refetch profile data", async () => {
      mockFrom.mockImplementation((table: string) => {
        const builder = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: {
              name: "Test",
              email: "test@example.com",
              identity_generated_at: null,
            },
            error: null,
          }),
          then: (resolve: (value: unknown) => void) => {
            return Promise.resolve({ data: [], error: null }).then(resolve);
          },
        };
        return builder;
      });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const initialCallCount = mockFrom.mock.calls.length;

      // Trigger refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockFrom.mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });
  });
});
