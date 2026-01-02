# Idynic API Reference

This document provides a comprehensive reference for the Idynic API. All types and endpoints are defined in `@idynic/shared` to ensure type safety across all clients.

## Table of Contents

- [Authentication](#authentication)
- [Response Format](#response-format)
- [Error Handling](#error-handling)
- [Endpoints](#endpoints)
  - [Health](#health)
  - [Profile](#profile)
  - [Work History](#work-history)
  - [Education](#education)
  - [Skills](#skills)
  - [Claims](#claims)
  - [Opportunities](#opportunities)
  - [Documents](#documents)
  - [Shared Links](#shared-links)
  - [Account](#account)
  - [Billing](#billing)
  - [Usage](#usage)
  - [Feedback](#feedback)

## Authentication

The API supports two authentication methods:

### API Key Authentication

Include the API key in the `Authorization` header:

```http
Authorization: Bearer idn_xxxxxxxxxxxxxxxx
```

API keys are prefixed with `idn_` and can be created in the web app settings.

### JWT Token Authentication

For web and mobile apps, include the Supabase JWT token:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

## Response Format

### Success Response

All successful responses follow this structure:

```typescript
interface ApiResponse<T> {
  data: T;
  meta: {
    request_id: string;
    count?: number;      // For list endpoints
    has_more?: boolean;  // For paginated endpoints
  };
}
```

Example:

```json
{
  "data": {
    "id": "claim-123",
    "type": "skill",
    "label": "TypeScript"
  },
  "meta": {
    "request_id": "req-abc123"
  }
}
```

### Error Response

All error responses follow this structure:

```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    request_id: string;
  };
}
```

Example:

```json
{
  "error": {
    "code": "not_found",
    "message": "Resource not found",
    "request_id": "req-abc123"
  }
}
```

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `unauthorized` | 401 | Missing or invalid authentication |
| `invalid_api_key` | 401 | API key not found |
| `expired_api_key` | 401 | API key has expired |
| `invalid_token` | 401 | Invalid JWT token |
| `rate_limited` | 429 | Too many requests (check `Retry-After` header) |
| `not_found` | 404 | Resource does not exist |
| `validation_error` | 400 | Invalid request data |
| `duplicate` | 409 | Resource already exists |
| `limit_reached` | 403 | Usage limit exceeded |
| `scraping_failed` | 400 | Failed to fetch URL content |
| `ai_error` | 500 | AI processing failed |
| `server_error` | 500 | Internal server error |

### Rate Limits

- General API: 60 requests/minute
- AI operations: 10 requests/minute
- Public endpoints: 30 requests/minute

## Endpoints

### Health

#### GET /api/health

Health check endpoint. No authentication required.

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Profile

#### GET /api/v1/profile

Get the current user's complete profile.

**Response:**

```typescript
interface ProfileResponse {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
    logo_url: string | null;
  };
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
    keywords: string[] | null;
  } | null;
}
```

#### PATCH /api/v1/profile

Update the current user's contact information.

**Request:**

```typescript
interface ProfileUpdateRequest {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}
```

**Response:** Updated contact information wrapped in `ApiResponse`.

---

### Work History

#### POST /api/profile/work-history

Create a new work history entry.

**Request:**

```typescript
interface WorkHistoryCreateRequest {
  company: string;
  title: string;
  start_date: string;  // ISO date string
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
  entry_type?: 'work' | 'venture' | 'additional';
}
```

#### PATCH /api/profile/work-history/:id

Update an existing work history entry.

**Request:**

```typescript
interface WorkHistoryUpdateRequest {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  location?: string | null;
  summary?: string | null;
}
```

#### DELETE /api/profile/work-history/:id

Delete a work history entry.

**Response:** `{ deleted: true, id: string }`

---

### Education

#### POST /api/profile/education

Create a new education entry.

**Request:**

```typescript
interface EducationCreateRequest {
  text: string;  // Free-form education description
}
```

#### PATCH /api/profile/education/:id

Update an existing education entry.

#### DELETE /api/profile/education/:id

Delete an education entry.

---

### Skills

#### POST /api/profile/skills

Create a new skill.

**Request:**

```typescript
interface SkillCreateRequest {
  label: string;
}
```

#### DELETE /api/profile/skills/:id

Delete a skill.

---

### Claims

Claims represent identity attributes: skills, achievements, attributes, education, and certifications.

#### GET /api/v1/claims

List all claims for the current user.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by claim type: `skill`, `achievement`, `attribute`, `education`, `certification` |

**Response:**

```typescript
interface Claim {
  id: string;
  type: 'skill' | 'achievement' | 'attribute' | 'education' | 'certification';
  label: string;
  description: string | null;
  confidence: number | null;
  created_at: string;
  updated_at: string | null;
}
```

#### GET /api/v1/claims/:id

Get a single claim with associated evidence and issues.

**Response:**

```typescript
interface ClaimDetail extends Claim {
  evidence: ClaimEvidence[];
  issues: ClaimIssue[];
}
```

#### PATCH /api/v1/claims/:id

Update a claim.

**Request:**

```typescript
interface ClaimUpdateRequest {
  label?: string;
  description?: string;
  type?: 'skill' | 'achievement' | 'attribute' | 'education' | 'certification';
}
```

#### DELETE /api/v1/claims/:id

Delete a claim. Also deletes associated evidence links and issues.

#### POST /api/v1/claims/:id/dismiss

Dismiss all issues on a claim.

---

### Opportunities

#### GET /api/v1/opportunities

List all opportunities for the current user.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `tracking`, `applied`, `rejected`, `offered`, `negotiating` |

**Response:**

```typescript
interface Opportunity {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
  description: string | null;
  requirements: OpportunityRequirement[] | null;
  status: 'tracking' | 'applied' | 'rejected' | 'offered' | 'negotiating' | null;
  source: string | null;
  location: string | null;
  employment_type: string | null;
  seniority_level: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  posted_date: string | null;
  created_at: string;
  company_research: CompanyResearch | null;
}
```

#### POST /api/v1/opportunities

Create a new opportunity.

**Request:**

```typescript
interface OpportunityCreateRequest {
  url?: string;         // LinkedIn or other job URL
  description?: string; // Job description text
}
```

At least one of `url` or `description` is required. If a LinkedIn URL is provided, the job details will be automatically fetched.

**Response:** Created opportunity with requirement counts.

#### GET /api/v1/opportunities/:id

Get a single opportunity with full details.

#### GET /api/v1/opportunities/:id/match

Get match analysis comparing the opportunity requirements against the user's claims.

**Response:**

```typescript
interface OpportunityMatchResponse {
  data: {
    opportunity: { id: string; title: string; company: string | null };
    scores: {
      overall: number;    // 0-1
      must_have: number;  // 0-1
      nice_to_have: number; // 0-1
    };
    strengths: MatchStrength[];
    gaps: MatchGap[];
  };
}
```

#### POST /api/v1/opportunities/:id/tailor

Generate a tailored profile (resume + narrative) for the opportunity.

**Request:**

```typescript
interface TailorProfileRequest {
  regenerate?: boolean;  // Force regeneration if profile exists
}
```

**Response:**

```typescript
interface TailoredProfile {
  id: string;
  opportunity_id: string;
  narrative: string | null;
  resume_data: ResumeData | null;
  talking_points: string[];
  created_at: string;
  evaluation?: ProfileEvaluation;  // Only on generation
}
```

#### POST /api/v1/opportunities/:id/share

Create a shareable link for the tailored profile.

**Request:**

```typescript
interface ShareProfileRequest {
  expires_in_days?: number;  // Default: 30 days
}
```

**Response:**

```json
{
  "data": {
    "id": "sl-123",
    "token": "abc123xyz",
    "url": "https://app.idynic.com/s/abc123xyz",
    "expires_at": "2024-02-15T00:00:00Z",
    "existing": false
  }
}
```

---

### Documents

#### POST /api/v1/documents/resume

Upload a resume document for processing.

**Request:** `multipart/form-data` with file

**Response:** Document metadata with job ID for tracking processing.

#### POST /api/v1/documents/story

Upload a story/narrative document for processing.

---

### Shared Links

#### GET /api/shared-links

List all shared links for the current user.

#### POST /api/shared-links

Create a new shared link.

#### DELETE /api/shared-links/:id

Revoke a shared link.

### Public Shared Profile

These endpoints are public and require no authentication.

#### GET /api/shared/:token

Get the shared profile data.

**Response:** Profile, opportunity, and tailored profile data.

#### GET /api/v1/shared/:token/summary

Get an AI-generated executive summary of the shared profile.

---

### Account

#### DELETE /api/v1/account

Permanently delete the account and all associated data.

**Request:**

```typescript
interface AccountDeleteRequest {
  password: string;
  confirmation: 'DELETE MY ACCOUNT';  // Must be exactly this string
}
```

#### GET /api/v1/account/export

Export all account data.

---

### Billing

#### GET /api/billing/subscription

Get current subscription status, usage, and limits.

**Response:**

```typescript
interface BillingSubscriptionResponse {
  data: {
    subscription: {
      plan_type: 'free' | 'starter' | 'pro' | 'professional';
      plan_display_name: string;
      status: 'active' | 'canceled' | 'past_due' | 'trialing';
      current_period_start: string;
      current_period_end: string;
      cancel_at_period_end: boolean;
    };
    usage: {
      uploads: number;
      tailored_profiles: number;
      period_start: string;
      period_end: string;
    };
    limits: {
      uploads_per_month?: number;
      tailored_profiles_per_month?: number;
    };
    remaining: {
      uploads?: number;
      tailored_profiles?: number;
    };
    features: string[];
  };
}
```

#### POST /api/billing/create-checkout-session

Create a Stripe checkout session for subscription.

#### POST /api/billing/create-portal-session

Create a Stripe billing portal session for managing subscription.

---

### Usage

#### GET /api/v1/usage

Get API usage statistics.

**Response:**

```typescript
interface UsageResponse {
  data: {
    api_keys: ApiKeyInfo[];
    counts: {
      documents: number;
      opportunities: number;
      active_share_links: number;
    };
  };
}
```

---

### Feedback

#### POST /api/feedback

Submit feedback or bug reports.

**Request:**

```typescript
interface FeedbackRequest {
  title: string;
  description: string;
  type: 'bug' | 'feature' | 'question';
  email?: string;
  url?: string;
  userAgent?: string;
}
```

**Response:**

```json
{
  "success": true,
  "issueNumber": 42,
  "issueUrl": "https://github.com/atriumn/idynic-feedback/issues/42"
}
```

---

## Using the Shared Types

Import types and endpoints from `@idynic/shared`:

```typescript
import {
  // Types
  type ApiResponse,
  type ProfileResponse,
  type Opportunity,
  type Claim,

  // Endpoints
  API_ENDPOINTS,
  ENDPOINT_METHODS,

  // API Client
  createApiClient,
} from '@idynic/shared';

// Create an API client
const api = createApiClient({
  baseUrl: 'https://app.idynic.com',
  getAuthToken: async () => getStoredToken(),
});

// Use typed endpoints
const profile = await api.profile.get();
const opportunities = await api.opportunities.list();
const match = await api.opportunities.match('opp-123');
```

### Type-Safe Fetch Example

```typescript
import { API_ENDPOINTS, type ProfileResponse, type ApiResponse } from '@idynic/shared';

async function getProfile(): Promise<ProfileResponse> {
  const response = await fetch(API_ENDPOINTS.profile.get, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result: ApiResponse<ProfileResponse> = await response.json();
  return result.data;
}
```

## Versioning

The API uses URL versioning (`/api/v1/`). Breaking changes will be introduced in new API versions, allowing clients to migrate gradually.

Current version: **v1**
