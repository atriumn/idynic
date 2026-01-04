import { renderHook, waitFor } from "@testing-library/react-native";
import {
  useOpportunities,
  getRequirements,
} from "../../hooks/use-opportunities";
import { supabase } from "../../lib/supabase";
import { createWrapper } from "../test-utils";
import { mockSession, mockOpportunities } from "../mocks/api-responses";

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
    order: jest.fn().mockResolvedValue({ data, error }),
  };
}

describe("useOpportunities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("fetches opportunities when authenticated", async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(createMockQueryBuilder(mockOpportunities));

    const { result } = renderHook(() => useOpportunities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockOpportunities);
    expect(mockFrom).toHaveBeenCalledWith("opportunities");
  });

  it("is disabled when not authenticated", async () => {
    mockGetSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mockOnAuthStateChange.mockImplementation((callback) => {
      callback("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });

    const { result } = renderHook(() => useOpportunities(), {
      wrapper: createWrapper(),
    });

    // Query should not run
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("handles errors", async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(
      createMockQueryBuilder(null, { message: "Database error" }),
    );

    const { result } = renderHook(() => useOpportunities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("returns empty array when no opportunities", async () => {
    setupAuthenticatedSession();
    mockFrom.mockReturnValue(createMockQueryBuilder(null));

    const { result } = renderHook(() => useOpportunities(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});

describe("getRequirements", () => {
  it("returns null for null input", () => {
    expect(getRequirements(null)).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(getRequirements("string")).toBeNull();
    expect(getRequirements(123)).toBeNull();
    expect(getRequirements(undefined)).toBeNull();
  });

  it("extracts mustHave and niceToHave arrays of strings", () => {
    const requirements = {
      mustHave: ["React", "TypeScript"],
      niceToHave: ["GraphQL", "AWS"],
    };

    expect(getRequirements(requirements)).toEqual({
      mustHave: ["React", "TypeScript"],
      niceToHave: ["GraphQL", "AWS"],
    });
  });

  it("extracts text from object items", () => {
    const requirements = {
      mustHave: [
        { text: "React", type: "skill" },
        { text: "TypeScript", type: "skill" },
      ],
      niceToHave: [{ text: "GraphQL" }],
    };

    expect(getRequirements(requirements)).toEqual({
      mustHave: ["React", "TypeScript"],
      niceToHave: ["GraphQL"],
    });
  });

  it("handles mixed string and object items", () => {
    const requirements = {
      mustHave: ["React", { text: "TypeScript" }],
    };

    expect(getRequirements(requirements)).toEqual({
      mustHave: ["React", "TypeScript"],
      niceToHave: undefined,
    });
  });

  it("handles empty requirements object", () => {
    expect(getRequirements({})).toEqual({
      mustHave: undefined,
      niceToHave: undefined,
    });
  });
});
