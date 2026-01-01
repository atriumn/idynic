import { describe, it, expect } from 'vitest'
import { detectUrlType, type UrlType } from '@/lib/utils/url-detection'

describe('detectUrlType', () => {
  describe('LinkedIn URLs', () => {
    it('detects LinkedIn job URLs', () => {
      expect(detectUrlType('https://www.linkedin.com/jobs/view/123')).toBe('linkedin')
    })

    it('detects LinkedIn profile URLs', () => {
      expect(detectUrlType('https://linkedin.com/in/johndoe')).toBe('linkedin')
    })

    it('detects LinkedIn company URLs', () => {
      expect(detectUrlType('https://www.linkedin.com/company/acme-corp')).toBe('linkedin')
    })

    it('detects LinkedIn without www', () => {
      expect(detectUrlType('https://linkedin.com/jobs/view/456')).toBe('linkedin')
    })

    it('handles LinkedIn with various subdomains', () => {
      expect(detectUrlType('https://uk.linkedin.com/jobs/view/789')).toBe('linkedin')
      expect(detectUrlType('https://www.linkedin.com/learning/something')).toBe('linkedin')
    })

    it('handles LinkedIn with query params', () => {
      expect(detectUrlType('https://www.linkedin.com/jobs/view/123?refId=abc&trk=xyz')).toBe('linkedin')
    })
  })

  describe('Glassdoor URLs', () => {
    it('detects Glassdoor job listing URLs', () => {
      expect(detectUrlType('https://www.glassdoor.com/job-listing/123')).toBe('glassdoor')
    })

    it('detects Glassdoor company pages', () => {
      expect(detectUrlType('https://www.glassdoor.com/Reviews/Acme-Reviews-E12345.htm')).toBe('glassdoor')
    })

    it('handles Glassdoor without www', () => {
      expect(detectUrlType('https://glassdoor.com/job-listing/software-engineer')).toBe('glassdoor')
    })

    it('handles regional Glassdoor domains', () => {
      expect(detectUrlType('https://www.glassdoor.co.uk/job/123')).toBe('link') // co.uk doesn't match .com
      expect(detectUrlType('https://www.glassdoor.com.au/job/123')).toBe('glassdoor')
    })
  })

  describe('Indeed URLs', () => {
    it('detects Indeed viewjob URLs', () => {
      expect(detectUrlType('https://www.indeed.com/viewjob?jk=abc123')).toBe('indeed')
    })

    it('handles Indeed job search URLs', () => {
      expect(detectUrlType('https://indeed.com/jobs?q=engineer')).toBe('indeed')
    })

    it('handles regional Indeed domains', () => {
      expect(detectUrlType('https://uk.indeed.com/viewjob?jk=xyz')).toBe('indeed')
      expect(detectUrlType('https://de.indeed.com/Stellenangebote')).toBe('indeed')
    })

    it('handles Indeed company URLs', () => {
      expect(detectUrlType('https://www.indeed.com/cmp/Acme-Corp')).toBe('indeed')
    })
  })

  describe('Greenhouse URLs', () => {
    it('detects boards.greenhouse.io URLs', () => {
      expect(detectUrlType('https://boards.greenhouse.io/company/jobs/123')).toBe('greenhouse')
    })

    it('detects jobs.greenhouse.io URLs', () => {
      expect(detectUrlType('https://jobs.greenhouse.io/company/jobs/456')).toBe('greenhouse')
    })

    it('handles Greenhouse with query params', () => {
      expect(detectUrlType('https://boards.greenhouse.io/acme/jobs/789?gh_jid=789')).toBe('greenhouse')
    })

    it('detects main greenhouse.io domain', () => {
      expect(detectUrlType('https://greenhouse.io/company/jobs/123')).toBe('greenhouse')
    })
  })

  describe('Lever URLs', () => {
    it('detects jobs.lever.co URLs', () => {
      expect(detectUrlType('https://jobs.lever.co/company/123')).toBe('lever')
    })

    it('detects main lever.co domain', () => {
      expect(detectUrlType('https://lever.co/company/456')).toBe('lever')
    })

    it('handles Lever with UUID job IDs', () => {
      expect(detectUrlType('https://jobs.lever.co/acme/a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe('lever')
    })

    it('handles Lever with query params', () => {
      expect(detectUrlType('https://jobs.lever.co/company/123?lever-origin=applied')).toBe('lever')
    })
  })

  describe('Workday URLs', () => {
    it('detects myworkdayjobs.com URLs', () => {
      expect(detectUrlType('https://company.myworkdayjobs.com/en-US/careers/job/123')).toBe('workday')
    })

    it('detects workday.com URLs', () => {
      expect(detectUrlType('https://acme.workday.com/careers/job/456')).toBe('workday')
    })

    it('handles Workday with complex paths', () => {
      expect(detectUrlType('https://company.myworkdayjobs.com/en-US/External/job/New-York/Software-Engineer_JR-12345')).toBe('workday')
    })

    it('handles Workday subdomains', () => {
      expect(detectUrlType('https://wd1.myworkdayjobs.com/company/jobs')).toBe('workday')
    })
  })

  describe('Generic careers subdomains', () => {
    it('detects careers. subdomain', () => {
      expect(detectUrlType('https://careers.acme.com/jobs/123')).toBe('careers')
      expect(detectUrlType('https://careers.startup.io/openings')).toBe('careers')
    })

    it('detects jobs. subdomain', () => {
      expect(detectUrlType('https://jobs.startup.io/apply')).toBe('careers')
      expect(detectUrlType('https://jobs.bigcorp.com/posting/456')).toBe('careers')
    })

    it('prioritizes specific platforms over careers subdomain', () => {
      // jobs.lever.co has jobs. prefix but should be detected as lever
      expect(detectUrlType('https://jobs.lever.co/company/123')).toBe('lever')
      // jobs.greenhouse.io has jobs. prefix but should be detected as greenhouse
      expect(detectUrlType('https://jobs.greenhouse.io/company/jobs/456')).toBe('greenhouse')
    })

    it('handles careers with different TLDs', () => {
      expect(detectUrlType('https://careers.company.co.uk/jobs')).toBe('careers')
      expect(detectUrlType('https://jobs.startup.io/apply')).toBe('careers')
    })
  })

  describe('Generic links', () => {
    it('returns link for unknown URLs', () => {
      expect(detectUrlType('https://example.com/something')).toBe('link')
    })

    it('returns link for blog URLs', () => {
      expect(detectUrlType('https://blog.medium.com/article')).toBe('link')
    })

    it('returns link for news sites', () => {
      expect(detectUrlType('https://techcrunch.com/2024/01/01/company-announces-layoffs')).toBe('link')
    })

    it('returns link for social media (non-LinkedIn)', () => {
      expect(detectUrlType('https://twitter.com/company/status/123')).toBe('link')
      expect(detectUrlType('https://facebook.com/company/jobs')).toBe('link')
    })

    it('returns link for company websites without careers prefix', () => {
      expect(detectUrlType('https://www.acme.com/about-us')).toBe('link')
      expect(detectUrlType('https://startup.io/team')).toBe('link')
    })
  })

  describe('edge cases', () => {
    it('handles invalid URLs gracefully', () => {
      expect(detectUrlType('not a url')).toBe('link')
    })

    it('handles empty string', () => {
      expect(detectUrlType('')).toBe('link')
    })

    it('handles whitespace-only string', () => {
      expect(detectUrlType('   ')).toBe('link')
    })

    it('handles relative URLs', () => {
      expect(detectUrlType('/jobs/view/123')).toBe('link')
    })

    it('handles URLs with unusual protocols', () => {
      expect(detectUrlType('ftp://linkedin.com/something')).toBe('linkedin')
    })

    it('handles uppercase hostnames', () => {
      expect(detectUrlType('https://WWW.LINKEDIN.COM/jobs/view/123')).toBe('linkedin')
      expect(detectUrlType('https://BOARDS.GREENHOUSE.IO/company/jobs/456')).toBe('greenhouse')
    })

    it('handles mixed case hostnames', () => {
      expect(detectUrlType('https://www.LinkedIn.com/jobs/view/123')).toBe('linkedin')
    })

    it('handles URLs with port numbers', () => {
      expect(detectUrlType('https://www.linkedin.com:443/jobs/view/123')).toBe('linkedin')
      expect(detectUrlType('https://careers.example.com:8080/jobs')).toBe('careers')
    })

    it('handles URLs with authentication', () => {
      expect(detectUrlType('https://user:pass@www.linkedin.com/jobs/view/123')).toBe('linkedin')
    })

    it('handles URLs with fragments', () => {
      expect(detectUrlType('https://www.linkedin.com/jobs/view/123#apply')).toBe('linkedin')
    })

    it('handles URLs with encoded characters', () => {
      expect(detectUrlType('https://www.indeed.com/viewjob?q=software%20engineer')).toBe('indeed')
    })
  })

  describe('return type coverage', () => {
    it('returns all possible UrlType values', () => {
      const allTypes: UrlType[] = ['linkedin', 'glassdoor', 'indeed', 'greenhouse', 'lever', 'workday', 'careers', 'link']

      const testCases: [string, UrlType][] = [
        ['https://www.linkedin.com/jobs', 'linkedin'],
        ['https://www.glassdoor.com/job', 'glassdoor'],
        ['https://www.indeed.com/viewjob', 'indeed'],
        ['https://boards.greenhouse.io/company/jobs/1', 'greenhouse'],
        ['https://jobs.lever.co/company/1', 'lever'],
        ['https://acme.myworkdayjobs.com/jobs', 'workday'],
        ['https://careers.acme.com/jobs', 'careers'],
        ['https://example.com', 'link'],
      ]

      for (const [url, expectedType] of testCases) {
        expect(detectUrlType(url)).toBe(expectedType)
      }

      // Verify we tested all types
      const testedTypes = testCases.map(([, type]) => type)
      expect(new Set(testedTypes)).toEqual(new Set(allTypes))
    })
  })
})
