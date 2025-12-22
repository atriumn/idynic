const TAVILY_API_URL = 'https://api.tavily.com/search';

export interface TavilySearchParams {
  query: string;
  topic?: 'general' | 'news' | 'finance';
  search_depth?: 'basic' | 'advanced';
  max_results?: number;
  time_range?: 'day' | 'week' | 'month' | 'year';
  include_answer?: boolean;
}

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
}

/**
 * Search using Tavily API
 */
export async function searchTavily(params: TavilySearchParams): Promise<TavilyResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY not configured');
  }

  const response = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: apiKey,
      query: params.query,
      topic: params.topic || 'general',
      search_depth: params.search_depth || 'basic',
      max_results: params.max_results || 5,
      time_range: params.time_range,
      include_answer: params.include_answer || false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Tavily API error: ${response.status} - ${error}`);
  }

  return response.json();
}
