// chrome-extension/popup/popup.js

// State elements
const states = {
  unconfigured: document.getElementById('state-unconfigured'),
  ready: document.getElementById('state-ready'),
  saving: document.getElementById('state-saving'),
  success: document.getElementById('state-success'),
  duplicate: document.getElementById('state-duplicate'),
  error: document.getElementById('state-error'),
};

// UI elements
const currentUrlEl = document.getElementById('current-url');
const jobTitleEl = document.getElementById('job-title');
const jobCompanyEl = document.getElementById('job-company');
const dupJobTitleEl = document.getElementById('dup-job-title');
const dupJobCompanyEl = document.getElementById('dup-job-company');
const viewLinkEl = document.getElementById('view-link');
const dupViewLinkEl = document.getElementById('dup-view-link');
const errorTitleEl = document.getElementById('error-title');
const errorMessageEl = document.getElementById('error-message');
const fallbackSection = document.getElementById('fallback-section');
const fallbackDescription = document.getElementById('fallback-description');

// Current tab URL
let currentUrl = '';

/**
 * Show a specific state, hide others
 */
function showState(stateName) {
  Object.keys(states).forEach(key => {
    states[key].classList.toggle('hidden', key !== stateName);
  });
}

/**
 * Get the base URL for Idynic
 */
function getIdynicUrl() {
  return IdynicApi.getApiBase();
}

/**
 * Truncate URL for display
 */
function truncateUrl(url, maxLength = 40) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

/**
 * Initialize popup
 */
async function init() {
  // Check if API key is configured
  const apiKey = await IdynicApi.getApiKey();

  if (!apiKey) {
    showState('unconfigured');
    return;
  }

  // Get current tab URL
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentUrl = tab?.url || '';

  if (!currentUrl || currentUrl.startsWith('chrome://')) {
    showState('error');
    errorTitleEl.textContent = 'Not a job page';
    errorMessageEl.textContent = 'Navigate to a job posting to save it.';
    document.getElementById('show-fallback').classList.add('hidden');
    return;
  }

  // Show ready state with URL
  currentUrlEl.textContent = truncateUrl(currentUrl);
  showState('ready');
}

/**
 * Save the current job
 */
async function saveJob(description = null) {
  showState('saving');

  const result = await IdynicApi.saveOpportunity(currentUrl, description);

  if (result.success) {
    // Success!
    jobTitleEl.textContent = result.data.title || 'Job';
    jobCompanyEl.textContent = result.data.company ? `at ${result.data.company}` : '';
    viewLinkEl.href = `${getIdynicUrl()}/opportunities/${result.data.id}`;
    showState('success');
    return;
  }

  // Handle specific errors
  if (result.error.code === 'duplicate') {
    dupJobTitleEl.textContent = result.existing?.title || 'Job';
    dupJobCompanyEl.textContent = result.existing?.company ? `at ${result.existing.company}` : '';
    dupViewLinkEl.href = `${getIdynicUrl()}/opportunities/${result.existing?.id}`;
    showState('duplicate');
    return;
  }

  if (result.error.code === 'unauthorized') {
    showState('unconfigured');
    return;
  }

  if (result.error.code === 'scraping_failed') {
    errorTitleEl.textContent = "Couldn't extract job";
    errorMessageEl.textContent = result.error.message;
    document.getElementById('show-fallback').classList.remove('hidden');
    showState('error');
    return;
  }

  // Generic error
  errorTitleEl.textContent = 'Something went wrong';
  errorMessageEl.textContent = result.error.message;
  document.getElementById('show-fallback').classList.add('hidden');
  document.getElementById('retry-btn').classList.remove('hidden');
  showState('error');
}

// Event listeners
document.getElementById('open-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('save-btn').addEventListener('click', () => {
  saveJob();
});

document.getElementById('show-fallback').addEventListener('click', () => {
  fallbackSection.classList.remove('hidden');
  document.getElementById('show-fallback').classList.add('hidden');
  fallbackDescription.focus();
});

document.getElementById('save-with-text').addEventListener('click', () => {
  const description = fallbackDescription.value.trim();
  if (!description) {
    fallbackDescription.focus();
    return;
  }
  saveJob(description);
});

document.getElementById('retry-btn').addEventListener('click', () => {
  saveJob();
});

// Initialize on load
init();
