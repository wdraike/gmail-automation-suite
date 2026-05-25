/**
 * INTEGRATION TESTS - Real Gemini API Calls
 *
 * ⚠️ WARNING: These tests make REAL API calls to Gemini
 * - They will consume your API quota
 * - They require a valid API key
 * - They require internet connection
 * - They are slower than unit tests
 *
 * Run these tests separately:
 * npm test -- tests-local/api-service.integration.test.js
 *
 * To skip these tests in regular runs, they are marked with .skip by default
 */

const fs = require('fs');
const path = require('path');

// Load the modules using proper require instead of eval
const config = require('../src/core/config.js');
const { PROPERTY_KEYS, EMAIL_SORTER_CONFIG, JOB_FINDER_CONFIG, API_SERVICE_CONFIG } = config;

// Make config available globally for api-service
global.PROPERTY_KEYS = PROPERTY_KEYS;
global.EMAIL_SORTER_CONFIG = EMAIL_SORTER_CONFIG;
global.JOB_FINDER_CONFIG = JOB_FINDER_CONFIG;
global.API_SERVICE_CONFIG = API_SERVICE_CONFIG;

const apiServiceCode = fs.readFileSync(path.join(__dirname, '../src/core/api-service.js'), 'utf8');
eval(apiServiceCode);

/**
 * To run these tests, you need to:
 * 1. Set GEMINI_API_KEY environment variable
 * 2. Remove .skip from describe.skip below
 * 3. Run: npm test -- tests-local/api-service.integration.test.js
 */

// Change describe.skip to describe to enable these tests
describe.skip('Gemini API - Real Integration Tests', () => {

  beforeAll(() => {
    // Check if API key is available
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.log('\n⚠️  No API key found!');
      console.log('Set GEMINI_API_KEY environment variable to run integration tests:');
      console.log('export GEMINI_API_KEY="your-api-key-here"\n');
      throw new Error('GEMINI_API_KEY not set');
    }

    // Set the API key
    setApiKey(apiKey);

    console.log('✅ API key loaded from environment');
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset API monitor
    if (typeof resetApiMonitor === 'function') {
      resetApiMonitor();
    }
  });

  describe('Real API Calls', () => {

    it('should successfully categorize a work email', async () => {
      const prompt = `Categorize this email:
        Subject: Project status update
        From: manager@company.com
        Body: Here's the weekly project status. We're on track for the Q4 deadline.

        Return JSON: {"category": "work"}`;

      const result = callGemini(prompt);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(['work', 'other']).toContain(result);

      console.log('✅ Work email result:', result);
    }, 10000); // 10 second timeout

    it('should successfully categorize a shopping email', async () => {
      const prompt = `Categorize this email:
        Subject: Your Amazon order has shipped
        From: orders@amazon.com
        Body: Your order #123-456 has been shipped and will arrive tomorrow.

        Return JSON: {"category": "shopping"}`;

      const result = callGemini(prompt);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(['shopping', 'receipts', 'other']).toContain(result);

      console.log('✅ Shopping email result:', result);
    }, 10000);

    it('should successfully categorize a finance email', async () => {
      const prompt = `Categorize this email:
        Subject: Your bank statement is ready
        From: statements@bank.com
        Body: Your monthly bank statement for January is now available.

        Return JSON: {"category": "finance"}`;

      const result = callGemini(prompt);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      console.log('✅ Finance email result:', result);
    }, 10000);

    it('should handle invalid API responses gracefully', async () => {
      const prompt = 'Invalid prompt that might cause issues: ' + 'x'.repeat(10000);

      const result = callGemini(prompt);

      // Should not throw, should return 'other'
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');

      console.log('✅ Invalid prompt handled:', result);
    }, 15000);

    it('should respect rate limiting', async () => {
      resetApiMonitor();

      // Make multiple calls to test rate limiting
      const maxCalls = EMAIL_SORTER_CONFIG?.MAX_GEMINI_CALLS_PER_MINUTE || 15;

      console.log(`Making ${maxCalls} API calls to test rate limiting...`);

      for (let i = 0; i < maxCalls; i++) {
        if (canMakeApiCall()) {
          callGemini('Test prompt ' + i);
          incrementApiCallCount();
        }
      }

      // After max calls, should be rate limited
      const canMakeMore = canMakeApiCall();
      expect(canMakeMore).toBe(false);

      const remaining = getRemainingApiCalls();
      expect(remaining).toBe(0);

      console.log('✅ Rate limiting working correctly');
    }, 60000); // 60 second timeout
  });

  describe('API Statistics', () => {

    it('should track API call statistics', () => {
      resetApiMonitor();

      // Make a real call
      callGemini('Test email for statistics');

      const stats = getApiCallStats();

      expect(stats).toBeDefined();
      expect(stats.totalCalls).toBeGreaterThan(0);
      expect(stats.currentPeriodCalls).toBeGreaterThan(0);

      console.log('✅ API Statistics:', stats);
    }, 10000);
  });

  describe('Error Handling', () => {

    it('should handle empty prompts', () => {
      const result = callGemini('');

      expect(result).toBe('other');
      console.log('✅ Empty prompt handled correctly');
    });

    it('should handle extremely long prompts', () => {
      const longPrompt = 'Categorize this email: ' + 'x'.repeat(5000);

      const result = callGemini(longPrompt);

      expect(result).toBeDefined();
      console.log('✅ Long prompt handled:', result);
    }, 15000);
  });
});

/**
 * Quick Start Guide:
 *
 * 1. Get your Gemini API key from https://makersuite.google.com/app/apikey
 *
 * 2. Set it as an environment variable:
 *    export GEMINI_API_KEY="your-api-key-here"
 *
 * 3. Remove .skip from describe.skip above
 *
 * 4. Run the integration tests:
 *    npm test -- tests-local/api-service.integration.test.js
 *
 * 5. Watch the real API calls succeed! 🎉
 *
 * ⚠️ Remember: These tests cost money (use API quota)
 */
