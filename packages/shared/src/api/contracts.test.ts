/**
 * API Contract Tests for @idynic/shared
 *
 * These tests validate the API contract types at compile time and runtime.
 * TypeScript compilation itself serves as the primary contract validation -
 * if types change incompatibly, this file will fail to compile.
 *
 * Runtime tests provide additional validation for type shapes.
 */

import { describe, it, expect } from 'vitest';
import type {
  // Common types
  ApiResponse,
  ApiResponseMeta,
  ApiErrorResponse,
  ApiErrorCode,
  PaginationParams,
  // Profile types
  ProfileResponse,
  ProfileUpdateRequest,
  ProfileContact,
  WorkHistoryEntry,
  EducationEntry,
  SkillEntry,
  // Claims types
  Claim,
  ClaimDetail,
  ClaimType,
  ClaimEvidence,
  ClaimUpdateRequest,
  // Opportunities types
  Opportunity,
  OpportunityStatus,
  OpportunityRequirement,
  OpportunityCreateRequest,
  OpportunityMatchResponse,
  MatchScores,
  MatchStrength,
  MatchGap,
  // Tailored profile types
  TailoredProfile,
  TailorProfileRequest,
  ResumeData,
  ProfileEvaluation,
  // Shared link types
  SharedLink,
  ShareProfileRequest,
  SharedProfileData,
  // Document types
  Document,
  DocumentType,
  DocumentStatus,
  // Billing types
  Subscription,
  PlanType,
  SubscriptionStatus,
  UsageInfo,
  // Other types
  HealthResponse,
  FeedbackRequest,
  FeedbackType,
  DeleteResponse,
} from './types';

import {
  API_ENDPOINTS,
  API_VERSION,
  ENDPOINT_METHODS,
  type HttpMethod,
} from './endpoints';

// =============================================================================
// Type Guards for Runtime Validation
// =============================================================================

function isApiResponseMeta(obj: unknown): obj is ApiResponseMeta {
  if (typeof obj !== 'object' || obj === null) return false;
  const meta = obj as Record<string, unknown>;
  return typeof meta.request_id === 'string';
}

function isApiErrorResponse(obj: unknown): obj is ApiErrorResponse {
  if (typeof obj !== 'object' || obj === null) return false;
  const response = obj as Record<string, unknown>;
  if (typeof response.error !== 'object' || response.error === null) return false;
  const error = response.error as Record<string, unknown>;
  return (
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.request_id === 'string'
  );
}

function isProfileContact(obj: unknown): obj is ProfileContact {
  if (typeof obj !== 'object' || obj === null) return false;
  const contact = obj as Record<string, unknown>;
  // All fields can be null or string
  const stringOrNull = (val: unknown) => val === null || typeof val === 'string';
  return (
    stringOrNull(contact.name) &&
    stringOrNull(contact.email) &&
    stringOrNull(contact.phone) &&
    stringOrNull(contact.location) &&
    stringOrNull(contact.linkedin) &&
    stringOrNull(contact.github) &&
    stringOrNull(contact.website) &&
    stringOrNull(contact.logo_url)
  );
}

function isWorkHistoryEntry(obj: unknown): obj is WorkHistoryEntry {
  if (typeof obj !== 'object' || obj === null) return false;
  const entry = obj as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.company === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.start_date === 'string' &&
    typeof entry.order_index === 'number'
  );
}

function isClaim(obj: unknown): obj is Claim {
  if (typeof obj !== 'object' || obj === null) return false;
  const claim = obj as Record<string, unknown>;
  const validTypes: ClaimType[] = ['skill', 'achievement', 'attribute', 'education', 'certification'];
  return (
    typeof claim.id === 'string' &&
    typeof claim.type === 'string' &&
    validTypes.includes(claim.type as ClaimType) &&
    typeof claim.label === 'string' &&
    typeof claim.created_at === 'string'
  );
}

function isOpportunity(obj: unknown): obj is Opportunity {
  if (typeof obj !== 'object' || obj === null) return false;
  const opp = obj as Record<string, unknown>;
  return (
    typeof opp.id === 'string' &&
    typeof opp.title === 'string' &&
    typeof opp.created_at === 'string'
  );
}

function isMatchScores(obj: unknown): obj is MatchScores {
  if (typeof obj !== 'object' || obj === null) return false;
  const scores = obj as Record<string, unknown>;
  return (
    typeof scores.overall === 'number' &&
    typeof scores.must_have === 'number' &&
    typeof scores.nice_to_have === 'number'
  );
}

// =============================================================================
// Compile-Time Type Tests
// =============================================================================

describe('API Contract Types - Compile Time Validation', () => {
  describe('Common Types', () => {
    it('ApiResponse has correct structure', () => {
      // This test validates at compile time - if types change, compilation fails
      const response: ApiResponse<{ id: string }> = {
        data: { id: 'test' },
        meta: { request_id: 'req-123' },
      };
      expect(response.data.id).toBe('test');
      expect(response.meta.request_id).toBe('req-123');
    });

    it('ApiErrorResponse has correct structure', () => {
      const errorResponse: ApiErrorResponse = {
        error: {
          code: 'not_found',
          message: 'Resource not found',
          request_id: 'req-123',
        },
      };
      expect(errorResponse.error.code).toBe('not_found');
    });

    it('ApiErrorCode includes all expected values', () => {
      const codes: ApiErrorCode[] = [
        'unauthorized',
        'invalid_api_key',
        'expired_api_key',
        'rate_limited',
        'invalid_token',
        'not_found',
        'validation_error',
        'server_error',
        'duplicate',
        'limit_reached',
        'scraping_failed',
        'ai_error',
        'expired',
        'revoked',
      ];
      expect(codes).toHaveLength(14);
    });

    it('PaginationParams is optional', () => {
      const params: PaginationParams = {};
      const paramsWithLimit: PaginationParams = { limit: 10 };
      const paramsWithBoth: PaginationParams = { limit: 10, offset: 20 };
      expect(params).toEqual({});
      expect(paramsWithLimit.limit).toBe(10);
      expect(paramsWithBoth.offset).toBe(20);
    });
  });

  describe('Profile Types', () => {
    it('ProfileContact allows null values', () => {
      const contact: ProfileContact = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: null,
        location: null,
        linkedin: null,
        github: null,
        website: null,
        logo_url: null,
      };
      expect(contact.name).toBe('John Doe');
    });

    it('WorkHistoryEntry has required fields', () => {
      const entry: WorkHistoryEntry = {
        id: 'wh-123',
        company: 'Acme Corp',
        title: 'Software Engineer',
        start_date: '2020-01-01',
        end_date: null,
        location: 'San Francisco, CA',
        summary: null,
        entry_type: 'work',
        order_index: 0,
        company_domain: 'acme.com',
      };
      expect(entry.company).toBe('Acme Corp');
    });

    it('ProfileUpdateRequest fields are optional', () => {
      const request: ProfileUpdateRequest = {};
      const partialRequest: ProfileUpdateRequest = { name: 'Jane Doe' };
      expect(request).toEqual({});
      expect(partialRequest.name).toBe('Jane Doe');
    });
  });

  describe('Claims Types', () => {
    it('ClaimType enum values', () => {
      const types: ClaimType[] = ['skill', 'achievement', 'attribute', 'education', 'certification'];
      expect(types).toContain('skill');
    });

    it('Claim has required fields', () => {
      const claim: Claim = {
        id: 'claim-123',
        type: 'skill',
        label: 'TypeScript',
        description: 'Expert in TypeScript',
        confidence: 0.95,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: null,
      };
      expect(claim.type).toBe('skill');
    });

    it('ClaimDetail extends Claim with evidence and issues', () => {
      const claimDetail: ClaimDetail = {
        id: 'claim-123',
        type: 'skill',
        label: 'TypeScript',
        description: null,
        confidence: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: null,
        evidence: [
          {
            id: 'ev-1',
            text: 'Built large TypeScript applications',
            evidence_type: 'accomplishment',
            source_type: 'resume',
            strength: 'strong',
            evidence_date: null,
          },
        ],
        issues: [],
      };
      expect(claimDetail.evidence).toHaveLength(1);
    });
  });

  describe('Opportunities Types', () => {
    it('OpportunityStatus enum values', () => {
      const statuses: OpportunityStatus[] = ['tracking', 'applied', 'rejected', 'offered', 'negotiating'];
      expect(statuses).toContain('tracking');
    });

    it('OpportunityRequirement has category and type', () => {
      const req: OpportunityRequirement = {
        text: '5+ years of experience',
        category: 'must_have',
        type: 'experience',
      };
      expect(req.category).toBe('must_have');
    });

    it('OpportunityCreateRequest supports url or description', () => {
      const withUrl: OpportunityCreateRequest = { url: 'https://example.com/job' };
      const withDesc: OpportunityCreateRequest = { description: 'Senior Engineer role' };
      const withBoth: OpportunityCreateRequest = { url: 'https://example.com', description: 'Role' };
      expect(withUrl.url).toBeDefined();
      expect(withDesc.description).toBeDefined();
      expect(withBoth.url).toBeDefined();
    });

    it('MatchScores has overall, must_have, nice_to_have', () => {
      const scores: MatchScores = {
        overall: 0.85,
        must_have: 0.9,
        nice_to_have: 0.7,
      };
      expect(scores.overall).toBe(0.85);
    });
  });

  describe('Tailored Profile Types', () => {
    it('TailorProfileRequest has optional regenerate', () => {
      const request: TailorProfileRequest = {};
      const withRegenerate: TailorProfileRequest = { regenerate: true };
      expect(request.regenerate).toBeUndefined();
      expect(withRegenerate.regenerate).toBe(true);
    });

    it('ProfileEvaluation has passed flag and arrays', () => {
      const evaluation: ProfileEvaluation = {
        passed: true,
        hallucinations: [],
        missedOpportunities: [],
        gaps: ['Leadership experience'],
      };
      expect(evaluation.passed).toBe(true);
      expect(evaluation.gaps).toHaveLength(1);
    });
  });

  describe('Document Types', () => {
    it('DocumentType enum values', () => {
      const types: DocumentType[] = ['resume', 'story', 'opportunity'];
      expect(types).toContain('resume');
    });

    it('DocumentStatus enum values', () => {
      const statuses: DocumentStatus[] = ['pending', 'processing', 'completed', 'failed'];
      expect(statuses).toContain('completed');
    });
  });

  describe('Billing Types', () => {
    it('PlanType enum values', () => {
      const plans: PlanType[] = ['free', 'starter', 'pro', 'professional'];
      expect(plans).toContain('free');
    });

    it('SubscriptionStatus enum values', () => {
      const statuses: SubscriptionStatus[] = ['active', 'canceled', 'past_due', 'trialing'];
      expect(statuses).toContain('active');
    });
  });
});

// =============================================================================
// Runtime Type Guard Tests
// =============================================================================

describe('API Contract Types - Runtime Validation', () => {
  describe('Type Guards', () => {
    it('isApiResponseMeta validates meta objects', () => {
      expect(isApiResponseMeta({ request_id: 'req-123' })).toBe(true);
      expect(isApiResponseMeta({ request_id: 'req-123', count: 10 })).toBe(true);
      expect(isApiResponseMeta({})).toBe(false);
      expect(isApiResponseMeta(null)).toBe(false);
      expect(isApiResponseMeta({ request_id: 123 })).toBe(false);
    });

    it('isApiErrorResponse validates error responses', () => {
      expect(
        isApiErrorResponse({
          error: { code: 'not_found', message: 'Not found', request_id: 'req-123' },
        })
      ).toBe(true);
      expect(isApiErrorResponse({ error: {} })).toBe(false);
      expect(isApiErrorResponse({})).toBe(false);
    });

    it('isProfileContact validates contact objects', () => {
      const validContact = {
        name: 'John',
        email: 'john@example.com',
        phone: null,
        location: null,
        linkedin: null,
        github: null,
        website: null,
        logo_url: null,
      };
      expect(isProfileContact(validContact)).toBe(true);
      expect(isProfileContact({ name: 123 })).toBe(false);
    });

    it('isWorkHistoryEntry validates work history', () => {
      const validEntry = {
        id: 'wh-1',
        company: 'Acme',
        title: 'Engineer',
        start_date: '2020-01-01',
        end_date: null,
        location: null,
        summary: null,
        entry_type: 'work',
        order_index: 0,
        company_domain: null,
      };
      expect(isWorkHistoryEntry(validEntry)).toBe(true);
      expect(isWorkHistoryEntry({ id: 'wh-1' })).toBe(false);
    });

    it('isClaim validates claim objects', () => {
      const validClaim = {
        id: 'claim-1',
        type: 'skill',
        label: 'TypeScript',
        description: null,
        confidence: null,
        created_at: '2024-01-01',
        updated_at: null,
      };
      expect(isClaim(validClaim)).toBe(true);
      expect(isClaim({ ...validClaim, type: 'invalid' })).toBe(false);
    });

    it('isOpportunity validates opportunity objects', () => {
      const validOpp = {
        id: 'opp-1',
        title: 'Software Engineer',
        company: 'Acme',
        created_at: '2024-01-01',
      };
      expect(isOpportunity(validOpp)).toBe(true);
      expect(isOpportunity({ id: 'opp-1' })).toBe(false);
    });

    it('isMatchScores validates match score objects', () => {
      expect(isMatchScores({ overall: 0.9, must_have: 0.95, nice_to_have: 0.8 })).toBe(true);
      expect(isMatchScores({ overall: 0.9 })).toBe(false);
    });
  });
});

// =============================================================================
// Endpoint Definition Tests
// =============================================================================

describe('API Endpoints', () => {
  describe('Static Endpoints', () => {
    it('API_VERSION is correct', () => {
      expect(API_VERSION).toBe('v1');
    });

    it('health endpoint is defined', () => {
      expect(API_ENDPOINTS.health).toBe('/api/health');
    });

    it('profile endpoints are defined', () => {
      expect(API_ENDPOINTS.profile.get).toBe('/api/v1/profile');
      expect(API_ENDPOINTS.profile.update).toBe('/api/v1/profile');
    });

    it('claims list endpoint is defined', () => {
      expect(API_ENDPOINTS.claims.list).toBe('/api/v1/claims');
    });

    it('opportunities list endpoint is defined', () => {
      expect(API_ENDPOINTS.opportunities.list).toBe('/api/v1/opportunities');
    });

    it('documents endpoints are defined', () => {
      expect(API_ENDPOINTS.documents.uploadResume).toBe('/api/v1/documents/resume');
      expect(API_ENDPOINTS.documents.uploadStory).toBe('/api/v1/documents/story');
    });
  });

  describe('Dynamic Endpoints', () => {
    it('claims.get generates correct path', () => {
      expect(API_ENDPOINTS.claims.get('claim-123')).toBe('/api/v1/claims/claim-123');
    });

    it('opportunities.get generates correct path', () => {
      expect(API_ENDPOINTS.opportunities.get('opp-456')).toBe('/api/v1/opportunities/opp-456');
    });

    it('opportunities.match generates correct path', () => {
      expect(API_ENDPOINTS.opportunities.match('opp-456')).toBe('/api/v1/opportunities/opp-456/match');
    });

    it('opportunities.tailor generates correct path', () => {
      expect(API_ENDPOINTS.opportunities.tailor('opp-456')).toBe('/api/v1/opportunities/opp-456/tailor');
    });

    it('opportunities.share generates correct path', () => {
      expect(API_ENDPOINTS.opportunities.share('opp-456')).toBe('/api/v1/opportunities/opp-456/share');
    });

    it('workHistory endpoints generate correct paths', () => {
      expect(API_ENDPOINTS.workHistory.update('wh-789')).toBe('/api/profile/work-history/wh-789');
      expect(API_ENDPOINTS.workHistory.delete('wh-789')).toBe('/api/profile/work-history/wh-789');
    });

    it('education endpoints generate correct paths', () => {
      expect(API_ENDPOINTS.education.update('edu-123')).toBe('/api/profile/education/edu-123');
      expect(API_ENDPOINTS.education.delete('edu-123')).toBe('/api/profile/education/edu-123');
    });

    it('skills.delete generates correct path', () => {
      expect(API_ENDPOINTS.skills.delete('skill-456')).toBe('/api/profile/skills/skill-456');
    });

    it('shared endpoints generate correct paths', () => {
      expect(API_ENDPOINTS.shared.get('abc123')).toBe('/api/shared/abc123');
      expect(API_ENDPOINTS.shared.summary('abc123')).toBe('/api/v1/shared/abc123/summary');
    });
  });

  describe('Endpoint Methods', () => {
    it('profile methods are correct', () => {
      expect(ENDPOINT_METHODS['profile.get']).toBe('GET');
      expect(ENDPOINT_METHODS['profile.update']).toBe('PATCH');
    });

    it('claims methods are correct', () => {
      expect(ENDPOINT_METHODS['claims.list']).toBe('GET');
      expect(ENDPOINT_METHODS['claims.get']).toBe('GET');
      expect(ENDPOINT_METHODS['claims.update']).toBe('PATCH');
      expect(ENDPOINT_METHODS['claims.delete']).toBe('DELETE');
    });

    it('opportunities methods are correct', () => {
      expect(ENDPOINT_METHODS['opportunities.list']).toBe('GET');
      expect(ENDPOINT_METHODS['opportunities.create']).toBe('POST');
      expect(ENDPOINT_METHODS['opportunities.get']).toBe('GET');
      expect(ENDPOINT_METHODS['opportunities.tailor']).toBe('POST');
    });

    it('all methods are valid HTTP methods', () => {
      const validMethods: HttpMethod[] = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
      Object.values(ENDPOINT_METHODS).forEach((method) => {
        expect(validMethods).toContain(method);
      });
    });
  });
});

// =============================================================================
// Type Compatibility Tests
// =============================================================================

describe('Type Compatibility', () => {
  it('HealthResponse matches expected shape', () => {
    const health: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    expect(health.status).toBe('ok');
  });

  it('FeedbackRequest has required fields', () => {
    const feedback: FeedbackRequest = {
      title: 'Bug report',
      description: 'Something is broken',
      type: 'bug',
    };
    expect(feedback.type).toBe('bug');
  });

  it('FeedbackType enum values', () => {
    const types: FeedbackType[] = ['bug', 'feature', 'question'];
    expect(types).toHaveLength(3);
  });

  it('DeleteResponse has correct structure', () => {
    const response: DeleteResponse = {
      deleted: true,
      id: 'item-123',
    };
    expect(response.deleted).toBe(true);
  });

  it('SharedLink has required fields', () => {
    const link: SharedLink = {
      id: 'sl-123',
      token: 'abc123xyz',
      url: 'https://app.idynic.com/s/abc123xyz',
      expires_at: '2025-01-01T00:00:00Z',
      revoked_at: null,
      created_at: '2024-01-01T00:00:00Z',
      tailored_profile_id: 'tp-456',
    };
    expect(link.token).toBe('abc123xyz');
  });

  it('ShareProfileRequest has optional expires_in_days', () => {
    const request: ShareProfileRequest = {};
    const withExpiry: ShareProfileRequest = { expires_in_days: 30 };
    expect(request.expires_in_days).toBeUndefined();
    expect(withExpiry.expires_in_days).toBe(30);
  });
});
