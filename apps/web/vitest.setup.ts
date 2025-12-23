import '@testing-library/jest-dom/vitest'
import { vi, beforeEach, afterEach } from 'vitest'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn()
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams()
}))

// Mock Next.js headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn()
  }),
  headers: () => new Map()
}))

// Mock crypto.randomUUID for consistent request IDs in tests
beforeEach(() => {
  let callCount = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    callCount++
    return `test-uuid-${callCount}`
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})
