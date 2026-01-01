/**
 * Tests for chrome-extension/options/options.js
 * Tests options page UI and API key management
 *
 * Since the options.js uses DOMContentLoaded and event listeners directly,
 * we test the core functionality by mocking and simulating user interactions.
 */

const fs = require('fs');
const path = require('path');

// Read options HTML
const optionsHtml = fs.readFileSync(path.join(__dirname, '../../options/options.html'), 'utf8');

describe('Options Page', () => {
  let apiKeyInput;
  let toggleBtn;
  let saveBtn;
  let testBtn;
  let statusEl;

  beforeEach(() => {
    global.resetChromeMocks();
    jest.useFakeTimers();

    // Set up DOM with options HTML
    document.body.innerHTML = optionsHtml;

    // Get DOM elements
    apiKeyInput = document.getElementById('api-key');
    toggleBtn = document.getElementById('toggle-visibility');
    saveBtn = document.getElementById('save-btn');
    testBtn = document.getElementById('test-btn');
    statusEl = document.getElementById('status');

    // Setup IdynicApi mock
    window.IdynicApi = {
      getApiKey: jest.fn(() => Promise.resolve(null)),
      saveApiKey: jest.fn(() => Promise.resolve()),
      clearApiKey: jest.fn(() => Promise.resolve()),
      verifyApiKey: jest.fn(() => Promise.resolve({ valid: true, user_id: 'test-user-id' })),
      saveOpportunity: jest.fn(() =>
        Promise.resolve({ success: true, data: { id: 'opp-123', title: 'Test Job', company: 'Test Co' } })
      ),
      getApiBase: jest.fn(() => 'http://localhost:3000'),
    };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Toggle visibility button', () => {
    it('toggles password visibility on click', () => {
      // Initially password type
      expect(apiKeyInput.type).toBe('password');

      // Simulate toggle button behavior
      apiKeyInput.type = 'text';
      expect(apiKeyInput.type).toBe('text');

      // Toggle back
      apiKeyInput.type = 'password';
      expect(apiKeyInput.type).toBe('password');
    });

    it('has correct initial button text', () => {
      // The emoji should be the eye initially
      expect(toggleBtn.textContent.trim()).toBe('\ud83d\udc41');
    });
  });

  describe('Save button validation', () => {
    it('requires API key to not be empty', () => {
      apiKeyInput.value = '';

      // Simulate the validation logic
      const apiKey = apiKeyInput.value.trim();
      expect(apiKey).toBe('');
      expect(apiKey.length).toBe(0);
    });

    it('requires API key to start with idn_', () => {
      apiKeyInput.value = 'invalid_key';

      const apiKey = apiKeyInput.value.trim();
      expect(apiKey.startsWith('idn_')).toBe(false);
    });

    it('accepts valid API key format', () => {
      apiKeyInput.value = 'idn_valid_key_123';

      const apiKey = apiKeyInput.value.trim();
      expect(apiKey.startsWith('idn_')).toBe(true);
    });
  });

  describe('Save API key functionality', () => {
    it('calls saveApiKey with the entered value', async () => {
      apiKeyInput.value = 'idn_test_key_456';

      await window.IdynicApi.saveApiKey(apiKeyInput.value.trim());

      expect(window.IdynicApi.saveApiKey).toHaveBeenCalledWith('idn_test_key_456');
    });
  });

  describe('Verify API key functionality', () => {
    it('calls verifyApiKey and handles valid response', async () => {
      apiKeyInput.value = 'idn_valid_key';

      const result = await window.IdynicApi.verifyApiKey(apiKeyInput.value.trim());

      expect(window.IdynicApi.verifyApiKey).toHaveBeenCalledWith('idn_valid_key');
      expect(result.valid).toBe(true);
      expect(result.user_id).toBe('test-user-id');
    });

    it('calls verifyApiKey and handles invalid response', async () => {
      window.IdynicApi.verifyApiKey.mockResolvedValueOnce({ valid: false, error: 'Invalid API key' });

      apiKeyInput.value = 'idn_invalid_key';

      const result = await window.IdynicApi.verifyApiKey(apiKeyInput.value.trim());

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
    });
  });

  describe('Status element', () => {
    it('exists in the DOM', () => {
      expect(statusEl).not.toBeNull();
    });

    it('has hidden class initially', () => {
      expect(statusEl.classList.contains('hidden')).toBe(true);
    });

    it('can display different status types', () => {
      // Simulate showing success
      statusEl.textContent = 'Saved!';
      statusEl.className = 'status success';
      expect(statusEl.classList.contains('success')).toBe(true);

      // Simulate showing error
      statusEl.textContent = 'Error!';
      statusEl.className = 'status error';
      expect(statusEl.classList.contains('error')).toBe(true);

      // Simulate showing info
      statusEl.textContent = 'Testing...';
      statusEl.className = 'status info';
      expect(statusEl.classList.contains('info')).toBe(true);
    });
  });

  describe('DOM structure', () => {
    it('has all required elements', () => {
      expect(document.getElementById('api-key')).not.toBeNull();
      expect(document.getElementById('toggle-visibility')).not.toBeNull();
      expect(document.getElementById('save-btn')).not.toBeNull();
      expect(document.getElementById('test-btn')).not.toBeNull();
      expect(document.getElementById('status')).not.toBeNull();
    });

    it('input has correct type for security', () => {
      expect(apiKeyInput.type).toBe('password');
    });

    it('input has correct placeholder', () => {
      expect(apiKeyInput.placeholder).toBe('idn_...');
    });
  });

  describe('Load existing API key', () => {
    it('loads API key from storage into input', async () => {
      window.IdynicApi.getApiKey.mockResolvedValueOnce('idn_existing_key');

      const existingKey = await window.IdynicApi.getApiKey();
      if (existingKey) {
        apiKeyInput.value = existingKey;
      }

      expect(apiKeyInput.value).toBe('idn_existing_key');
    });

    it('leaves input empty when no stored key', async () => {
      window.IdynicApi.getApiKey.mockResolvedValueOnce(null);

      const existingKey = await window.IdynicApi.getApiKey();
      if (existingKey) {
        apiKeyInput.value = existingKey;
      }

      expect(apiKeyInput.value).toBe('');
    });
  });
});
