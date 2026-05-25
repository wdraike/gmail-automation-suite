/**
 * Jest Global Setup - Additional Test Utilities
 * Provides utility functions for testing
 * Note: The main mocks are set up in setup.js
 */

// Additional global test utilities
global.testUtils = {
  /**
   * Wait for a promise to resolve/reject with timeout
   */
  waitFor: async (fn, timeout = 5000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const result = await fn();
        if (result) return result;
      } catch (e) {
        // Continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('waitFor timeout exceeded');
  },

  /**
   * Create a delay (useful for testing async operations)
   */
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Deep clone an object
   */
  clone: (obj) => JSON.parse(JSON.stringify(obj))
};

// Make mock classes available for new tests (optional usage)
// These are available but don't override the existing jest.fn() mocks
global.MockClasses = require('./mocks');
