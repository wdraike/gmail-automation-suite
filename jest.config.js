module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests-local/**/*.test.js',
    '**/tests-local/**/*.spec.js'
  ],

  // Coverage settings - collect from src for accurate tracking
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/appsscript.json',
    '!node_modules/**',
    '!tests/**',
    '!tests-local/**',
    '!*.config.js',
    '!scripts/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 30,
      lines: 27,
      statements: 27
    }
  },

  // Setup files - load both old and new setup
  setupFilesAfterEnv: [
    '<rootDir>/tests-local/setup.js',
    '<rootDir>/tests-local/jest-setup.js'
  ],

  // Test environment setup
  testEnvironmentOptions: {
    url: 'http://localhost'
  },

  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true
};
