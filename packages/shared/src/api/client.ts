export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string | null>;
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getAuthToken } = config;

  async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const token = await getAuthToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  return {
    profile: {
      get: () => fetchWithAuth('/api/v1/profile'),
      update: (data: unknown) => fetchWithAuth('/api/v1/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    },

    opportunities: {
      list: () => fetchWithAuth('/api/v1/opportunities'),
      get: (id: string) => fetchWithAuth(`/api/v1/opportunities/${id}`),
      match: (id: string) => fetchWithAuth(`/api/v1/opportunities/${id}/match`),
      tailor: (id: string) => fetchWithAuth(`/api/v1/opportunities/${id}/tailor`, {
        method: 'POST',
      }),
    },

    // Note: sharedLinks endpoints may not work with API key auth (uses cookie-based auth in web app)
    sharedLinks: {
      list: () => fetchWithAuth('/api/shared-links'),
      create: (data: unknown) => fetchWithAuth('/api/shared-links', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
      delete: (id: string) => fetchWithAuth(`/api/shared-links/${id}`, {
        method: 'DELETE',
      }),
    },

    claims: {
      list: () => fetchWithAuth('/api/v1/claims'),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
