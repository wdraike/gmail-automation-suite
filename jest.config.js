module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests-local/**/*.test.js',
    '**/tests-local/**/*.spec.js'
  ],

  // Coverage settings - collect from src for accurate tracking.
  // D1 scope (full-test-coverage leg): everything in src/** is in scope EXCEPT
  //  - src/dev/**            : manual GAS scaffolds that call live DriveApp/Gemini
  //                            (not unit-testable),
  //  - src/core/local-secrets.js : gitignored API-key stub (not in the repo / secret).
  // The *.integration.test.js real-Gemini suite is excluded via describe.skip and is
  // not a source file. See .planning/kermit/WBS-100-coverage.md (D1/D2).
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/appsscript.json',
    '!src/dev/**',
    '!src/core/local-secrets.js',
    '!node_modules/**',
    '!tests/**',
    '!tests-local/**',
    '!*.config.js',
    '!scripts/**'
  ],

  // Belt-and-suspenders: keep the excluded paths out of the coverage map entirely.
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/dev/',
    '<rootDir>/src/core/local-secrets.js'
  ],

  // Coverage thresholds — honest 100% gate (D2/D4). Branches that are genuinely
  // unreachable in Node (GAS-only typeof-guards, defensive throws on impossible
  // states) are wrapped with justified /* istanbul ignore */ comments so true
  // branch coverage stays at 100.
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100
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
