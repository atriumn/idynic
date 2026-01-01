/**
 * API Contract Types for @idynic/shared
 *
 * This file defines all request and response types for the Idynic API.
 * All clients (web, mobile, Chrome extension, MCP server) should import
 * these types to ensure type safety and API contract compliance.
 *
 * Type changes here will break builds in affected clients, catching
 * API mismatches at compile time.
 */

import type { Tables, Json } from '../types/database';

// =============================================================================
// Common Types
// =============================================================================

/**
 * Standard API response wrapper for successful responses
 */
export interface ApiResponse<T> {
  data: T;
  meta: ApiResponseMeta;
}

/**
 * Metadata included in all API responses
 */
export interface ApiResponseMeta {
  request_id: string;
  count?: number;
  has_more?: boolean;
}

/**
 * Standard API error response
 */
export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    request_id: string;
  };
}

/**
 * Known API error codes
 */
export type ApiErrorCode =
  | 'unauthorized'
  | 'invalid_api_key'
  | 'expired_api_key'
  | 'rate_limited'
  | 'invalid_token'
  | 'not_found'
  | 'validation_error'
  | 'server_error'
  | 'duplicate'
  | 'limit_reached'
  | 'scraping_failed'
  | 'ai_error'
  | 'expired'
  | 'revoked';

/**
 * Pagination parameters for list endpoints
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

// =============================================================================
// Profile Types
// =============================================================================

/**
 * Contact information from profile
 */
export interface ProfileContact {
  name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  github: string | null;
  website: string | null;
  logo_url: string | null;
}

/**
 * Work history entry
 */
export interface WorkHistoryEntry {
  id: string;
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  location: string | null;
  summary: string | null;
  entry_type: 'work' | 'venture' | 'additional' | null;
  order_index: number;
  company_domain: string | null;
}

/**
 * Education entry (derived from identity claims)
 */
export interface EducationEntry {
  id: string;
  label: string;
  description: string | null;
}

/**
 * Skill entry (derived from identity claims)
 */
export interface SkillEntry {
  id: string;
  label: string;
  confidence: number | null;
}

/**
 * Certification entry (derived from identity claims)
 */
export interface CertificationEntry {
  id: string;
  label: string;
  description: string | null;
}

/**
 * Full profile response from GET /api/v1/profile
 */
export interface ProfileResponse {
  contact: ProfileContact;
  work_history: WorkHistoryEntry[];
  ventures: WorkHistoryEntry[];
  additional_experience: WorkHistoryEntry[];
  skills: SkillEntry[];
  certifications: CertificationEntry[];
  education: EducationEntry[];
  identity: {
    headline: string | null;
    bio: string | null;
    archetype: string | null;
    keywords: Json | null;
  } | null;
}

/**
 * Request body for PATCH /api/v1/profile
 */
export interface ProfileUpdateRequest {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

/**
 * Response from PATCH /api/v1/profile
 */
export type ProfileUpdateResponse = ApiResponse<ProfileContact>;

// =============================================================================
// Work History Types
// =============================================================================

/**
 * Request body for POST /api/profile/work-history
 */
export interface WorkHistoryCreateRequest {
  company: string;
  title: string;
  start_date: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  entry_type?: 'work' | 'venture' | 'additional';
}

/**
 * Request body for PATCH /api/profile/work-history/:id
 */
export interface WorkHistoryUpdateRequest {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
}

/**
 * Response from work history mutations
 */
export type WorkHistoryResponse = ApiResponse<WorkHistoryEntry>;

// =============================================================================
// Education Types
// =============================================================================

/**
 * Request body for POST /api/profile/education
 */
export interface EducationCreateRequest {
  text: string;
}

/**
 * Request body for PATCH /api/profile/education/:id
 */
export interface EducationUpdateRequest {
  text?: string;
}

/**
 * Response from education mutations
 */
export type EducationResponse = ApiResponse<EducationEntry>;

// =============================================================================
// Skills Types
// =============================================================================

/**
 * Request body for POST /api/profile/skills
 */
export interface SkillCreateRequest {
  label: string;
}

/**
 * Response from skill mutations
 */
export type SkillResponse = ApiResponse<SkillEntry>;

// =============================================================================
// Claims/Identity Types
// =============================================================================

/**
 * Claim types
 */
export type ClaimType = 'skill' | 'achievement' | 'attribute' | 'education' | 'certification';

/**
 * Evidence linked to a claim
 */
export interface ClaimEvidence {
  id: string;
  text: string;
  evidence_type: string;
  source_type: string;
  strength: string;
  evidence_date: string | null;
}

/**
 * Issue reported on a claim
 */
export interface ClaimIssue {
  id: string;
  issue_type: string;
  severity: string;
  message: string;
  related_claim_id: string | null;
  created_at: string;
}

/**
 * Claim response from list endpoint
 */
export interface Claim {
  id: string;
  type: ClaimType;
  label: string;
  description: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * Detailed claim response with evidence
 */
export interface ClaimDetail extends Claim {
  evidence: ClaimEvidence[];
  issues: ClaimIssue[];
}

/**
 * Query parameters for GET /api/v1/claims
 */
export interface ClaimsListParams {
  type?: ClaimType;
}

/**
 * Response from GET /api/v1/claims
 */
export type ClaimsListResponse = ApiResponse<Claim[]>;

/**
 * Response from GET /api/v1/claims/:id
 */
export type ClaimDetailResponse = ApiResponse<ClaimDetail>;

/**
 * Request body for PATCH /api/v1/claims/:id
 */
export interface ClaimUpdateRequest {
  label?: string;
  description?: string;
  type?: ClaimType;
}

/**
 * Response from PATCH /api/v1/claims/:id
 */
export type ClaimUpdateResponse = ApiResponse<Claim>;

/**
 * Response from DELETE /api/v1/claims/:id
 */
export interface ClaimDeleteResponse {
  deleted: true;
  id: string;
}

// =============================================================================
// Opportunities Types
// =============================================================================

/**
 * Opportunity status values
 */
export type OpportunityStatus = 'tracking' | 'applied' | 'rejected' | 'offered' | 'negotiating';

/**
 * Requirement extracted from opportunity
 */
export interface OpportunityRequirement {
  text: string;
  category: 'must_have' | 'nice_to_have';
  type: 'skill' | 'experience' | 'education' | 'certification' | 'other';
}

/**
 * Company research data
 */
export interface CompanyResearch {
  industry: string | null;
  url: string | null;
  logo_url: string | null;
  is_public: boolean | null;
  stock_ticker: string | null;
  challenges: Json | null;
  recent_news: Json | null;
  role_context: string | null;
  researched_at: string | null;
}

/**
 * Opportunity response
 */
export interface Opportunity {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
  description: string | null;
  description_html: string | null;
  requirements: OpportunityRequirement[] | null;
  status: OpportunityStatus | null;
  source: string | null;
  location: string | null;
  employment_type: string | null;
  seniority_level: string | null;
  job_function: string | null;
  industries: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_date: string | null;
  applicant_count: number | null;
  easy_apply: boolean | null;
  created_at: string;
  company_research: CompanyResearch | null;
}

/**
 * Query parameters for GET /api/v1/opportunities
 */
export interface OpportunitiesListParams {
  status?: OpportunityStatus;
}

/**
 * Response from GET /api/v1/opportunities
 */
export type OpportunitiesListResponse = ApiResponse<Opportunity[]>;

/**
 * Response from GET /api/v1/opportunities/:id
 */
export type OpportunityDetailResponse = ApiResponse<Opportunity>;

/**
 * Request body for POST /api/v1/opportunities
 */
export interface OpportunityCreateRequest {
  url?: string;
  description?: string;
}

/**
 * Response from POST /api/v1/opportunities
 */
export interface OpportunityCreateResponse {
  data: Opportunity & {
    requirement_counts: {
      must_have: number;
      nice_to_have: number;
    };
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Opportunity Match Types
// =============================================================================

/**
 * Match strength detail
 */
export interface MatchStrength {
  requirement: string;
  match: {
    claim: string;
    type: ClaimType;
    similarity: number;
  };
}

/**
 * Match gap detail
 */
export interface MatchGap {
  requirement: string;
  type: string;
  category: 'must_have' | 'nice_to_have';
}

/**
 * Match scores
 */
export interface MatchScores {
  overall: number;
  must_have: number;
  nice_to_have: number;
}

/**
 * Response from GET /api/v1/opportunities/:id/match
 */
export interface OpportunityMatchResponse {
  data: {
    opportunity: {
      id: string;
      title: string;
      company: string | null;
    };
    scores: MatchScores;
    strengths: MatchStrength[];
    gaps: MatchGap[];
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Tailored Profile Types
// =============================================================================

/**
 * Resume work experience entry
 */
export interface ResumeWorkEntry {
  company: string;
  title: string;
  start_date: string;
  end_date: string | null;
  bullets: string[];
}

/**
 * Resume data structure
 */
export interface ResumeData {
  contact: {
    name: string;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
  };
  summary: string;
  experience: ResumeWorkEntry[];
  skills: string[];
  education: string[];
}

/**
 * Evaluation result from profile generation
 */
export interface ProfileEvaluation {
  passed: boolean;
  hallucinations: string[];
  missedOpportunities: string[];
  gaps: string[];
}

/**
 * Tailored profile response
 */
export interface TailoredProfile {
  id: string;
  opportunity_id: string;
  narrative: string | null;
  narrative_original: string | null;
  resume_data: ResumeData | null;
  resume_data_original: ResumeData | null;
  talking_points: string[];
  edited_fields: string[] | null;
  created_at: string;
}

/**
 * Request body for POST /api/v1/opportunities/:id/tailor
 */
export interface TailorProfileRequest {
  regenerate?: boolean;
}

/**
 * Response from POST /api/v1/opportunities/:id/tailor
 */
export interface TailorProfileResponse {
  data: TailoredProfile & {
    evaluation?: ProfileEvaluation;
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Shared Links Types
// =============================================================================

/**
 * Shared link response
 */
export interface SharedLink {
  id: string;
  token: string;
  url: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  tailored_profile_id: string;
  view_count?: number;
}

/**
 * Request body for POST /api/v1/opportunities/:id/share
 */
export interface ShareProfileRequest {
  expires_in_days?: number;
}

/**
 * Response from POST /api/v1/opportunities/:id/share
 */
export interface ShareProfileResponse {
  data: {
    id: string;
    token: string;
    url: string;
    expires_at: string;
    existing: boolean;
  };
  meta: ApiResponseMeta;
}

/**
 * Response from GET /api/shared-links
 */
export type SharedLinksListResponse = ApiResponse<SharedLink[]>;

/**
 * Request body for POST /api/shared-links
 */
export interface SharedLinkCreateRequest {
  tailored_profile_id: string;
  expires_in_days?: number;
}

// =============================================================================
// Public Shared Profile Types
// =============================================================================

/**
 * Public shared profile data (no auth required)
 */
export interface SharedProfileData {
  profile: {
    name: string | null;
    headline: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
  opportunity: {
    id: string;
    title: string;
    company: string | null;
  };
  tailored: {
    narrative: string | null;
    resume_data: ResumeData | null;
    talking_points: string[];
  };
  created_at: string;
  expires_at: string;
}

/**
 * Response from GET /api/shared/:token
 */
export type SharedProfileResponse = ApiResponse<SharedProfileData>;

/**
 * Response from GET /api/v1/shared/:token/summary
 */
export interface SharedProfileSummaryResponse {
  data: {
    candidate_name: string | null;
    summary: string;
    generated_at: string;
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Documents Types
// =============================================================================

/**
 * Document types
 */
export type DocumentType = 'resume' | 'story' | 'opportunity';

/**
 * Document status
 */
export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Document response
 */
export interface Document {
  id: string;
  type: DocumentType;
  filename: string | null;
  status: DocumentStatus | null;
  created_at: string;
}

/**
 * Response from POST /api/v1/documents/resume or /api/v1/documents/story
 */
export interface DocumentUploadResponse {
  data: Document & {
    job_id: string;
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Account Types
// =============================================================================

/**
 * Request body for DELETE /api/v1/account
 */
export interface AccountDeleteRequest {
  password: string;
  confirmation: 'DELETE MY ACCOUNT';
}

/**
 * Response from GET /api/v1/account/export
 */
export interface AccountExportResponse {
  data: {
    profile: ProfileResponse;
    opportunities: Opportunity[];
    claims: Claim[];
    documents: Document[];
    exported_at: string;
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Billing Types
// =============================================================================

/**
 * Subscription plan types
 */
export type PlanType = 'free' | 'starter' | 'pro' | 'professional';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

/**
 * Subscription info
 */
export interface Subscription {
  plan_type: PlanType;
  plan_display_name: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

/**
 * Usage tracking
 */
export interface UsageInfo {
  uploads: number;
  tailored_profiles: number;
  period_start: string;
  period_end: string;
}

/**
 * Plan limits
 */
export interface PlanLimits {
  uploads_per_month?: number;
  tailored_profiles_per_month?: number;
}

/**
 * Response from GET /api/billing/subscription
 */
export interface BillingSubscriptionResponse {
  data: {
    subscription: Subscription;
    usage: UsageInfo;
    limits: PlanLimits;
    remaining: {
      uploads?: number;
      tailored_profiles?: number;
    };
    features: string[];
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Usage Types
// =============================================================================

/**
 * API key info
 */
export interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  scopes: string[] | null;
}

/**
 * Response from GET /api/v1/usage
 */
export interface UsageResponse {
  data: {
    api_keys: ApiKeyInfo[];
    counts: {
      documents: number;
      opportunities: number;
      active_share_links: number;
    };
  };
  meta: ApiResponseMeta;
}

// =============================================================================
// Feedback Types
// =============================================================================

/**
 * Feedback types
 */
export type FeedbackType = 'bug' | 'feature' | 'question';

/**
 * Request body for POST /api/feedback
 */
export interface FeedbackRequest {
  title: string;
  description: string;
  type: FeedbackType;
  email?: string;
  url?: string;
  userAgent?: string;
}

/**
 * Response from POST /api/feedback
 */
export interface FeedbackResponse {
  success: true;
  issueNumber: number;
  issueUrl: string;
}

// =============================================================================
// Health Types
// =============================================================================

/**
 * Response from GET /api/health
 */
export interface HealthResponse {
  status: 'ok';
  timestamp: string;
}

// =============================================================================
// Delete Response Type
// =============================================================================

/**
 * Generic delete response
 */
export interface DeleteResponse {
  deleted: true;
  id: string;
}
