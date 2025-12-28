module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Don't use react-native's setup.js, we mock everything ourselves
  setupFiles: [],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@idynic/shared/api$': '<rootDir>/../../packages/shared/src/api/index.ts',
    '^@idynic/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 80,
      lines: 70,
      statements: 70,
    },
  },
};
