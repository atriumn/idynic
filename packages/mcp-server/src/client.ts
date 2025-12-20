// packages/mcp-server/src/client.ts

export interface ApiResponse<T> {
  data: T;
  meta?: {
    request_id?: string;
    count?: number;
    has_more?: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
  };
}

export class IdynicClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = "https://idynic.com/api/v1") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }

    return (data as ApiResponse<T>).data;
  }

  // Profile
  async getProfile() {
    return this.request<ProfileData>("GET", "/profile");
  }

  async updateProfile(updates: ProfileUpdate) {
    return this.request<ProfileData>("PATCH", "/profile", updates);
  }

  // Claims
  async getClaims() {
    return this.request<Claim[]>("GET", "/claims");
  }

  // Opportunities
  async listOpportunities(status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.request<Opportunity[]>("GET", `/opportunities${query}`);
  }

  async getOpportunity(id: string) {
    return this.request<Opportunity>("GET", `/opportunities/${id}`);
  }

  async addOpportunity(data: { url?: string; description: string }) {
    return this.request<Opportunity>("POST", "/opportunities", data);
  }

  async getMatch(id: string) {
    return this.request<MatchAnalysis>("GET", `/opportunities/${id}/match`);
  }

  async getTailoredProfile(id: string) {
    return this.request<TailoredProfile>(
      "GET",
      `/opportunities/${id}/tailored-profile`
    );
  }

  async createShareLink(id: string) {
    return this.request<ShareLink>("POST", `/opportunities/${id}/share`);
  }

  // Work History
  async listWorkHistory() {
    return this.request<WorkHistoryEntry[]>("GET", "/profile/work-history");
  }

  async updateWorkHistory(id: string, updates: WorkHistoryUpdate) {
    return this.request<WorkHistoryEntry>(
      "PATCH",
      `/profile/work-history/${id}`,
      updates
    );
  }

  // SSE endpoints (return raw response for streaming)
  async tailorProfile(id: string): Promise<Response> {
    const url = `${this.baseUrl}/opportunities/${id}/tailor`;
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  async addAndTailor(data: {
    url?: string;
    description: string;
  }): Promise<Response> {
    const url = `${this.baseUrl}/opportunities/add-and-tailor`;
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }

  async addTailorShare(data: {
    url?: string;
    description: string;
  }): Promise<Response> {
    const url = `${this.baseUrl}/opportunities/add-tailor-share`;
    return fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }
}

// Types
export interface ProfileData {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    linkedin_url: string | null;
    github_url: string | null;
    website_url: string | null;
  };
  experience: WorkHistoryEntry[];
  skills: Claim[];
  education: Claim[];
  certifications: Claim[];
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

export interface Claim {
  id: string;
  type: string;
  label: string;
  description: string | null;
  confidence: number;
}

export interface Opportunity {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
  status: string;
  match_score: number | null;
  created_at: string;
}

export interface MatchAnalysis {
  score: number;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

export interface TailoredProfile {
  id: string;
  opportunity_id: string;
  summary: string | null;
  experience: unknown[];
  skills: string[];
  created_at: string;
}

export interface ShareLink {
  token: string;
  url: string;
  expires_at: string | null;
}

export interface WorkHistoryEntry {
  id: string;
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  summary: string | null;
}

export interface WorkHistoryUpdate {
  company?: string;
  title?: string;
  start_date?: string;
  end_date?: string | null;
  summary?: string | null;
}
