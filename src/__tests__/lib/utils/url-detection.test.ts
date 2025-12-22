import { describe, it, expect } from 'vitest'
import { detectUrlType } from '@/lib/utils/url-detection'

describe('detectUrlType', () => {
  it('detects LinkedIn URLs', () => {
    expect(detectUrlType('https://www.linkedin.com/jobs/view/123')).toBe('linkedin')
    expect(detectUrlType('https://linkedin.com/in/johndoe')).toBe('linkedin')
  })

  it('detects Glassdoor URLs', () => {
    expect(detectUrlType('https://www.glassdoor.com/job-listing/123')).toBe('glassdoor')
  })

  it('detects Indeed URLs', () => {
    expect(detectUrlType('https://www.indeed.com/viewjob?jk=abc123')).toBe('indeed')
  })

  it('detects Greenhouse URLs', () => {
    expect(detectUrlType('https://boards.greenhouse.io/company/jobs/123')).toBe('greenhouse')
  })

  it('detects Lever URLs', () => {
    expect(detectUrlType('https://jobs.lever.co/company/123')).toBe('lever')
  })

  it('detects Workday URLs', () => {
    expect(detectUrlType('https://company.myworkdayjobs.com/en-US/careers/job/123')).toBe('workday')
  })

  it('detects generic careers subdomains', () => {
    expect(detectUrlType('https://careers.acme.com/jobs/123')).toBe('careers')
    expect(detectUrlType('https://jobs.startup.io/apply')).toBe('careers')
  })

  it('returns link for unknown URLs', () => {
    expect(detectUrlType('https://example.com/something')).toBe('link')
    expect(detectUrlType('https://blog.medium.com/article')).toBe('link')
  })

  it('handles invalid URLs gracefully', () => {
    expect(detectUrlType('not a url')).toBe('link')
    expect(detectUrlType('')).toBe('link')
  })
})
