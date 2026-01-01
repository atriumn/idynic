/**
 * API Endpoint Definitions for @idynic/shared
 *
 * This file defines all API endpoint paths as constants.
 * All clients (web, mobile, Chrome extension, MCP server) should use
 * these endpoints to ensure consistency across the codebase.
 *
 * Using `as const` enables strict literal type inference, ensuring
 * type safety when building API calls.
 */

/**
 * API version prefix for versioned endpoints
 */
export const API_VERSION = 'v1' as const;

/**
 * All API endpoint definitions
 *
 * Static paths are defined as string literals.
 * Dynamic paths (with IDs) are defined as functions.
 */
export const API_ENDPOINTS = {
  /**
   * Health check endpoint (no auth required)
   */
  health: '/api/health',

  /**
   * Profile endpoints
   */
  profile: {
    /** GET - Get current user's profile */
    get: '/api/v1/profile',
    /** PATCH - Update current user's profile */
    update: '/api/v1/profile',
  },

  /**
   * Work history endpoints
   */
  workHistory: {
    /** POST - Create a work history entry */
    create: '/api/profile/work-history',
    /** PATCH - Update a work history entry */
    update: (id: string) => `/api/profile/work-history/${id}` as const,
    /** DELETE - Delete a work history entry */
    delete: (id: string) => `/api/profile/work-history/${id}` as const,
  },

  /**
   * Education endpoints
   */
  education: {
    /** POST - Create an education entry */
    create: '/api/profile/education',
    /** PATCH - Update an education entry */
    update: (id: string) => `/api/profile/education/${id}` as const,
    /** DELETE - Delete an education entry */
    delete: (id: string) => `/api/profile/education/${id}` as const,
  },

  /**
   * Skills endpoints
   */
  skills: {
    /** POST - Create a skill */
    create: '/api/profile/skills',
    /** DELETE - Delete a skill */
    delete: (id: string) => `/api/profile/skills/${id}` as const,
  },

  /**
   * Claims/Identity endpoints
   */
  claims: {
    /** GET - List all claims, optionally filtered by type */
    list: '/api/v1/claims',
    /** GET - Get a single claim with evidence */
    get: (id: string) => `/api/v1/claims/${id}` as const,
    /** PATCH - Update a claim */
    update: (id: string) => `/api/v1/claims/${id}` as const,
    /** DELETE - Delete a claim */
    delete: (id: string) => `/api/v1/claims/${id}` as const,
    /** POST - Dismiss issues on a claim */
    dismiss: (id: string) => `/api/v1/claims/${id}/dismiss` as const,
  },

  /**
   * Opportunities endpoints
   */
  opportunities: {
    /** GET - List all opportunities */
    list: '/api/v1/opportunities',
    /** POST - Create a new opportunity */
    create: '/api/v1/opportunities',
    /** GET - Get a single opportunity */
    get: (id: string) => `/api/v1/opportunities/${id}` as const,
    /** GET - Get match analysis for an opportunity */
    match: (id: string) => `/api/v1/opportunities/${id}/match` as const,
    /** POST - Generate tailored profile for an opportunity */
    tailor: (id: string) => `/api/v1/opportunities/${id}/tailor` as const,
    /** POST - Create shareable link for an opportunity */
    share: (id: string) => `/api/v1/opportunities/${id}/share` as const,
    /** POST - Add opportunity and generate tailored profile */
    addAndTailor: '/api/v1/opportunities/add-and-tailor',
    /** POST - Add opportunity, tailor, and create share link */
    addTailorShare: '/api/v1/opportunities/add-tailor-share',
  },

  /**
   * Document upload endpoints
   */
  documents: {
    /** POST - Upload a resume document */
    uploadResume: '/api/v1/documents/resume',
    /** POST - Upload a story document */
    uploadStory: '/api/v1/documents/story',
  },

  /**
   * Shared links management endpoints
   * Note: These endpoints may use cookie-based auth in web app
   */
  sharedLinks: {
    /** GET - List all shared links */
    list: '/api/shared-links',
    /** POST - Create a shared link */
    create: '/api/shared-links',
    /** DELETE - Delete/revoke a shared link */
    delete: (id: string) => `/api/shared-links/${id}` as const,
  },

  /**
   * Public shared profile endpoints (no auth required)
   */
  shared: {
    /** GET - Get shared profile data */
    get: (token: string) => `/api/shared/${token}` as const,
    /** GET - Get AI-generated summary of shared profile */
    summary: (token: string) => `/api/v1/shared/${token}/summary` as const,
  },

  /**
   * Account management endpoints
   */
  account: {
    /** DELETE - Delete account and all data */
    delete: '/api/v1/account',
    /** GET - Export all account data */
    export: '/api/v1/account/export',
  },

  /**
   * Auth verification endpoints
   */
  auth: {
    /** POST - Verify authentication */
    verify: '/api/v1/auth/verify',
  },

  /**
   * Billing/Subscription endpoints
   */
  billing: {
    /** GET - Get current subscription and usage */
    subscription: '/api/billing/subscription',
    /** POST - Create Stripe checkout session */
    createCheckoutSession: '/api/billing/create-checkout-session',
    /** POST - Create Stripe billing portal session */
    createPortalSession: '/api/billing/create-portal-session',
    /** POST - Create or update subscription */
    createSubscription: '/api/billing/create-subscription',
  },

  /**
   * Usage tracking endpoints
   */
  usage: {
    /** GET - Get API usage stats */
    get: '/api/v1/usage',
  },

  /**
   * Feedback endpoints
   */
  feedback: {
    /** POST - Submit feedback */
    submit: '/api/feedback',
  },

  /**
   * Waitlist endpoints
   */
  waitlist: {
    /** POST - Join recruiter waitlist */
    recruiter: '/api/recruiter-waitlist',
  },
} as const;

/**
 * Type helper to extract the path type from an endpoint
 */
export type EndpointPath<T> = T extends (...args: unknown[]) => infer R ? R : T;

/**
 * HTTP methods used in the API
 */
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * Endpoint method mapping for documentation
 */
export const ENDPOINT_METHODS: Record<string, HttpMethod> = {
  // Profile
  'profile.get': 'GET',
  'profile.update': 'PATCH',

  // Work History
  'workHistory.create': 'POST',
  'workHistory.update': 'PATCH',
  'workHistory.delete': 'DELETE',

  // Education
  'education.create': 'POST',
  'education.update': 'PATCH',
  'education.delete': 'DELETE',

  // Skills
  'skills.create': 'POST',
  'skills.delete': 'DELETE',

  // Claims
  'claims.list': 'GET',
  'claims.get': 'GET',
  'claims.update': 'PATCH',
  'claims.delete': 'DELETE',
  'claims.dismiss': 'POST',

  // Opportunities
  'opportunities.list': 'GET',
  'opportunities.create': 'POST',
  'opportunities.get': 'GET',
  'opportunities.match': 'GET',
  'opportunities.tailor': 'POST',
  'opportunities.share': 'POST',
  'opportunities.addAndTailor': 'POST',
  'opportunities.addTailorShare': 'POST',

  // Documents
  'documents.uploadResume': 'POST',
  'documents.uploadStory': 'POST',

  // Shared Links
  'sharedLinks.list': 'GET',
  'sharedLinks.create': 'POST',
  'sharedLinks.delete': 'DELETE',

  // Shared (public)
  'shared.get': 'GET',
  'shared.summary': 'GET',

  // Account
  'account.delete': 'DELETE',
  'account.export': 'GET',

  // Auth
  'auth.verify': 'POST',

  // Billing
  'billing.subscription': 'GET',
  'billing.createCheckoutSession': 'POST',
  'billing.createPortalSession': 'POST',
  'billing.createSubscription': 'POST',

  // Usage
  'usage.get': 'GET',

  // Feedback
  'feedback.submit': 'POST',

  // Waitlist
  'waitlist.recruiter': 'POST',

  // Health
  health: 'GET',
} as const;
