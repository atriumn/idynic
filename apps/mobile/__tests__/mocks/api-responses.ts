import type { Profile, IdentityReflection } from "../../hooks/use-profile";
import type {
  GroupedClaims,
  IdentityClaim,
  Evidence,
} from "../../hooks/use-identity-claims";
import type { Opportunity } from "../../hooks/use-opportunities";

// Mock user session
export const mockSession = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "user-123",
    email: "test@example.com",
    aud: "authenticated",
    role: "authenticated",
    created_at: "2024-01-01T00:00:00Z",
    app_metadata: {},
    user_metadata: {},
  },
};

export const mockUser = mockSession.user;

// Mock evidence
export const mockEvidence: Evidence[] = [
  {
    id: "ev-1",
    text: "Led a team of 5 engineers to deliver project on time",
    evidence_type: "work",
    source_type: "resume",
    evidence_date: "2023-06-15",
    document: {
      id: "doc-1",
      filename: "resume.pdf",
      type: "resume",
      created_at: "2024-01-01T00:00:00Z",
    },
  },
  {
    id: "ev-2",
    text: "Implemented TypeScript migration for 50k LOC codebase",
    evidence_type: "work",
    source_type: "story",
    evidence_date: "2023-03-01",
    document: {
      id: "doc-2",
      filename: "Building My Startup",
      type: "story",
      created_at: "2024-01-15T00:00:00Z",
    },
  },
];

// Mock identity claims
export const mockIdentityClaim: IdentityClaim = {
  id: "claim-1",
  type: "skill",
  label: "TypeScript",
  description: "Strong proficiency in TypeScript development",
  confidence: 0.95,
  evidence: mockEvidence,
  issues: [],
};

export const mockGroupedClaims: GroupedClaims = {
  skill: [
    {
      id: "claim-1",
      type: "skill",
      label: "TypeScript",
      description: "Strong proficiency in TypeScript",
      confidence: 0.95,
      evidence: [mockEvidence[0]],
      issues: [],
    },
    {
      id: "claim-2",
      type: "skill",
      label: "React",
      description: "Expert in React and React Native",
      confidence: 0.9,
      evidence: [mockEvidence[1]],
      issues: [],
    },
  ],
  achievement: [
    {
      id: "claim-3",
      type: "achievement",
      label: "Successful Product Launch",
      description: "Led team to launch product with 10k users",
      confidence: 0.85,
      evidence: [],
      issues: [],
    },
  ],
  attribute: [
    {
      id: "claim-4",
      type: "attribute",
      label: "Leadership",
      description: "Strong leadership and mentoring skills",
      confidence: 0.8,
      evidence: [],
      issues: [],
    },
  ],
  education: [],
  certification: [],
};

export const mockEmptyGroupedClaims: GroupedClaims = {
  skill: [],
  achievement: [],
  attribute: [],
  education: [],
  certification: [],
};

// Mock identity reflection
export const mockIdentityReflection: IdentityReflection = {
  archetype: "Technical Leader",
  headline: "Senior Software Engineer with 10+ years experience",
  bio: "Passionate about building scalable systems and mentoring teams.",
  keywords: ["TypeScript", "React", "Node.js", "AWS"],
  matches: ["Senior Engineer", "Tech Lead", "Staff Engineer"],
  generated_at: "2024-01-15T10:00:00Z",
};

// Mock profile
export const mockProfile: Profile = {
  contact: {
    name: "John Doe",
    email: "john@example.com",
    phone: "+1-555-123-4567",
    location: "San Francisco, CA",
    linkedin: "https://linkedin.com/in/johndoe",
    github: "https://github.com/johndoe",
    website: "https://johndoe.dev",
    logo_url: null,
  },
  identity: mockIdentityReflection,
  workHistory: [
    {
      id: "wh-1",
      company: "Acme Corp",
      title: "Senior Software Engineer",
      start_date: "2020-01-01",
      end_date: null,
      location: "San Francisco, CA",
      summary: "Leading frontend team and architecting solutions",
    },
    {
      id: "wh-2",
      company: "Startup Inc",
      title: "Software Engineer",
      start_date: "2018-03-01",
      end_date: "2019-12-31",
      location: "Remote",
      summary: "Built core product features",
    },
  ],
  ventures: [],
  skills: [
    { id: "skill-1", label: "TypeScript", description: null, confidence: 0.95 },
    { id: "skill-2", label: "React", description: null, confidence: 0.9 },
  ],
  education: [
    {
      id: "edu-1",
      text: "BS Computer Science, Stanford University",
      context: {},
    },
  ],
};

export const mockEmptyProfile: Profile = {
  contact: {
    name: null,
    email: null,
    phone: null,
    location: null,
    linkedin: null,
    github: null,
    website: null,
    logo_url: null,
  },
  identity: null,
  workHistory: [],
  ventures: [],
  skills: [],
  education: [],
};

// Mock opportunities
export const mockOpportunity: Opportunity = {
  id: "opp-1",
  title: "Senior Software Engineer",
  company: "Tech Corp",
  company_logo_url: "https://example.com/logo.png",
  company_url: "https://techcorp.com",
  location: "San Francisco, CA",
  employment_type: "full-time",
  status: "active",
  requirements: {
    mustHave: ["5+ years experience", "TypeScript expertise"],
    niceToHave: ["AWS certification", "Team lead experience"],
  },
  created_at: "2024-01-10T12:00:00Z",
};

export const mockOpportunities: Opportunity[] = [
  mockOpportunity,
  {
    id: "opp-2",
    title: "Frontend Developer",
    company: "Startup XYZ",
    company_logo_url: null,
    company_url: null,
    location: "Remote",
    employment_type: "contract",
    status: "applied",
    requirements: {
      mustHave: ["React experience"],
      niceToHave: [],
    },
    created_at: "2024-01-05T09:00:00Z",
  },
];

// Helper to create Supabase-like response
export function createSupabaseResponse<T>(
  data: T,
  error: null,
): { data: T; error: null };
export function createSupabaseResponse<T>(
  data: null,
  error: { message: string; code?: string },
): { data: null; error: { message: string; code?: string } };
export function createSupabaseResponse<T>(
  data: T | null,
  error: { message: string; code?: string } | null,
) {
  return { data, error };
}
