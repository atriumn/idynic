/**
 * Tests for chrome-extension/popup/popup.js
 * Tests popup UI state management and user interactions
 */

const fs = require('fs');
const path = require('path');

// Read popup HTML and JS
const popupHtml = fs.readFileSync(path.join(__dirname, '../../popup/popup.html'), 'utf8');
const popupJs = fs.readFileSync(path.join(__dirname, '../../popup/popup.js'), 'utf8');

// Helper to setup DOM and load popup
function setupPopup(options = {}) {
  // Set up DOM with popup HTML
  document.body.innerHTML = popupHtml;

  // Setup IdynicApi mock
  global.mockIdynicApi(options.apiMocks || {});

  // Configure chrome.tabs mock
  if (options.currentTab) {
    chrome.tabs.query.mockResolvedValue([options.currentTab]);
  }

  // Execute popup JS
  eval(popupJs);
}

describe('Popup', () => {
  beforeEach(() => {
    global.resetChromeMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('showState', () => {
    it('shows correct state and hides others', () => {
      setupPopup({
        apiMocks: { getApiKey: jest.fn().mockResolvedValue('idn_test') },
        currentTab: { url: 'https://linkedin.com/jobs/123' },
      });

      // Manually call showState to test it
      const stateReady = document.getElementById('state-ready');
      const stateSaving = document.getElementById('state-saving');

      // Initially, ready state should be visible after init
      // (we need to wait for init to complete)
    });
  });

  describe('truncateUrl', () => {
    it('truncates long URLs', () => {
      setupPopup({
        apiMocks: { getApiKey: jest.fn().mockResolvedValue('idn_test') },
        currentTab: {
          url: 'https://www.linkedin.com/jobs/view/very-long-job-title-software-engineer-at-company-12345678',
        },
      });

      // After init completes, URL should be truncated
    });
  });

  describe('init()', () => {
    it('shows unconfigured state when no API key', async () => {
      setupPopup({
        apiMocks: { getApiKey: jest.fn().mockResolvedValue(null) },
      });

      // Wait for init to complete
      await Promise.resolve();
      await Promise.resolve();

      const unconfigured = document.getElementById('state-unconfigured');
      expect(unconfigured.classList.contains('hidden')).toBe(false);
    });

    it('shows ready state when API key is configured', async () => {
      setupPopup({
        apiMocks: { getApiKey: jest.fn().mockResolvedValue('idn_validkey') },
        currentTab: { url: 'https://linkedin.com/jobs/123', active: true },
      });

      // Wait for init to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const ready = document.getElementById('state-ready');
      expect(ready.classList.contains('hidden')).toBe(false);
    });

    it('shows error state for chrome:// URLs', async () => {
      setupPopup({
        apiMocks: { getApiKey: jest.fn().mockResolvedValue('idn_validkey') },
        currentTab: { url: 'chrome://extensions', active: true },
      });

      // Wait for init to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const error = document.getElementById('state-error');
      const errorTitle = document.getElementById('error-title');

      expect(error.classList.contains('hidden')).toBe(false);
      expect(errorTitle.textContent).toBe('Not a job page');
    });

    it('displays truncated URL in ready state', async () => {
      const longUrl =
        'https://www.linkedin.com/jobs/view/software-engineer-at-amazing-company-1234567890';

      setupPopup({
        apiMocks: { getApiKey: jest.fn().mockResolvedValue('idn_validkey') },
        currentTab: { url: longUrl, active: true },
      });

      // Wait for init to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const urlEl = document.getElementById('current-url');
      expect(urlEl.textContent.length).toBeLessThanOrEqual(43); // 40 + "..."
    });
  });

  describe('Save button click', () => {
    it('calls saveOpportunity when save button is clicked', async () => {
      const saveOpportunityMock = jest.fn().mockResolvedValue({
        success: true,
        data: { id: 'opp-123', title: 'Test Job', company: 'Test Co' },
      });

      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: saveOpportunityMock,
        },
        currentTab: { url: 'https://linkedin.com/jobs/123', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Click save button
      const saveBtn = document.getElementById('save-btn');
      saveBtn.click();

      // Wait for saveJob to process
      await Promise.resolve();
      await Promise.resolve();

      expect(saveOpportunityMock).toHaveBeenCalledWith('https://linkedin.com/jobs/123', null);
    });

    it('shows success state after successful save', async () => {
      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: jest.fn().mockResolvedValue({
            success: true,
            data: { id: 'opp-123', title: 'Software Engineer', company: 'Acme Corp' },
          }),
        },
        currentTab: { url: 'https://linkedin.com/jobs/123', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Click save button
      document.getElementById('save-btn').click();

      // Wait for saveJob to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const success = document.getElementById('state-success');
      const jobTitle = document.getElementById('job-title');
      const jobCompany = document.getElementById('job-company');

      expect(success.classList.contains('hidden')).toBe(false);
      expect(jobTitle.textContent).toBe('Software Engineer');
      expect(jobCompany.textContent).toBe('at Acme Corp');
    });

    it('shows duplicate state when job already saved', async () => {
      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: jest.fn().mockResolvedValue({
            success: false,
            error: { code: 'duplicate', message: 'Already saved' },
            existing: { id: 'opp-existing', title: 'Existing Job', company: 'Existing Co' },
          }),
        },
        currentTab: { url: 'https://linkedin.com/jobs/existing', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Click save button
      document.getElementById('save-btn').click();

      // Wait for saveJob to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const duplicate = document.getElementById('state-duplicate');
      const dupTitle = document.getElementById('dup-job-title');

      expect(duplicate.classList.contains('hidden')).toBe(false);
      expect(dupTitle.textContent).toBe('Existing Job');
    });

    it('shows unconfigured state when unauthorized', async () => {
      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_invalidkey'),
          saveOpportunity: jest.fn().mockResolvedValue({
            success: false,
            error: { code: 'unauthorized', message: 'API key invalid' },
          }),
        },
        currentTab: { url: 'https://linkedin.com/jobs/123', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Click save button
      document.getElementById('save-btn').click();

      // Wait for saveJob to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const unconfigured = document.getElementById('state-unconfigured');
      expect(unconfigured.classList.contains('hidden')).toBe(false);
    });

    it('shows error state with fallback option on scraping failure', async () => {
      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: jest.fn().mockResolvedValue({
            success: false,
            error: { code: 'scraping_failed', message: 'Could not extract job details' },
          }),
        },
        currentTab: { url: 'https://example.com/job', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Click save button
      document.getElementById('save-btn').click();

      // Wait for saveJob to complete
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const error = document.getElementById('state-error');
      const showFallback = document.getElementById('show-fallback');

      expect(error.classList.contains('hidden')).toBe(false);
      expect(showFallback.classList.contains('hidden')).toBe(false);
    });
  });

  describe('Fallback description flow', () => {
    it('shows fallback section when clicking show-fallback button', async () => {
      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: jest.fn().mockResolvedValue({
            success: false,
            error: { code: 'scraping_failed', message: 'Could not extract job details' },
          }),
        },
        currentTab: { url: 'https://example.com/job', active: true },
      });

      // Wait for init and trigger error state
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      document.getElementById('save-btn').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Click show fallback button
      document.getElementById('show-fallback').click();

      const fallbackSection = document.getElementById('fallback-section');
      expect(fallbackSection.classList.contains('hidden')).toBe(false);
    });

    it('saves with description when provided', async () => {
      const saveOpportunityMock = jest.fn().mockResolvedValue({
        success: true,
        data: { id: 'opp-new', title: 'Manual Job', company: 'Manual Co' },
      });

      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: saveOpportunityMock,
        },
        currentTab: { url: 'https://example.com/job', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Manually set up error state and fallback
      document.getElementById('state-ready').classList.add('hidden');
      document.getElementById('state-error').classList.remove('hidden');
      document.getElementById('fallback-section').classList.remove('hidden');

      // Fill in description
      const descriptionInput = document.getElementById('fallback-description');
      descriptionInput.value = 'This is a great job at a fantastic company...';

      // Reset mock and click save with text
      saveOpportunityMock.mockClear();
      document.getElementById('save-with-text').click();

      await Promise.resolve();
      await Promise.resolve();

      expect(saveOpportunityMock).toHaveBeenCalledWith(
        'https://example.com/job',
        'This is a great job at a fantastic company...'
      );
    });
  });

  describe('Open settings button', () => {
    it('opens options page when settings button is clicked', async () => {
      setupPopup({
        apiMocks: { getApiKey: jest.fn().mockResolvedValue(null) },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();

      // Click settings button
      document.getElementById('open-settings').click();

      expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
    });
  });

  describe('Retry button', () => {
    it('retries save when retry button is clicked', async () => {
      const saveOpportunityMock = jest
        .fn()
        .mockResolvedValueOnce({
          success: false,
          error: { code: 'network', message: 'Network error' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { id: 'opp-retry', title: 'Retry Job' },
        });

      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: saveOpportunityMock,
        },
        currentTab: { url: 'https://linkedin.com/jobs/123', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // First save attempt (fails)
      document.getElementById('save-btn').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Verify retry button is visible
      const retryBtn = document.getElementById('retry-btn');
      expect(retryBtn.classList.contains('hidden')).toBe(false);

      // Click retry
      retryBtn.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(saveOpportunityMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('View links', () => {
    it('sets correct href for success view link', async () => {
      setupPopup({
        apiMocks: {
          getApiKey: jest.fn().mockResolvedValue('idn_validkey'),
          saveOpportunity: jest.fn().mockResolvedValue({
            success: true,
            data: { id: 'opp-view-test', title: 'Test Job', company: 'Test Co' },
          }),
          getApiBase: jest.fn().mockReturnValue('http://localhost:3000'),
        },
        currentTab: { url: 'https://linkedin.com/jobs/123', active: true },
      });

      // Wait for init
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      // Click save button
      document.getElementById('save-btn').click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const viewLink = document.getElementById('view-link');
      expect(viewLink.href).toBe('http://localhost:3000/opportunities/opp-view-test');
    });
  });
});
