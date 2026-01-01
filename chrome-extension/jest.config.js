/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'popup/**/*.js',
    'options/**/*.js',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
  // NOTE: Coverage thresholds are disabled because Jest can't accurately track
  // coverage for code executed via eval() in tests. The Chrome extension uses
  // plain JavaScript without modules, so we test by reading source files and
  // evaluating them. This approach validates behavior but doesn't provide
  // accurate coverage metrics. Consider migrating to ES modules in the future
  // for better coverage tracking.
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['js', 'json'],
  testTimeout: 10000,
};
