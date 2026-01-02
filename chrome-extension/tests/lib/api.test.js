/**
 * Tests for chrome-extension/lib/api.js
 * Tests API client functions: getApiKey, saveApiKey, verifyApiKey, saveOpportunity
 */

// Load the API module
const fs = require('fs');
const path = require('path');
const apiCode = fs.readFileSync(path.join(__dirname, '../../lib/api.js'), 'utf8');

// Execute the API code to get window.IdynicApi
beforeEach(() => {
  // Reset chrome storage mock
  global.resetChromeMocks();

  // Reset fetch mock
  global.fetch = jest.fn();

  // Execute the API code to create IdynicApi
  eval(apiCode);
});

describe('IdynicApi', () => {
  describe('getApiBase', () => {
    it('returns the API base URL', () => {
      expect(window.IdynicApi.getApiBase()).toBe('http://localhost:3000');
    });
  });

  describe('getApiKey', () => {
    it('returns null when no API key is stored', async () => {
      const result = await window.IdynicApi.getApiKey();
      expect(result).toBeNull();
      expect(chrome.storage.local.get).toHaveBeenCalledWith('apiKey');
    });

    it('returns the stored API key', async () => {
      chrome.storage.local._data.apiKey = 'idn_test123';

      const result = await window.IdynicApi.getApiKey();

      expect(result).toBe('idn_test123');
    });
  });

  describe('saveApiKey', () => {
    it('saves API key to chrome.storage.local', async () => {
      await window.IdynicApi.saveApiKey('idn_newkey');

      expect(chrome.storage.local.set).toHaveBeenCalledWith({ apiKey: 'idn_newkey' });
      expect(chrome.storage.local._data.apiKey).toBe('idn_newkey');
    });
  });

  describe('clearApiKey', () => {
    it('removes API key from chrome.storage.local', async () => {
      chrome.storage.local._data.apiKey = 'idn_oldkey';

      await window.IdynicApi.clearApiKey();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith('apiKey');
      expect(chrome.storage.local._data.apiKey).toBeUndefined();
    });
  });

  describe('verifyApiKey', () => {
    it('returns valid:true when API key is valid', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { user_id: 'user-123' } }),
      });

      const result = await window.IdynicApi.verifyApiKey('idn_validkey');

      expect(result).toEqual({ valid: true, user_id: 'user-123' });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/auth/verify',
        expect.objectContaining({
          method: 'GET',
          headers: { Authorization: 'Bearer idn_validkey' },
        })
      );
    });

    it('returns valid:false with error for 401 response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await window.IdynicApi.verifyApiKey('idn_invalidkey');

      expect(result).toEqual({ valid: false, error: 'Invalid API key' });
    });

    it('returns valid:false with connection error for other status codes', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await window.IdynicApi.verifyApiKey('idn_testkey');

      expect(result).toEqual({ valid: false, error: 'Connection error' });
    });

    it('returns valid:false with network error on fetch failure', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await window.IdynicApi.verifyApiKey('idn_testkey');

      expect(result).toEqual({ valid: false, error: 'Network error - check your connection' });
    });
  });

  describe('saveOpportunity', () => {
    beforeEach(() => {
      // Set up a valid API key
      chrome.storage.local._data.apiKey = 'idn_validkey';
    });

    it('returns error when no API key is configured', async () => {
      chrome.storage.local._data = {}; // Clear API key

      const result = await window.IdynicApi.saveOpportunity('https://example.com/job');

      expect(result).toEqual({
        success: false,
        error: { code: 'no_api_key', message: 'API key not configured' },
      });
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('successfully saves an opportunity', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: { id: 'opp-123', title: 'Software Engineer', company: 'Acme Corp' },
          }),
      });

      const result = await window.IdynicApi.saveOpportunity('https://linkedin.com/jobs/123');

      expect(result).toEqual({
        success: true,
        data: { id: 'opp-123', title: 'Software Engineer', company: 'Acme Corp' },
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/opportunities',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer idn_validkey',
          },
          body: JSON.stringify({ url: 'https://linkedin.com/jobs/123' }),
        })
      );
    });

    it('includes description in request body when provided', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 'opp-456' } }),
      });

      await window.IdynicApi.saveOpportunity(
        'https://linkedin.com/jobs/456',
        'Great job opportunity!'
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            url: 'https://linkedin.com/jobs/456',
            description: 'Great job opportunity!',
          }),
        })
      );
    });

    it('handles duplicate opportunity (409 response)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: () =>
          Promise.resolve({
            data: { existing: { id: 'opp-existing', title: 'Existing Job', company: 'Existing Co' } },
          }),
      });

      const result = await window.IdynicApi.saveOpportunity('https://linkedin.com/jobs/existing');

      expect(result).toEqual({
        success: false,
        error: { code: 'duplicate', message: 'Already saved' },
        existing: { id: 'opp-existing', title: 'Existing Job', company: 'Existing Co' },
      });
    });

    it('handles unauthorized error (401 response)', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Unauthorized' } }),
      });

      const result = await window.IdynicApi.saveOpportunity('https://linkedin.com/jobs/789');

      expect(result).toEqual({
        success: false,
        error: { code: 'unauthorized', message: 'API key invalid' },
      });
    });

    it('handles scraping failed error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({
            error: { code: 'scraping_failed', message: 'Could not extract job details' },
          }),
      });

      const result = await window.IdynicApi.saveOpportunity('https://example.com/job');

      expect(result).toEqual({
        success: false,
        error: { code: 'scraping_failed', message: 'Could not extract job details' },
      });
    });

    it('handles unknown errors', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: { message: 'Internal server error' } }),
      });

      const result = await window.IdynicApi.saveOpportunity('https://example.com/job');

      expect(result).toEqual({
        success: false,
        error: { code: 'unknown', message: 'Internal server error' },
      });
    });

    it('handles network errors', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await window.IdynicApi.saveOpportunity('https://example.com/job');

      expect(result).toEqual({
        success: false,
        error: { code: 'network', message: 'Network error - try again' },
      });
    });
  });
});
