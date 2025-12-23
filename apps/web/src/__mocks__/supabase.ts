import { vi } from 'vitest'

export function createMockSupabaseClient() {
  let mockData: unknown = null
  let mockError: Error | null = null
  let mockCount: number | null = null

  const chainableMock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: mockData, error: mockError })
    ),
    maybeSingle: vi.fn().mockImplementation(() =>
      Promise.resolve({ data: mockData, error: mockError })
    ),
    then: vi.fn().mockImplementation((resolve) =>
      resolve({ data: mockData, error: mockError, count: mockCount })
    ),

    // Test helpers
    __setMockData: (data: unknown) => { mockData = data },
    __setMockError: (error: Error | null) => { mockError = error },
    __setMockCount: (count: number | null) => { mockCount = count },
    __reset: () => {
      mockData = null
      mockError = null
      mockCount = null
      Object.values(chainableMock).forEach(fn => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as ReturnType<typeof vi.fn>).mockClear()
        }
      })
    }
  }

  const auth = {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  }

  const storage = {
    from: vi.fn().mockReturnValue({
      upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://mock.url' } })
    })
  }

  const rpc = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: mockData, error: mockError })
  )

  return {
    ...chainableMock,
    auth,
    storage,
    rpc,
    __setMockData: chainableMock.__setMockData,
    __setMockError: chainableMock.__setMockError,
    __setMockCount: chainableMock.__setMockCount,
    __reset: chainableMock.__reset
  }
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
