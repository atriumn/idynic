// chrome-extension/options/options.js

document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('api-key');
  const toggleBtn = document.getElementById('toggle-visibility');
  const saveBtn = document.getElementById('save-btn');
  const testBtn = document.getElementById('test-btn');
  const statusEl = document.getElementById('status');

  // Load existing API key
  const existingKey = await IdynicApi.getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
  }

  // Toggle password visibility
  toggleBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleBtn.textContent = '🙈';
    } else {
      apiKeyInput.type = 'password';
      toggleBtn.textContent = '👁';
    }
  });

  // Show status message
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  // Save API key
  saveBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key', 'error');
      return;
    }

    if (!apiKey.startsWith('idn_')) {
      showStatus('API key should start with "idn_"', 'error');
      return;
    }

    await IdynicApi.saveApiKey(apiKey);
    showStatus('Saved!', 'success');

    // Clear success message after 2 seconds
    setTimeout(() => {
      statusEl.className = 'status hidden';
    }, 2000);
  });

  // Test connection
  testBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showStatus('Please enter an API key first', 'error');
      return;
    }

    showStatus('Testing connection...', 'info');
    testBtn.disabled = true;

    const result = await IdynicApi.verifyApiKey(apiKey);

    testBtn.disabled = false;

    if (result.valid) {
      showStatus('Connection successful!', 'success');
    } else {
      showStatus(result.error || 'Connection failed', 'error');
    }
  });
});
