// Jest setup file for Chrome extension tests
require('@testing-library/jest-dom');

// Mock Chrome extension APIs
const mockStorage = {
  local: {
    _data: {},
    get: jest.fn((keys) => {
      return Promise.resolve(
        typeof keys === 'string'
          ? { [keys]: mockStorage.local._data[keys] }
          : Object.fromEntries(
              (Array.isArray(keys) ? keys : Object.keys(keys)).map((key) => [
                key,
                mockStorage.local._data[key],
              ])
            )
      );
    }),
    set: jest.fn((items) => {
      Object.assign(mockStorage.local._data, items);
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach((key) => delete mockStorage.local._data[key]);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockStorage.local._data = {};
      return Promise.resolve();
    }),
  },
  sync: {
    _data: {},
    get: jest.fn((keys) => {
      return Promise.resolve(
        typeof keys === 'string'
          ? { [keys]: mockStorage.sync._data[keys] }
          : Object.fromEntries(
              (Array.isArray(keys) ? keys : Object.keys(keys)).map((key) => [
                key,
                mockStorage.sync._data[key],
              ])
            )
      );
    }),
    set: jest.fn((items) => {
      Object.assign(mockStorage.sync._data, items);
      return Promise.resolve();
    }),
    remove: jest.fn((keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach((key) => delete mockStorage.sync._data[key]);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockStorage.sync._data = {};
      return Promise.resolve();
    }),
  },
};

const mockRuntime = {
  sendMessage: jest.fn(() => Promise.resolve()),
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false),
  },
  getURL: jest.fn((path) => `chrome-extension://mock-extension-id/${path}`),
  openOptionsPage: jest.fn(() => Promise.resolve()),
  lastError: null,
};

const mockTabs = {
  query: jest.fn(() =>
    Promise.resolve([
      {
        id: 1,
        url: 'https://example.com/job/123',
        title: 'Job Title - Company',
        active: true,
        windowId: 1,
      },
    ])
  ),
  sendMessage: jest.fn(() => Promise.resolve()),
  create: jest.fn((options) => Promise.resolve({ id: 2, ...options })),
  update: jest.fn((tabId, updateProperties) => Promise.resolve({ id: tabId, ...updateProperties })),
};

global.chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
  tabs: mockTabs,
};

// Helper to reset all mocks between tests
global.resetChromeMocks = () => {
  mockStorage.local._data = {};
  mockStorage.sync._data = {};
  mockStorage.local.get.mockClear();
  mockStorage.local.set.mockClear();
  mockStorage.local.remove.mockClear();
  mockStorage.local.clear.mockClear();
  mockStorage.sync.get.mockClear();
  mockStorage.sync.set.mockClear();
  mockStorage.sync.remove.mockClear();
  mockStorage.sync.clear.mockClear();
  mockRuntime.sendMessage.mockClear();
  mockRuntime.onMessage.addListener.mockClear();
  mockRuntime.openOptionsPage.mockClear();
  mockTabs.query.mockClear();
  mockTabs.sendMessage.mockClear();
  mockTabs.create.mockClear();
  mockTabs.update.mockClear();
};

// Reset mocks before each test
beforeEach(() => {
  global.resetChromeMocks();
  // Reset fetch mock if it exists
  if (global.fetch && global.fetch.mockReset) {
    global.fetch.mockReset();
  }
});

// Mock window.IdynicApi for popup and options tests
global.mockIdynicApi = (overrides = {}) => {
  window.IdynicApi = {
    getApiKey: jest.fn(() => Promise.resolve(null)),
    saveApiKey: jest.fn(() => Promise.resolve()),
    clearApiKey: jest.fn(() => Promise.resolve()),
    verifyApiKey: jest.fn(() => Promise.resolve({ valid: true, user_id: 'test-user-id' })),
    saveOpportunity: jest.fn(() =>
      Promise.resolve({ success: true, data: { id: 'opp-123', title: 'Test Job', company: 'Test Co' } })
    ),
    getApiBase: jest.fn(() => 'http://localhost:3000'),
    ...overrides,
  };
  return window.IdynicApi;
};
