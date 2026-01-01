// src/lib/utils/__tests__/normalize-url.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeJobUrl } from '../normalize-url';

describe('normalizeJobUrl', () => {
  describe('LinkedIn URLs', () => {
    it('extracts job ID from LinkedIn URL', () => {
      const url = 'https://www.linkedin.com/jobs/view/3847291034';
      expect(normalizeJobUrl(url)).toBe('linkedin:3847291034');
    });

    it('strips tracking params from LinkedIn URL', () => {
      const url = 'https://www.linkedin.com/jobs/view/3847291034?refId=abc&trackingId=xyz&trk=jobs_list';
      expect(normalizeJobUrl(url)).toBe('linkedin:3847291034');
    });

    it('handles LinkedIn URLs with trailing slash', () => {
      const url = 'https://linkedin.com/jobs/view/3847291034/';
      expect(normalizeJobUrl(url)).toBe('linkedin:3847291034');
    });

    it('handles LinkedIn URLs without www prefix', () => {
      const url = 'https://linkedin.com/jobs/view/1234567890';
      expect(normalizeJobUrl(url)).toBe('linkedin:1234567890');
    });

    it('returns fallback for LinkedIn URL without job ID pattern', () => {
      const url = 'https://www.linkedin.com/company/acme';
      expect(normalizeJobUrl(url)).toBe('www.linkedin.com/company/acme');
    });

    it('handles LinkedIn job collection URLs', () => {
      const url = 'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3847291034';
      // This doesn't match the /jobs/view/ pattern, so it should return fallback
      expect(normalizeJobUrl(url)).toBe('www.linkedin.com/jobs/collections/recommended');
    });

    it('extracts job ID with long numeric ID', () => {
      const url = 'https://www.linkedin.com/jobs/view/12345678901234567890';
      expect(normalizeJobUrl(url)).toBe('linkedin:12345678901234567890');
    });
  });

  describe('Greenhouse URLs', () => {
    it('extracts company and job ID from Greenhouse URL', () => {
      const url = 'https://boards.greenhouse.io/acme/jobs/4567890';
      expect(normalizeJobUrl(url)).toBe('greenhouse:acme:4567890');
    });

    it('strips query params from Greenhouse URL', () => {
      const url = 'https://boards.greenhouse.io/acme/jobs/4567890?gh_jid=4567890';
      expect(normalizeJobUrl(url)).toBe('greenhouse:acme:4567890');
    });

    it('handles Greenhouse URLs with different subdomain', () => {
      const url = 'https://jobs.greenhouse.io/startup/jobs/7654321';
      expect(normalizeJobUrl(url)).toBe('greenhouse:startup:7654321');
    });

    it('handles company names with hyphens', () => {
      const url = 'https://boards.greenhouse.io/acme-corp/jobs/1234567';
      expect(normalizeJobUrl(url)).toBe('greenhouse:acme-corp:1234567');
    });

    it('handles company names with underscores', () => {
      const url = 'https://boards.greenhouse.io/acme_corp/jobs/1234567';
      expect(normalizeJobUrl(url)).toBe('greenhouse:acme_corp:1234567');
    });

    it('returns fallback for Greenhouse URL without jobs path', () => {
      const url = 'https://boards.greenhouse.io/acme/about';
      expect(normalizeJobUrl(url)).toBe('boards.greenhouse.io/acme/about');
    });
  });

  describe('Lever URLs', () => {
    it('extracts company and job ID from Lever URL', () => {
      const url = 'https://jobs.lever.co/acme/a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(normalizeJobUrl(url)).toBe('lever:acme:a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    it('handles Lever URLs with query params', () => {
      const url = 'https://jobs.lever.co/startup/f1a2b3c4-d5e6-7890-abcd-1234567890ab?lever-origin=applied';
      expect(normalizeJobUrl(url)).toBe('lever:startup:f1a2b3c4-d5e6-7890-abcd-1234567890ab');
    });

    it('handles company names with hyphens', () => {
      const url = 'https://jobs.lever.co/acme-corp/12345678-1234-1234-1234-123456789012';
      expect(normalizeJobUrl(url)).toBe('lever:acme-corp:12345678-1234-1234-1234-123456789012');
    });

    it('handles Lever main domain', () => {
      const url = 'https://lever.co/company/98765432-abcd-ef01-2345-678901234567';
      expect(normalizeJobUrl(url)).toBe('lever:company:98765432-abcd-ef01-2345-678901234567');
    });

    it('returns fallback for Lever URL without valid job ID format', () => {
      const url = 'https://jobs.lever.co/acme';
      expect(normalizeJobUrl(url)).toBe('jobs.lever.co/acme');
    });
  });

  describe('Other URLs', () => {
    it('strips query params and keeps hostname + path', () => {
      const url = 'https://careers.example.com/jobs/senior-engineer?ref=twitter';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/senior-engineer');
    });

    it('handles URLs without query params', () => {
      const url = 'https://jobs.company.com/posting/12345';
      expect(normalizeJobUrl(url)).toBe('jobs.company.com/posting/12345');
    });

    it('strips trailing slash from generic URLs', () => {
      const url = 'https://careers.example.com/jobs/senior-engineer/';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/senior-engineer');
    });

    it('handles URLs with fragments', () => {
      const url = 'https://careers.example.com/jobs/engineer#apply';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/engineer');
    });

    it('handles URLs with port numbers', () => {
      // Note: URL.hostname does not include port, URL.host does
      // The implementation uses hostname, so port is stripped
      const url = 'https://careers.example.com:8080/jobs/engineer';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/engineer');
    });

    it('handles URLs with basic auth (stripped by URL parsing)', () => {
      const url = 'https://user:pass@careers.example.com/jobs/engineer';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/engineer');
    });

    it('handles URLs with encoded characters', () => {
      const url = 'https://careers.example.com/jobs/senior%20engineer';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/senior%20engineer');
    });

    it('handles Workday URLs', () => {
      const url = 'https://acme.myworkdayjobs.com/en-US/External/job/USA/Engineer_JR-12345';
      expect(normalizeJobUrl(url)).toBe('acme.myworkdayjobs.com/en-US/External/job/USA/Engineer_JR-12345');
    });

    it('handles Indeed URLs', () => {
      const url = 'https://www.indeed.com/viewjob?jk=abc123def456&tk=xyz';
      expect(normalizeJobUrl(url)).toBe('www.indeed.com/viewjob');
    });

    it('handles Glassdoor URLs', () => {
      const url = 'https://www.glassdoor.com/job-listing/software-engineer-acme-JV_123456789.htm?jl=123456789';
      expect(normalizeJobUrl(url)).toBe('www.glassdoor.com/job-listing/software-engineer-acme-JV_123456789.htm');
    });
  });

  describe('edge cases', () => {
    it('returns null for null input', () => {
      expect(normalizeJobUrl(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(normalizeJobUrl(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(normalizeJobUrl('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(normalizeJobUrl('   ')).toBeNull();
    });

    it('returns null for invalid URL', () => {
      expect(normalizeJobUrl('not-a-url')).toBeNull();
    });

    it('returns null for URL with only protocol', () => {
      expect(normalizeJobUrl('https://')).toBeNull();
    });

    it('returns null for relative URL', () => {
      expect(normalizeJobUrl('/jobs/view/123')).toBeNull();
    });

    it('handles http URLs', () => {
      const url = 'http://careers.example.com/jobs/engineer';
      expect(normalizeJobUrl(url)).toBe('careers.example.com/jobs/engineer');
    });

    it('handles URLs with root path only', () => {
      const url = 'https://example.com/';
      expect(normalizeJobUrl(url)).toBe('example.com');
    });

    it('handles URLs without path', () => {
      const url = 'https://example.com';
      expect(normalizeJobUrl(url)).toBe('example.com');
    });

    it('handles FTP URLs (returns normalized)', () => {
      const url = 'ftp://files.example.com/jobs';
      expect(normalizeJobUrl(url)).toBe('files.example.com/jobs');
    });
  });

  describe('duplicate detection consistency', () => {
    it('produces same output for semantically identical LinkedIn URLs', () => {
      const urls = [
        'https://www.linkedin.com/jobs/view/3847291034',
        'https://linkedin.com/jobs/view/3847291034',
        'https://www.linkedin.com/jobs/view/3847291034/',
        'https://www.linkedin.com/jobs/view/3847291034?refId=abc',
        'https://www.linkedin.com/jobs/view/3847291034?trackingId=xyz&trk=jobs_list',
      ];

      const normalized = urls.map(url => normalizeJobUrl(url));
      expect(new Set(normalized).size).toBe(1);
      expect(normalized[0]).toBe('linkedin:3847291034');
    });

    it('produces same output for semantically identical Greenhouse URLs', () => {
      const urls = [
        'https://boards.greenhouse.io/acme/jobs/4567890',
        'https://boards.greenhouse.io/acme/jobs/4567890?gh_jid=4567890',
        'https://boards.greenhouse.io/acme/jobs/4567890/',
      ];

      const normalized = urls.map(url => normalizeJobUrl(url));
      expect(new Set(normalized).size).toBe(1);
      expect(normalized[0]).toBe('greenhouse:acme:4567890');
    });

    it('produces same output for semantically identical Lever URLs', () => {
      const urls = [
        'https://jobs.lever.co/acme/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        'https://jobs.lever.co/acme/a1b2c3d4-e5f6-7890-abcd-ef1234567890?lever-origin=applied',
        'https://jobs.lever.co/acme/a1b2c3d4-e5f6-7890-abcd-ef1234567890/',
      ];

      const normalized = urls.map(url => normalizeJobUrl(url));
      expect(new Set(normalized).size).toBe(1);
      expect(normalized[0]).toBe('lever:acme:a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });
  });
});
