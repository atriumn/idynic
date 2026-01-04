import { renderHook, waitFor } from "@testing-library/react-native";
import { useBetaAccess } from "../../lib/use-beta-access";
import { supabase } from "../../lib/supabase";
import { createWrapper } from "../test-utils";
import { mockSession, mockUser } from "../mocks/api-responses";

// Mock supabase
jest.mock("../../lib/supabase", () => ({
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

function setupAuthenticatedSession() {
  mockGetSession.mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });
  mockOnAuthStateChange.mockImplementation((callback) => {
    callback("SIGNED_IN", mockSession);
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

describe("useBetaAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns hasAccess true when user has beta code", async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(
      createMockQueryBuilder({ beta_code_used: "BETA123" }),
    );

    const { result } = renderHook(() => useBetaAccess(), {
      wrapper: createWrapper(),
    });

    // Wait for both loading to finish AND hasAccess to be set
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.hasAccess).toBe(true);
    });
  });

  it("returns hasAccess false when no beta code", async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(createMockQueryBuilder({ beta_code_used: null }));

    const { result } = renderHook(() => useBetaAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
  });

  it("returns hasAccess false when not authenticated", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useBetaAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
  });

  it("handles database errors gracefully", async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(
      createMockQueryBuilder(null, { message: "Database error" }),
    );

    const { result } = renderHook(() => useBetaAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
  });

  it("provides refetch function", async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(
      createMockQueryBuilder({ beta_code_used: "BETA123" }),
    );

    const { result } = renderHook(() => useBetaAccess(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(typeof result.current.refetch).toBe("function");
  });
});
