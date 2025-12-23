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
  });

  describe('Lever URLs', () => {
    it('extracts company and job ID from Lever URL', () => {
      const url = 'https://jobs.lever.co/acme/a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      expect(normalizeJobUrl(url)).toBe('lever:acme:a1b2c3d4-e5f6-7890-abcd-ef1234567890');
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

    it('returns null for invalid URL', () => {
      expect(normalizeJobUrl('not-a-url')).toBeNull();
    });
  });
});
