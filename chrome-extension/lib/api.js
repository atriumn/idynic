// chrome-extension/lib/api.js

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const API_BASE_PROD = 'https://idynic.com';
const API_BASE_DEV = 'http://localhost:3000';

/**
 * Get the API base URL (dev or prod)
 * Toggle this for local development vs production
 */
function getApiBase() {
  return API_BASE_DEV; // Switch to API_BASE_PROD for production
}

/**
 * Get stored API key from chrome.storage
 */
async function getApiKey() {
  const result = await chrome.storage.local.get('apiKey');
  return result.apiKey || null;
}

/**
 * Save API key to chrome.storage
 */
async function saveApiKey(apiKey) {
  await chrome.storage.local.set({ apiKey });
}

/**
 * Clear stored API key
 */
async function clearApiKey() {
  await chrome.storage.local.remove('apiKey');
}

/**
 * Verify API key is valid
 * @returns {Promise<{valid: boolean, user_id?: string, error?: string}>}
 */
async function verifyApiKey(apiKey) {
  try {
    const response = await fetch(`${getApiBase()}/api/v1/auth/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return { valid: true, user_id: data.data.user_id };
    }

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }

    return { valid: false, error: 'Connection error' };
  } catch {
    return { valid: false, error: 'Network error - check your connection' };
  }
}

/**
 * Save an opportunity
 * @param {string} url - The job posting URL
 * @param {string|null} description - Optional job description
 * @returns {Promise<{success: boolean, data?: object, error?: {code: string, message: string}}>}
 */
async function saveOpportunity(url, description = null) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    return { success: false, error: { code: 'no_api_key', message: 'API key not configured' } };
  }

  try {
    const body = { url };
    if (description) {
      body.description = description;
    }

    const response = await fetch(`${getApiBase()}/api/v1/opportunities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data: data.data };
    }

    // Handle specific error codes
    if (response.status === 409) {
      return {
        success: false,
        error: { code: 'duplicate', message: 'Already saved' },
        existing: data.data?.existing,
      };
    }

    if (response.status === 401) {
      return { success: false, error: { code: 'unauthorized', message: 'API key invalid' } };
    }

    if (response.status === 400 && data.error?.code === 'scraping_failed') {
      return { success: false, error: { code: 'scraping_failed', message: data.error.message } };
    }

    return { success: false, error: { code: 'unknown', message: data.error?.message || 'Unknown error' } };
  } catch {
    return { success: false, error: { code: 'network', message: 'Network error - try again' } };
  }
}

// Export for use in popup and options
window.IdynicApi = {
  getApiKey,
  saveApiKey,
  clearApiKey,
  verifyApiKey,
  saveOpportunity,
  getApiBase,
};
