import { describe, it, expect } from 'vitest'
import { apiSuccess, apiError, ApiErrors } from '@/lib/api/response'

describe('api/response', () => {
  describe('apiSuccess', () => {
    it('returns data in response body', async () => {
      const data = { foo: 'bar', count: 42 }
      const response = apiSuccess(data)

      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.data).toEqual(data)
    })

    it('includes request_id in meta', async () => {
      const response = apiSuccess({ test: true })
      const body = await response.json()

      expect(body.meta).toBeDefined()
      expect(body.meta.request_id).toBeDefined()
      expect(typeof body.meta.request_id).toBe('string')
    })

    it('includes count when provided', async () => {
      const response = apiSuccess([1, 2, 3], { count: 3 })
      const body = await response.json()

      expect(body.meta.count).toBe(3)
    })

    it('includes has_more when provided', async () => {
      const response = apiSuccess([], { has_more: true })
      const body = await response.json()

      expect(body.meta.has_more).toBe(true)
    })

    it('omits count when not provided', async () => {
      const response = apiSuccess({})
      const body = await response.json()

      expect(body.meta.count).toBeUndefined()
    })

    it('omits has_more when not provided', async () => {
      const response = apiSuccess({})
      const body = await response.json()

      expect(body.meta.has_more).toBeUndefined()
    })

    it('handles null data', async () => {
      const response = apiSuccess(null)
      const body = await response.json()

      expect(body.data).toBeNull()
    })

    it('handles array data', async () => {
      const data = [{ id: 1 }, { id: 2 }]
      const response = apiSuccess(data, { count: 2 })
      const body = await response.json()

      expect(body.data).toEqual(data)
      expect(body.meta.count).toBe(2)
    })
  })

  describe('apiError', () => {
    it('returns error with code and message', async () => {
      const response = apiError('test_error', 'Test error message')
      const body = await response.json()

      expect(body.error.code).toBe('test_error')
      expect(body.error.message).toBe('Test error message')
    })

    it('includes request_id in error', async () => {
      const response = apiError('error', 'msg')
      const body = await response.json()

      expect(body.error.request_id).toBeDefined()
    })

    it('defaults to 400 status', async () => {
      const response = apiError('bad_request', 'Bad request')

      expect(response.status).toBe(400)
    })

    it('uses provided status code', async () => {
      const response = apiError('not_found', 'Not found', 404)

      expect(response.status).toBe(404)
    })

    it('includes custom headers', async () => {
      const response = apiError('rate_limited', 'Too many requests', 429, {
        'Retry-After': '30',
        'X-Custom': 'value'
      })

      expect(response.headers.get('Retry-After')).toBe('30')
      expect(response.headers.get('X-Custom')).toBe('value')
    })

    it('works without custom headers', async () => {
      const response = apiError('error', 'msg', 500)

      expect(response.status).toBe(500)
    })
  })

  describe('ApiErrors', () => {
    describe('notFound', () => {
      it('returns 404 status', async () => {
        const response = ApiErrors.notFound('User')

        expect(response.status).toBe(404)
      })

      it('includes resource in message', async () => {
        const response = ApiErrors.notFound('Opportunity')
        const body = await response.json()

        expect(body.error.message).toContain('Opportunity')
        expect(body.error.message).toContain('not found')
      })

      it('uses not_found error code', async () => {
        const response = ApiErrors.notFound('Profile')
        const body = await response.json()

        expect(body.error.code).toBe('not_found')
      })
    })

    describe('validationError', () => {
      it('returns 400 status', async () => {
        const response = ApiErrors.validationError('Invalid input')

        expect(response.status).toBe(400)
      })

      it('uses provided message', async () => {
        const response = ApiErrors.validationError('Email is required')
        const body = await response.json()

        expect(body.error.message).toBe('Email is required')
      })

      it('uses validation_error code', async () => {
        const response = ApiErrors.validationError('test')
        const body = await response.json()

        expect(body.error.code).toBe('validation_error')
      })
    })

    describe('serverError', () => {
      it('returns 500 status', async () => {
        const response = ApiErrors.serverError()

        expect(response.status).toBe(500)
      })

      it('uses default message when not provided', async () => {
        const response = ApiErrors.serverError()
        const body = await response.json()

        expect(body.error.message).toContain('unexpected error')
      })

      it('uses provided message', async () => {
        const response = ApiErrors.serverError('Database connection failed')
        const body = await response.json()

        expect(body.error.message).toBe('Database connection failed')
      })

      it('uses server_error code', async () => {
        const response = ApiErrors.serverError()
        const body = await response.json()

        expect(body.error.code).toBe('server_error')
      })
    })
  })
})
