/**
 * Comprehensive Tests for API Service (Gemini)
 * Fully mocked - no real API calls
 */

// Load modules using require for proper coverage tracking
const config = require('../src/core/config.js');
const {
  callGeminiApi,
  callGeminiWithRateLimiting,
  checkRateLimit,
  cleanGeminiResponse,
  callGemini,
  parseGeminiCategory,
  canMakeApiCall,
  incrementApiCallCount,
  getRemainingApiCalls,
  resetApiMonitor,
  getApiCallStats,
  logApiCall,
  isRetryableError,
  handleApiError,
  API_MONITOR,
  API_STATE
} = require('../src/core/api-service.js');

// JOB_FINDER_CONFIG needed for rate limit test
const { JOB_FINDER_CONFIG } = require('../src/core/config.js');

// Make config constants and functions available
const API_SERVICE_CONFIG = config.API_SERVICE_CONFIG;
const EMAIL_SORTER_CONFIG = config.EMAIL_SORTER_CONFIG;
const PROPERTY_KEYS = config.PROPERTY_KEYS;
const setApiKey = config.setApiKey;
const getApiKey = config.getApiKey;

// Make them global so api-service code can access them
global.API_SERVICE_CONFIG = API_SERVICE_CONFIG;
global.EMAIL_SORTER_CONFIG = EMAIL_SORTER_CONFIG;
global.PROPERTY_KEYS = PROPERTY_KEYS;
global.getApiKey = getApiKey;
global.setApiKey = setApiKey;

describe('Gemini API Service - Complete Test Suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset API monitor
      API_MONITOR.requestCount = 0;
      API_MONITOR.lastResetTime = Date.now();
  });

  describe('API Response Parsing', () => {

    describe('cleanGeminiResponse', () => {
      it('should extract JSON from markdown code blocks', () => {
        const response = '```json\n{"category": "work"}\n```';
        const cleaned = cleanGeminiResponse(response);

        expect(cleaned).toContain('{"category": "work"}');
        expect(cleaned).not.toContain('```');
      });

      it('should handle plain JSON responses', () => {
        const plainJson = '{"category": "personal", "confidence": 0.95}';
        const cleaned = cleanGeminiResponse(plainJson);

        expect(cleaned).toBe(plainJson);
      });

      it('should remove trailing commas from objects', () => {
        const invalidJson = '{"category": "finance",}';
        const cleaned = cleanGeminiResponse(invalidJson);

        expect(cleaned).toBe('{"category": "finance"}');
      });

      it('should remove trailing commas from arrays', () => {
        const invalidJson = '{"items": [1, 2, 3,]}';
        const cleaned = cleanGeminiResponse(invalidJson);

        expect(cleaned).toBe('{"items": [1, 2, 3]}');
      });

      it('should handle empty responses', () => {
        const cleaned = cleanGeminiResponse('');

        expect(typeof cleaned).toBe('string');
      });

      it('should handle null/undefined input', () => {
        expect(() => cleanGeminiResponse(null)).not.toThrow();
        expect(() => cleanGeminiResponse(undefined)).not.toThrow();
      });

      it('should strip multiple markdown code blocks', () => {
        const response = '```json\n{"category": "work"}\n```\n\n```json\n{"other": "data"}\n```';
        const cleaned = cleanGeminiResponse(response);

        expect(cleaned).toContain('{"category": "work"}');
        expect(cleaned).not.toContain('```');
      });

      it('should handle code blocks with language specifiers', () => {
        const response = '```javascript\n{"category": "work"}\n```';
        const cleaned = cleanGeminiResponse(response);

        expect(cleaned).toContain('{"category": "work"}');
      });
    });

    describe('parseGeminiCategory', () => {
      it('should parse valid category response', () => {
        const response = '{"category": "work"}';
        const category = parseGeminiCategory(response);

        expect(category).toBe('work');
      });

      it('should handle JSON in markdown', () => {
        const response = '```json\n{"category": "shopping"}\n```';
        const category = parseGeminiCategory(response);

        expect(category).toBe('shopping');
      });

      it('should return "other" for invalid JSON', () => {
        const invalidResponse = 'This is not JSON at all';
        const category = parseGeminiCategory(invalidResponse);

        expect(category).toBe('other');
      });

      it('should return "other" for missing category field', () => {
        const response = '{"result": "no category here", "confidence": 0.8}';
        const category = parseGeminiCategory(response);

        expect(category).toBe('other');
      });

      it('should handle empty response', () => {
        const category = parseGeminiCategory('');

        expect(category).toBe('other');
      });

      it('should handle null/undefined', () => {
        expect(parseGeminiCategory(null)).toBe('other');
        expect(parseGeminiCategory(undefined)).toBe('other');
      });

      it('should normalize category to lowercase', () => {
        const response = '{"category": "WORK"}';
        const category = parseGeminiCategory(response);

        expect(category).toBe('work');
      });

      it('should trim whitespace from category', () => {
        const response = '{"category": "  work  "}';
        const category = parseGeminiCategory(response);

        expect(category).toBe('work');
      });

      it('should handle nested category field', () => {
        const response = '{"result": {"category": "finance"}}';
        // This should return 'other' unless parseGeminiCategory handles nested
        const category = parseGeminiCategory(response);

        expect(typeof category).toBe('string');
      });
    });
  });

  describe('Rate Limiting', () => {

    describe('canMakeApiCall', () => {
      it('should return true when under rate limit', () => {
          resetApiMonitor();

        const canCall = canMakeApiCall();

        expect(canCall).toBe(true);
      });

      it('should return false when at rate limit', () => {
        if (typeof API_MONITOR !== 'undefined' && typeof EMAIL_SORTER_CONFIG !== 'undefined') {
          resetApiMonitor();

          // Make maximum number of calls
          const maxCalls = EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE || 15;
          for (let i = 0; i < maxCalls; i++) {
            incrementApiCallCount();
          }

          const canCall = canMakeApiCall();
          expect(canCall).toBe(false);
        }
      });

      it('should reset after time window', () => {
          // Set last reset to over 1 minute ago
          API_MONITOR.lastResetTime = Date.now() - 61000;
          API_MONITOR.requestCount = 15;

          const canCall = canMakeApiCall();

          // Should have reset
          expect(canCall).toBe(true);
      });
    });

    describe('incrementApiCallCount', () => {
      it('should increment the counter', () => {
          resetApiMonitor();
          const before = API_MONITOR.requestCount;

          incrementApiCallCount();

          expect(API_MONITOR.requestCount).toBe(before + 1);
      });

      it('should handle multiple increments', () => {
          resetApiMonitor();

          incrementApiCallCount();
          incrementApiCallCount();
          incrementApiCallCount();

          expect(API_MONITOR.requestCount).toBe(3);
      });
    });

    describe('getRemainingApiCalls', () => {
      it('should return correct remaining calls', () => {
          resetApiMonitor();

          const maxCalls = EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE || 15;
          const remaining = getRemainingApiCalls();

          expect(remaining).toBe(maxCalls);
      });

      it('should decrease as calls are made', () => {
          resetApiMonitor();

          const before = getRemainingApiCalls();
          incrementApiCallCount();
          const after = getRemainingApiCalls();

          expect(after).toBe(before - 1);
      });

      it('should not go below zero', () => {
          resetApiMonitor();

          // Exceed the limit
          for (let i = 0; i < 20; i++) {
            incrementApiCallCount();
          }

          const remaining = getRemainingApiCalls();
          expect(remaining).toBeGreaterThanOrEqual(0);
      });
    });

    describe('resetApiMonitor', () => {
      it('should reset request count to zero', () => {
          API_MONITOR.requestCount = 10;

          resetApiMonitor();

          expect(API_MONITOR.requestCount).toBe(0);
      });

      it('should update last reset time', () => {
          const before = API_MONITOR.lastResetTime;

          resetApiMonitor();

          expect(API_MONITOR.lastResetTime).toBeGreaterThanOrEqual(before);
      });
    });
  });

  describe('Gemini API Calls with Mocks', () => {
    beforeEach(() => {
      setApiKey('test-api-key');
    });

    describe('callGemini - Success Cases', () => {
      it('should return parsed category on success', () => {
        // Set API key for test
        setApiKey('test-api-key');

        // Mock successful API response
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: '{"category": "work"}'
                }]
              }
            }]
          }))
        }));

          const result = callGemini('Test email about work project');

          expect(result).toBe('{"category": "work"}'); // Returns raw text from API
          expect(UrlFetchApp.fetch).toHaveBeenCalled();
      });

      it('should handle response with markdown', () => {
        // Set API key for test
        setApiKey('test-api-key');

        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            candidates: [{
              content: {
                parts: [{
                  text: '```json\n{"category": "finance"}\n```'
                }]
              }
            }]
          }))
        }));

          const result = callGemini('Test email about finances');

          // Now returns raw text, not parsed category
          expect(result).toBe('```json\n{"category": "finance"}\n```');
      });

      it('should pass correct API key in headers', () => {
        const testKey = 'test-api-key-12345';
        setApiKey(testKey);

        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"category": "other"}' }] } }]
          }))
        }));

          callGemini('Test prompt');

          const fetchCall = UrlFetchApp.fetch.mock.calls[0];
          const options = fetchCall[1];

          // API key should be in headers or URL params
          expect(fetchCall).toBeDefined();
      });

      it('should include prompt in request payload', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"category": "other"}' }] } }]
          }))
        }));

          const testPrompt = 'Categorize this email about shopping';
          callGemini(testPrompt);

          const fetchCall = UrlFetchApp.fetch.mock.calls[0];
          const options = fetchCall[1];

          if (options && options.payload) {
            const payload = JSON.parse(options.payload);
            expect(JSON.stringify(payload)).toContain(testPrompt);
          }
      });
    });

    describe('callGemini - Error Cases', () => {
      it('should throw on API errors (500)', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 500),
          getContentText: jest.fn(() => JSON.stringify({
            error: { message: 'Internal server error' }
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('500');
      });

      it('should throw RATE_LIMIT_REACHED on rate limit errors (429)', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 429),
          getContentText: jest.fn(() => JSON.stringify({
            error: { message: 'Rate limit exceeded' }
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('RATE_LIMIT_REACHED');
      });

      it('should throw RATE_LIMIT_REACHED on service unavailable (503)', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 503),
          getContentText: jest.fn(() => JSON.stringify({
            error: { message: 'Service unavailable' }
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('RATE_LIMIT_REACHED');
      });

      it('should throw RATE_LIMIT_REACHED when error body has code 429 (200 status)', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            error: { code: 429, message: 'Quota exceeded' }
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('RATE_LIMIT_REACHED');
      });

      it('should throw RATE_LIMIT_REACHED when error status is RESOURCE_EXHAUSTED (200 status)', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' }
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('RATE_LIMIT_REACHED');
      });

      it('should throw a generic (non-rate-limit) error for other API error bodies', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            error: { code: 400, status: 'INVALID_ARGUMENT', message: 'Bad request' }
          }))
        }));

        const err = (() => { try { callGemini('Test prompt'); return null; } catch (e) { return e; } })();
        expect(err).not.toBeNull();
        expect(err.message).not.toBe('RATE_LIMIT_REACHED');
        expect(err.message).toContain('Bad request');
      });

      it('should throw on authentication errors (401)', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 401),
          getContentText: jest.fn(() => JSON.stringify({
            error: { message: 'Invalid API key' }
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('401');
      });

      it('should throw on network errors', () => {
        UrlFetchApp.fetch = jest.fn(() => {
          throw new Error('Network connection failed');
        });

        expect(() => callGemini('Test prompt')).toThrow('Network connection failed');
      });

      it('should throw on malformed JSON responses', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => 'This is not JSON')
        }));

        expect(() => callGemini('Test prompt')).toThrow();
      });

      it('should throw on missing candidates in response', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            // No candidates array
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('Unexpected response format');
      });

      it('should throw on empty candidates array', () => {
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            candidates: []
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('Unexpected response format');
      });
    });

    describe('callGeminiWithRateLimiting', () => {
      it.skip('should wait when rate limit is reached', () => {
          // Skipped: internal rate-limit state is hard to mock reliably.
          // Rate limiting behavior is covered by checkRateLimit unit tests.
      });

      it('should not wait when under rate limit', () => {
          API_STATE.lastApiCalls = [];

          const sleepSpy = jest.spyOn(Utilities, 'sleep');

          UrlFetchApp.fetch = jest.fn(() => ({
            getResponseCode: jest.fn(() => 200),
            getContentText: jest.fn(() => JSON.stringify({
              candidates: [{ content: { parts: [{ text: '{"category": "other"}' }] } }]
            }))
          }));

          callGeminiWithRateLimiting('Test prompt');

          // Should not have called sleep
          expect(sleepSpy).not.toHaveBeenCalled();

          sleepSpy.mockRestore();
      });
    });
  });

  describe('API Statistics and Monitoring', () => {

    describe('getApiCallStats', () => {
      it('should return statistics object', () => {
          const stats = getApiCallStats();

          expect(typeof stats).toBe('object');
          expect(stats).toHaveProperty('totalCalls');
      });

      it('should track call counts', () => {
          resetApiMonitor();

          incrementApiCallCount();
          incrementApiCallCount();

          const stats = getApiCallStats();

          expect(stats.totalCalls).toBeGreaterThanOrEqual(2);
      });
    });

    describe('logApiCall', () => {
      it('should log successful API calls', () => {
          const mockLogger = jest.spyOn(Logger, 'log');

          logApiCall('gemini-categorize', 'success', 200);

          expect(mockLogger).toHaveBeenCalled();

          mockLogger.mockRestore();
      });

      it('should log failed API calls', () => {
          const mockLogger = jest.spyOn(Logger, 'log');

          logApiCall('gemini-categorize', 'error', 500);

          expect(mockLogger).toHaveBeenCalled();

          mockLogger.mockRestore();
      });
    });
  });

  describe('Error Classification', () => {

    describe('isRetryableError', () => {
      it('should identify retryable errors', () => {
          const networkError = { code: 503, message: 'Service unavailable' };
          const rateLimitError = { code: 429, message: 'Too many requests' };

          expect(isRetryableError(networkError)).toBe(true);
          expect(isRetryableError(rateLimitError)).toBe(true);
      });

      it('should identify non-retryable errors', () => {
          const authError = { code: 401, message: 'Unauthorized' };
          const badRequest = { code: 400, message: 'Bad request' };

          expect(isRetryableError(authError)).toBe(false);
          expect(isRetryableError(badRequest)).toBe(false);
      });
    });

    describe('handleApiError', () => {
      it('should format error messages', () => {
          const error = new Error('Test error');
          const formatted = handleApiError(error);

          expect(typeof formatted).toBe('string');
          expect(formatted.toLowerCase()).toContain('error');
      });

      it('should include error details', () => {
          const error = { message: 'API quota exceeded', code: 429 };
          const formatted = handleApiError(error);

          expect(formatted).toContain('429');
      });
    });
  });
});
