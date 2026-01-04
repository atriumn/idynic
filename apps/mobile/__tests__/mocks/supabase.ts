import { mockSession } from "./api-responses";

// Type for the mock chain builder
interface MockQueryBuilder {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  upsert: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  or: jest.Mock;
  order: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  limit: jest.Mock;
  range: jest.Mock;
}

// Create a chainable mock query builder
export function createMockQueryBuilder(
  resolvedValue: { data: unknown; error: unknown } = {
    data: null,
    error: null,
  },
): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
    maybeSingle: jest.fn().mockResolvedValue(resolvedValue),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
  };

  // Make the builder itself a thenable that resolves to the data
  Object.assign(builder, {
    then: (resolve: (value: unknown) => void) =>
      Promise.resolve(resolvedValue).then(resolve),
  });

  return builder;
}

// Create mock supabase client with default mocks
export function createMockSupabaseClient(
  overrides: {
    getSession?: jest.Mock;
    onAuthStateChange?: jest.Mock;
    signOut?: jest.Mock;
    from?: jest.Mock;
    rpc?: jest.Mock;
  } = {},
) {
  const defaultGetSession = jest.fn().mockResolvedValue({
    data: { session: mockSession },
    error: null,
  });

  const defaultOnAuthStateChange = jest.fn().mockReturnValue({
    data: {
      subscription: { unsubscribe: jest.fn() },
    },
  });

  const defaultSignOut = jest.fn().mockResolvedValue({ error: null });

  const defaultFrom = jest.fn().mockReturnValue(createMockQueryBuilder());

  const defaultRpc = jest.fn().mockResolvedValue({ data: null, error: null });

  return {
    auth: {
      getSession: overrides.getSession ?? defaultGetSession,
      onAuthStateChange:
        overrides.onAuthStateChange ?? defaultOnAuthStateChange,
      signOut: overrides.signOut ?? defaultSignOut,
      signInWithOtp: jest.fn(),
      verifyOtp: jest.fn(),
      setSession: jest.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: overrides.from ?? defaultFrom,
    rpc: overrides.rpc ?? defaultRpc,
  };
}

// Helper to set up supabase mock for a specific test
export function setupSupabaseMock(
  mockClient: ReturnType<typeof createMockSupabaseClient>,
) {
  jest.mock("../../lib/supabase", () => ({
    supabase: mockClient,
    markSessionInvalid: jest.fn(),
  }));
}

// Helper to create mock for profile queries
export function createProfileQueryMock(profileData: Record<string, unknown>) {
  const mockBuilder = createMockQueryBuilder({
    data: profileData,
    error: null,
  });

  return jest.fn().mockImplementation((table: string) => {
    if (table === "profiles") {
      return mockBuilder;
    }
    // Default empty array for other tables (work_history, identity_claims, evidence)
    return createMockQueryBuilder({ data: [], error: null });
  });
}

// Helper to create mock that returns different data per table
export function createMultiTableMock(
  tableData: Record<string, { data: unknown; error: unknown }>,
) {
  return jest.fn().mockImplementation((table: string) => {
    const response = tableData[table] ?? { data: null, error: null };
    return createMockQueryBuilder(response);
  });
}

// Mock auth state with session
export const mockAuthWithSession = {
  getSession: jest.fn().mockResolvedValue({
    data: { session: mockSession },
    error: null,
  }),
  onAuthStateChange: jest.fn(
    (callback: (event: string, session: unknown) => void) => {
      // Immediately call with current session
      callback("SIGNED_IN", mockSession);
      return {
        data: {
          subscription: { unsubscribe: jest.fn() },
        },
      };
    },
  ),
};

// Mock auth state without session
export const mockAuthWithoutSession = {
  getSession: jest.fn().mockResolvedValue({
    data: { session: null },
    error: null,
  }),
  onAuthStateChange: jest.fn(() => ({
    data: {
      subscription: { unsubscribe: jest.fn() },
    },
  })),
};

// Mock auth error
export const mockAuthError = {
  getSession: jest.fn().mockResolvedValue({
    data: { session: null },
    error: { message: "Auth error", code: "auth_error" },
  }),
};
