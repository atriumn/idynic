import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimit, API_RATE_LIMITS, RateLimitConfig } from '@/lib/api/rate-limit'

describe('rate-limit', () => {
  // Use unique keys per test to avoid state leakage
  let testKeyCounter = 0
  const getUniqueKey = () => `test-user-${++testKeyCounter}-${Date.now()}`

  describe('checkRateLimit', () => {
    it('allows first request', () => {
      const key = getUniqueKey()
      const config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }

      const result = checkRateLimit(key, config)

      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(9)
    })

    it('decrements remaining count on each request', () => {
      const key = getUniqueKey()
      const config: RateLimitConfig = { windowMs: 60000, maxRequests: 5 }

      const r1 = checkRateLimit(key, config)
      expect(r1.remaining).toBe(4)

      const r2 = checkRateLimit(key, config)
      expect(r2.remaining).toBe(3)

      const r3 = checkRateLimit(key, config)
      expect(r3.remaining).toBe(2)
    })

    it('blocks requests when limit exceeded', () => {
      const key = getUniqueKey()
      const config: RateLimitConfig = { windowMs: 60000, maxRequests: 3 }

      // Use up all requests
      checkRateLimit(key, config) // 1
      checkRateLimit(key, config) // 2
      checkRateLimit(key, config) // 3

      // Next should be blocked
      const result = checkRateLimit(key, config)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('returns resetAt timestamp', () => {
      const key = getUniqueKey()
      const config: RateLimitConfig = { windowMs: 60000, maxRequests: 10 }
      const before = Date.now()

      const result = checkRateLimit(key, config)

      expect(result.resetAt).toBeGreaterThanOrEqual(before + config.windowMs - 100)
      expect(result.resetAt).toBeLessThanOrEqual(Date.now() + config.windowMs + 100)
    })

    it('tracks different keys independently', () => {
      const key1 = getUniqueKey()
      const key2 = getUniqueKey()
      const config: RateLimitConfig = { windowMs: 60000, maxRequests: 2 }

      // Exhaust key1
      checkRateLimit(key1, config)
      checkRateLimit(key1, config)
      const r1 = checkRateLimit(key1, config)
      expect(r1.allowed).toBe(false)

      // key2 should still be allowed
      const r2 = checkRateLimit(key2, config)
      expect(r2.allowed).toBe(true)
    })

    it('allows single request when maxRequests is 1', () => {
      const key = getUniqueKey()
      const config: RateLimitConfig = { windowMs: 60000, maxRequests: 1 }

      const r1 = checkRateLimit(key, config)
      expect(r1.allowed).toBe(true)
      expect(r1.remaining).toBe(0)

      const r2 = checkRateLimit(key, config)
      expect(r2.allowed).toBe(false)
    })
  })

  describe('API_RATE_LIMITS', () => {
    it('has api limit configured', () => {
      expect(API_RATE_LIMITS.api).toBeDefined()
      expect(API_RATE_LIMITS.api.windowMs).toBe(60000)
      expect(API_RATE_LIMITS.api.maxRequests).toBe(60)
    })

    it('has ai limit configured (stricter)', () => {
      expect(API_RATE_LIMITS.ai).toBeDefined()
      expect(API_RATE_LIMITS.ai.windowMs).toBe(60000)
      expect(API_RATE_LIMITS.ai.maxRequests).toBe(10)
      expect(API_RATE_LIMITS.ai.maxRequests).toBeLessThan(API_RATE_LIMITS.api.maxRequests)
    })

    it('has public limit configured', () => {
      expect(API_RATE_LIMITS.public).toBeDefined()
      expect(API_RATE_LIMITS.public.windowMs).toBe(60000)
      expect(API_RATE_LIMITS.public.maxRequests).toBe(30)
    })
  })
})
