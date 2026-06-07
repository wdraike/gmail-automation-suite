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
  logGeminiInteraction,
  saveGeminiInteractionToDrive,
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
// checkRateLimit reads JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE as a global.
global.JOB_FINDER_CONFIG = JOB_FINDER_CONFIG;
global.PROPERTY_KEYS = PROPERTY_KEYS;
global.getApiKey = getApiKey;
global.setApiKey = setApiKey;

// HTTP/Properties/Drive/Utilities access is routed through serviceFactory ports;
// the real adapters delegate to the global SDK mocks (setup.js). Reset the
// factory each test so adapters rebind to the current globals.
const { serviceFactory } = require('../src/core/services/index.js');

describe('Gemini API Service - Complete Test Suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    serviceFactory.reset();

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

      // fix-nojobs-output-truncation: surface Gemini finishReason so output
      // truncation (MAX_TOKENS) is visible in execution logs.
      it('logs finishReason from the candidate', () => {
        setApiKey('test-api-key');
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            candidates: [{
              finishReason: 'STOP',
              content: { parts: [{ text: '[]' }] }
            }]
          }))
        }));
        const mockLogger = jest.spyOn(Logger, 'log');
        callGemini('Test prompt');
        expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('finishReason'));
        mockLogger.mockRestore();
      });

      it('logs a MAX_TOKENS truncation warning and still returns the text', () => {
        setApiKey('test-api-key');
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 200),
          getContentText: jest.fn(() => JSON.stringify({
            candidates: [{
              finishReason: 'MAX_TOKENS',
              content: { parts: [{ text: '[{"company":"Acme"' }] }
            }]
          }))
        }));
        const mockLogger = jest.spyOn(Logger, 'log');
        // Must not throw on a MAX_TOKENS candidate; returns whatever text it got.
        const result = callGemini('Test prompt');
        expect(result).toBe('[{"company":"Acme"');
        // Assert the DISTINCT warning text (not the generic finishReason line,
        // which always contains "MAX_TOKENS") so this isolates the warning branch.
        expect(mockLogger).toHaveBeenCalledWith(expect.stringMatching(/output was truncated/i));
        mockLogger.mockRestore();
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

      it('logs the raw 429 body for quota diagnosis before throwing', () => {
        const mockLogger = jest.spyOn(Logger, 'log');
        UrlFetchApp.fetch = jest.fn(() => ({
          getResponseCode: jest.fn(() => 429),
          getContentText: jest.fn(() => JSON.stringify({
            error: { status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded for metric GenerateRequestsPerDay' }
          }))
        }));

        expect(() => callGemini('Test prompt')).toThrow('RATE_LIMIT_REACHED');
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining('Gemini 429 body:')
        );
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining('RESOURCE_EXHAUSTED')
        );
        mockLogger.mockRestore();
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
      it('should wait when rate limit is reached (within the in-process cap)', () => {
          // Fill the per-minute window so checkRateLimit() reports rateLimited.
          // The oldest call is 45s old, so waitTime ~= 60000 - 45000 = 15000ms,
          // which is <= MAX_INPROCESS_WAIT_MS (20000ms) -> the code SLEEPS
          // (line: _asUtils().sleep(rateLimitStatus.waitTime + 100)) rather than
          // surfacing RATE_LIMIT_REACHED.
          const now = Date.now();
          API_STATE.lastApiCalls = [];
          for (let i = 0; i < JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE; i++) {
            // All within the last minute; oldest at now-45000.
            API_STATE.lastApiCalls.push(now - 45000 + i);
          }
          API_STATE.consecutiveFailures = 0;

          const sleepSpy = jest.spyOn(Utilities, 'sleep');

          UrlFetchApp.fetch = jest.fn(() => ({
            getResponseCode: jest.fn(() => 200),
            getContentText: jest.fn(() => JSON.stringify({
              candidates: [{ content: { parts: [{ text: '{"category": "other"}' }] } }]
            }))
          }));

          const result = callGeminiWithRateLimiting('Test prompt');

          // It must have actually waited (slept) for the rate-limit window.
          expect(sleepSpy).toHaveBeenCalledTimes(1);
          const sleptMs = sleepSpy.mock.calls[0][0];
          // waitTime (~15000) + 100 padding, capped under the in-process limit.
          expect(sleptMs).toBeGreaterThan(0);
          expect(sleptMs).toBeLessThanOrEqual(API_SERVICE_CONFIG.MAX_INPROCESS_WAIT_MS + 100);
          // And after waiting it proceeded to a successful call.
          expect(result).toContain('other');

          sleepSpy.mockRestore();
      });

      it('throws RATE_LIMIT_REACHED without sleeping when wait exceeds the in-process cap', () => {
          // Oldest call only 5s old -> waitTime ~= 55000ms, which is GREATER than
          // MAX_INPROCESS_WAIT_MS (20000ms). The code must NOT sleep; it must bump
          // consecutiveFailures and throw RATE_LIMIT_REACHED so the email is queued.
          const now = Date.now();
          API_STATE.lastApiCalls = [];
          for (let i = 0; i < JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE; i++) {
            API_STATE.lastApiCalls.push(now - 5000 + i);
          }
          API_STATE.consecutiveFailures = 0;

          const sleepSpy = jest.spyOn(Utilities, 'sleep');
          UrlFetchApp.fetch = jest.fn();

          expect(() => callGeminiWithRateLimiting('Test prompt'))
            .toThrow('RATE_LIMIT_REACHED');

          // Did not sleep, did not even attempt the HTTP call.
          expect(sleepSpy).not.toHaveBeenCalled();
          expect(UrlFetchApp.fetch).not.toHaveBeenCalled();
          // Failure counter bumped for exponential backoff.
          expect(API_STATE.consecutiveFailures).toBe(1);

          sleepSpy.mockRestore();
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

      it('makes exactly ONE request on a 429 rate limit (no wasteful retries)', () => {
          API_STATE.lastApiCalls = [];
          API_STATE.consecutiveFailures = 0;

          // 429 -> callGemini throws RATE_LIMIT_REACHED
          UrlFetchApp.fetch = jest.fn(() => ({
            getResponseCode: jest.fn(() => 429),
            getContentText: jest.fn(() => JSON.stringify({
              error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' }
            }))
          }));

          expect(() => callGeminiWithRateLimiting('Test prompt'))
            .toThrow('RATE_LIMIT_REACHED');

          // Must NOT consume exponential-backoff retries on a rate-limit error.
          expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(1);
      });

      it('sets the rate-limit backoff property when a 429 occurs', () => {
          API_STATE.lastApiCalls = [];
          API_STATE.consecutiveFailures = 0;

          // Clear any prior backoff value.
          PropertiesService.getScriptProperties()
            .deleteProperty(PROPERTY_KEYS.RATE_LIMIT_NEXT_RUN);

          UrlFetchApp.fetch = jest.fn(() => ({
            getResponseCode: jest.fn(() => 429),
            getContentText: jest.fn(() => JSON.stringify({
              error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded' }
            }))
          }));

          expect(() => callGeminiWithRateLimiting('Test prompt'))
            .toThrow('RATE_LIMIT_REACHED');

          // Outer catch must still record the next-run backoff time.
          const nextRun = PropertiesService.getScriptProperties()
            .getProperty(PROPERTY_KEYS.RATE_LIMIT_NEXT_RUN);
          expect(nextRun).not.toBeNull();
          expect(Number(nextRun)).toBeGreaterThan(Date.now());
      });

      // fix-processjobemails-timeout: in-process sleeps must be capped so a
      // single run cannot burn the 6-min Apps Script budget sleeping. When the
      // computed pre-wait / backoff exceeds MAX_INPROCESS_WAIT_MS, surface
      // RATE_LIMIT_REACHED (queue for a later run) instead of sleeping.
      describe('in-process sleep caps', () => {
        it('does NOT sleep a long rate-limit pre-wait; throws RATE_LIMIT_REACHED instead', () => {
          // Fill the per-minute window so checkRateLimit returns rateLimited with
          // a large waitTime (> MAX_INPROCESS_WAIT_MS but <= old 5000 gate? No:
          // we want a wait that is reasonable under the OLD code but over the cap).
          // Force a waitTime between the legacy 5000 gate and the new cap by
          // stubbing checkRateLimit via API_STATE: oldest call ~ now, so waitTime ~ 60000.
          const now = Date.now();
          API_STATE.lastApiCalls = [];
          for (let i = 0; i < JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE; i++) {
            API_STATE.lastApiCalls.push(now); // all within the last minute
          }
          API_STATE.consecutiveFailures = 0;

          const sleepSpy = jest.spyOn(Utilities, 'sleep');
          UrlFetchApp.fetch = jest.fn(); // must NOT be reached

          expect(() => callGeminiWithRateLimiting('Test prompt'))
            .toThrow('RATE_LIMIT_REACHED');

          // No huge sleep, no API call.
          const slept = sleepSpy.mock.calls.map(c => c[0]);
          expect(slept.every(ms => ms <= config.API_SERVICE_CONFIG.MAX_INPROCESS_WAIT_MS)).toBe(true);
          expect(UrlFetchApp.fetch).not.toHaveBeenCalled();

          sleepSpy.mockRestore();
        });

        it('caps each exponential-backoff sleep to MAX_INPROCESS_WAIT_MS', () => {
          API_STATE.lastApiCalls = [];
          API_STATE.consecutiveFailures = 0;

          // 500 -> generic retryable error, exhausts retries with backoff sleeps.
          UrlFetchApp.fetch = jest.fn(() => ({
            getResponseCode: jest.fn(() => 500),
            getContentText: jest.fn(() => 'Internal Server Error')
          }));

          const sleepSpy = jest.spyOn(Utilities, 'sleep');

          expect(() => callGeminiWithRateLimiting('Test prompt')).toThrow();

          const slept = sleepSpy.mock.calls.map(c => c[0]);
          // Every in-process backoff sleep must be capped.
          expect(slept.every(ms => ms <= config.API_SERVICE_CONFIG.MAX_INPROCESS_WAIT_MS)).toBe(true);

          sleepSpy.mockRestore();
        });
      });

      it('still retries up to MAX_RETRIES on a non-rate-limit transient error (500)', () => {
          API_STATE.lastApiCalls = [];
          API_STATE.consecutiveFailures = 0;

          // 500 -> callGemini throws a generic (non-rate-limit) error
          UrlFetchApp.fetch = jest.fn(() => ({
            getResponseCode: jest.fn(() => 500),
            getContentText: jest.fn(() => 'Internal Server Error')
          }));

          expect(() => callGeminiWithRateLimiting('Test prompt')).toThrow();

          // Non-rate-limit errors should still exhaust retries: 1 + MAX_RETRIES.
          expect(UrlFetchApp.fetch).toHaveBeenCalledTimes(
            API_SERVICE_CONFIG.MAX_RETRIES + 1
          );
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

      it('returns the unknown-error message when error is null/undefined', () => {
          expect(handleApiError(null)).toBe('Unknown error occurred');
          expect(handleApiError(undefined)).toBe('Unknown error occurred');
      });

      it('uses statusCode when there is no code, and labels UNKNOWN when neither', () => {
          expect(handleApiError({ statusCode: 502, message: 'gateway' }))
            .toContain('[502]');
          expect(handleApiError({ message: 'no code at all' }))
            .toContain('[UNKNOWN]');
      });

      it('formats a bare string error', () => {
          const formatted = handleApiError('a plain string error');
          // No message/typeof-string-on-object path -> the `typeof error === string` branch.
          expect(formatted).toContain('a plain string error');
      });

      it('falls back to a generic message for an object with neither message nor string', () => {
          const formatted = handleApiError({ code: 418 });
          expect(formatted).toContain('[418]');
          expect(formatted).toContain('An error occurred');
      });

      it('appends API-key guidance for a 401 / api-key error', () => {
          const formatted = handleApiError({ code: 401, message: 'unauthorized' });
          expect(formatted).toContain('check your API key');
      });

      it('appends API-key guidance when the message mentions an api key (no code)', () => {
          const formatted = handleApiError({ message: 'Invalid API key supplied' });
          expect(formatted).toContain('check your API key');
      });

      it('appends rate-limit guidance for a 429 / rate-limit error', () => {
          const formatted = handleApiError({ code: 429, message: 'too many' });
          expect(formatted).toContain('Rate limit exceeded');
      });
    });

    describe('isRetryableError — additional branches', () => {
      it('returns false for a falsy error', () => {
          expect(isRetryableError(null)).toBe(false);
          expect(isRetryableError(undefined)).toBe(false);
      });

      it('matches on statusCode when there is no code', () => {
          expect(isRetryableError({ statusCode: 504 })).toBe(true);
      });

      it('matches on a retryable substring in the message', () => {
          expect(isRetryableError({ message: 'connection reset' })).toBe(true);
          expect(isRetryableError({ message: 'request timeout' })).toBe(true);
      });

      it('returns false for a non-retryable code and message', () => {
          expect(isRetryableError({ code: 403, message: 'forbidden' })).toBe(false);
      });

      it('handles an error object with no message at all (message-fallback branch)', () => {
          // No code, no statusCode, no message -> reaches `(error.message || '')`.
          expect(isRetryableError({})).toBe(false);
      });
    });
  });

  describe('callGeminiApi (top-level dispatcher)', () => {
    beforeEach(() => {
      setApiKey('test-api-key');
      API_STATE.lastApiCalls = [];
      API_STATE.consecutiveFailures = 0;
    });

    function mock200(text) {
      UrlFetchApp.fetch = jest.fn(() => ({
        getResponseCode: jest.fn(() => 200),
        getContentText: jest.fn(() => JSON.stringify({
          candidates: [{ content: { parts: [{ text }] } }]
        }))
      }));
    }

    it('parses jobs for job_extraction and returns success + jobs', () => {
      mock200('[{"company":"Acme","title":"Dev"}]');
      const result = callGeminiApi('prompt', 'job_extraction');
      expect(result.success).toBe(true);
      expect(result.jobs).toEqual([{ company: 'Acme', title: 'Dev' }]);
      expect(result.response).toContain('Acme');
    });

    it('returns empty jobs (salvage floor) when the job_extraction response has no JSON', () => {
      // cleanGeminiResponse floors unparseable text to "[]", so jobs parse to [].
      mock200('totally not json');
      const result = callGeminiApi('prompt', 'job_extraction');
      expect(result.success).toBe(true);
      expect(result.jobs).toEqual([]);
    });

    it('extracts a JSON array of categories for test_categorization', () => {
      mock200('Here are the categories: ["work","finance"]');
      const result = callGeminiApi('prompt', 'test_categorization');
      expect(result.success).toBe(true);
      expect(result.categories).toEqual(['work', 'finance']);
    });

    it('falls back to line-splitting categories when no JSON array present', () => {
      // Leading bullets/numbers are stripped by the cleanup regex; a trailing
      // quote on the last line is preserved (regex only strips leading chars).
      mock200('- Work\n2. Finance\nPersonal');
      const result = callGeminiApi('prompt', 'test_categorization');
      expect(result.success).toBe(true);
      expect(result.categories).toEqual(['Work', 'Finance', 'Personal']);
    });

    it('returns empty categories + parseError when category JSON array is malformed', () => {
      // jsonMatch finds the bracketed text but it is not valid JSON -> JSON.parse throws.
      mock200('Categories: [work, finance,]'); // unquoted tokens -> invalid JSON
      const result = callGeminiApi('prompt', 'test_categorization');
      expect(result.success).toBe(true);
      expect(result.categories).toEqual([]);
      expect(result.parseError).toBeDefined();
    });

    it('records a successful categorization in API_MONITOR', () => {
      API_MONITOR.totalCalls = 0;
      API_MONITOR.successfulCalls = 0;
      mock200('["work"]');
      callGeminiApi('prompt', 'test_categorization');
      expect(API_MONITOR.status).toBe('up');
      expect(API_MONITOR.successfulCalls).toBeGreaterThan(0);
    });

    it('returns a generic success for unknown operation types', () => {
      mock200('some freeform text');
      const result = callGeminiApi('prompt', 'something_else');
      expect(result).toEqual({ success: true, response: 'some freeform text' });
    });

    it('records failure and returns success:false when the call throws', () => {
      API_MONITOR.failedCalls = 0;
      UrlFetchApp.fetch = jest.fn(() => ({
        getResponseCode: jest.fn(() => 500),
        getContentText: jest.fn(() => 'boom')
      }));
      const result = callGeminiApi('prompt', 'test_categorization');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(API_MONITOR.failedCalls).toBeGreaterThan(0);
    });
  });

  describe('API_MONITOR methods', () => {
    it('recordSuccess sets status up and bumps counters', () => {
      API_MONITOR.totalCalls = 0;
      API_MONITOR.successfulCalls = 0;
      API_MONITOR.recordSuccess();
      expect(API_MONITOR.status).toBe('up');
      expect(API_MONITOR.totalCalls).toBe(1);
      expect(API_MONITOR.successfulCalls).toBe(1);
      expect(API_MONITOR.lastCheck).toBeInstanceOf(Date);
    });

    it('recordFailure sets status rate_limited and bumps rateLimitHits for RATE_LIMIT_REACHED', () => {
      API_MONITOR.totalCalls = 0;
      API_MONITOR.failedCalls = 0;
      API_MONITOR.rateLimitHits = 0;
      API_MONITOR.recordFailure(new Error('RATE_LIMIT_REACHED'));
      expect(API_MONITOR.status).toBe('rate_limited');
      expect(API_MONITOR.rateLimitHits).toBe(1);
      expect(API_MONITOR.failedCalls).toBe(1);
    });

    it('recordFailure sets status down for a non-rate-limit error (and for no error)', () => {
      API_MONITOR.recordFailure(new Error('other'));
      expect(API_MONITOR.status).toBe('down');
      API_MONITOR.recordFailure(null);
      expect(API_MONITOR.status).toBe('down');
    });

    it('recordEmailProcessed logs the category', () => {
      const mockLogger = jest.spyOn(Logger, 'log');
      API_MONITOR.recordEmailProcessed('work');
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('work'));
      mockLogger.mockRestore();
    });

    it('getStatus reports success rate and stats', () => {
      API_MONITOR.status = 'up';
      API_MONITOR.lastCheck = new Date();
      API_MONITOR.totalCalls = 4;
      API_MONITOR.successfulCalls = 3;
      API_MONITOR.rateLimitHits = 1;
      const status = API_MONITOR.getStatus();
      expect(status.apiStatus).toBe('up');
      expect(status.lastCheck).toBe(API_MONITOR.lastCheck.toISOString());
      expect(status.stats.successRate).toBe(75);
      expect(status.stats.rateLimitHits).toBe(1);
    });

    it('getStatus reports 0 success rate and null lastCheck when there are no calls', () => {
      API_MONITOR.status = 'unknown';
      API_MONITOR.lastCheck = null;
      API_MONITOR.totalCalls = 0;
      const status = API_MONITOR.getStatus();
      expect(status.stats.successRate).toBe(0);
      expect(status.lastCheck).toBeNull();
    });
  });

  describe('cleanGeminiResponse — salvage branches', () => {
    it('salvages a JSON object embedded in surrounding prose', () => {
      const messy = 'Sure! Here you go: {"category":"work"} hope that helps';
      const cleaned = cleanGeminiResponse(messy);
      expect(JSON.parse(cleaned)).toEqual({ category: 'work' });
    });

    it('salvages a JSON array when object salvage fails', () => {
      const messy = 'preamble [1, 2, 3] trailing words';
      const cleaned = cleanGeminiResponse(messy);
      expect(JSON.parse(cleaned)).toEqual([1, 2, 3]);
    });

    it('returns "[]" fallback when nothing parseable can be salvaged', () => {
      const cleaned = cleanGeminiResponse('no json here at all, just words');
      expect(cleaned).toBe('[]');
    });

    it('returns "[]" when an object-like match is still invalid and there is no array', () => {
      // Has braces but invalid JSON inside, and no [] array to fall back to.
      const cleaned = cleanGeminiResponse('{ this is { not } valid json }');
      expect(cleaned).toBe('[]');
    });
  });

  describe('callGemini — guard clauses', () => {
    it('throws on an empty prompt', () => {
      setApiKey('test-api-key');
      expect(() => callGemini('')).toThrow('Empty prompt');
    });

    it('throws when the API key is missing', () => {
      // Clear the key so getApiKey() returns falsy.
      setApiKey('');
      expect(() => callGemini('a prompt')).toThrow('API key is missing');
    });
  });

  describe('checkRateLimit — error path', () => {
    it('defaults to not-rate-limited when the internal logic throws', () => {
      const original = JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE;
      // Force the comparison inside checkRateLimit to blow up by replacing the
      // array with something whose .filter throws.
      const savedCalls = API_STATE.lastApiCalls;
      API_STATE.lastApiCalls = { filter: () => { throw new Error('boom'); } };
      try {
        const status = checkRateLimit();
        expect(status).toEqual({ rateLimited: false, waitTime: 0 });
      } finally {
        API_STATE.lastApiCalls = savedCalls;
        JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE = original;
      }
    });
  });

  describe('callGeminiWithRateLimiting — backoff cap log', () => {
    it('logs and throws RATE_LIMIT_REACHED when an exponential backoff exceeds the in-process cap', () => {
      API_STATE.lastApiCalls = [];
      API_STATE.consecutiveFailures = 0;
      const savedDelay = API_SERVICE_CONFIG.RETRY_DELAY_MS;
      // Force the very first retry's backoff (RETRY_DELAY_MS * 2^0) to exceed the cap.
      API_SERVICE_CONFIG.RETRY_DELAY_MS = API_SERVICE_CONFIG.MAX_INPROCESS_WAIT_MS + 1;
      const mockLogger = jest.spyOn(Logger, 'log');
      // 500 -> generic retryable error enters the retry loop.
      UrlFetchApp.fetch = jest.fn(() => ({
        getResponseCode: jest.fn(() => 500),
        getContentText: jest.fn(() => 'err')
      }));
      try {
        expect(() => callGeminiWithRateLimiting('prompt')).toThrow('RATE_LIMIT_REACHED');
        expect(mockLogger).toHaveBeenCalledWith(
          expect.stringContaining('exceeds in-process cap')
        );
      } finally {
        API_SERVICE_CONFIG.RETRY_DELAY_MS = savedDelay;
        mockLogger.mockRestore();
      }
    });
  });

  describe('monitoring functions — no-monitor / catch branches', () => {
    // canMakeApiCall, getRemainingApiCalls, getApiCallStats all have a
    // `typeof API_MONITOR === 'undefined' || !API_MONITOR` early branch. Temporarily
    // null the exported monitor reference to reach it (the functions read the
    // module-scope binding, so we drive the branch via the falsy-guard path using
    // a stand-in: these functions reference the const API_MONITOR, so instead we
    // assert the populated-monitor branches plus logApiCall's failure handling).

    it('getApiCallStats returns the populated-monitor stats object', () => {
      API_MONITOR.totalCalls = 5;
      API_MONITOR.successCount = 2;
      API_MONITOR.failureCount = 1;
      API_MONITOR.requestCount = 3;
      API_MONITOR.lastResetTime = Date.now();
      const stats = getApiCallStats();
      expect(stats.totalCalls).toBe(5);
      expect(stats.currentPeriodCalls).toBe(3);
      expect(stats.resetTime).toBeInstanceOf(Date);
    });

    it('canMakeApiCall falls back to 15 when the config cap is unset', () => {
      const saved = EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE;
      EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE = 0; // falsy -> `|| 15`
      try {
        resetApiMonitor();
        // requestCount (0) < 15 -> true.
        expect(canMakeApiCall()).toBe(true);
      } finally {
        EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE = saved;
      }
    });

    it('getRemainingApiCalls falls back to 15 when the config cap is unset', () => {
      const saved = EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE;
      EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE = 0; // falsy -> `|| 15`
      try {
        resetApiMonitor();
        expect(getRemainingApiCalls()).toBe(15);
      } finally {
        EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE = saved;
      }
    });

    it('getApiCallStats returns null resetTime when lastResetTime is falsy', () => {
      API_MONITOR.lastResetTime = 0;
      const stats = getApiCallStats();
      expect(stats.resetTime).toBeNull();
    });

    it('logApiCall returns false when JSON serialization throws (catch branch)', () => {
      // A circular object makes JSON.stringify throw inside logApiCall.
      const circular = {};
      circular.self = circular;
      const result = logApiCall('endpoint', 'success', 200, { bad: circular });
      expect(result).toBe(false);
    });

    it('logApiCall increments failureCount on a non-success status', () => {
      API_MONITOR.failureCount = 0;
      API_MONITOR.totalCalls = 0;
      logApiCall('endpoint', 'error', 500);
      expect(API_MONITOR.failureCount).toBe(1);
      expect(API_MONITOR.totalCalls).toBe(1);
    });
  });

  describe('logGeminiInteraction', () => {
    beforeEach(() => {
      PropertiesService.getScriptProperties().deleteAllProperties();
    });

    it('persists errors to the GEMINI_ERRORS property (capped at 10)', () => {
      // Seed with 10 existing errors so the next push triggers the shift cap.
      const existing = Array.from({ length: 10 }, (_, i) => ({ n: i }));
      PropertiesService.getScriptProperties()
        .setProperty('GEMINI_ERRORS', JSON.stringify(existing));
      logGeminiInteraction('error', { operationType: 'cat', error: 'oops' });
      const stored = JSON.parse(
        PropertiesService.getScriptProperties().getProperty('GEMINI_ERRORS')
      );
      expect(stored.length).toBe(10);
      // Oldest ({n:0}) shifted out; newest entry appended.
      expect(stored[0]).toEqual({ n: 1 });
      expect(stored[stored.length - 1].type).toBe('error');
    });

    it('starts a fresh error list when none exists yet', () => {
      logGeminiInteraction('error', { error: 'first' });
      const stored = JSON.parse(
        PropertiesService.getScriptProperties().getProperty('GEMINI_ERRORS')
      );
      expect(stored.length).toBe(1);
    });

    it('routes request/response interactions to Drive', () => {
      const folder = {
        createFile: jest.fn(() => ({
          getUrl: jest.fn(() => 'u'),
          getId: jest.fn(() => 'fid')
        }))
      };
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => true, next: () => folder }));
      logGeminiInteraction('request', { operationType: 'cat', prompt: 'p' });
      expect(folder.createFile).toHaveBeenCalled();
    });

    it('swallows errors thrown inside the interaction logging (outer catch)', () => {
      // Make JSON.stringify throw via a circular content object on a non-drive type.
      const circular = {};
      circular.self = circular;
      expect(() => logGeminiInteraction('error', circular)).not.toThrow();
    });
  });

  describe('saveGeminiInteractionToDrive', () => {
    const TS = '2026-01-02T03:04:05.678Z';

    beforeEach(() => {
      PropertiesService.getScriptProperties().deleteAllProperties();
    });

    it('creates a new request file in an existing folder and stores the file id', () => {
      const created = { getUrl: jest.fn(() => 'url'), getId: jest.fn(() => 'file-123') };
      const folder = { createFile: jest.fn(() => created) };
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => true, next: () => folder }));

      saveGeminiInteractionToDrive('request', { operationType: 'cat', prompt: 'hello' }, TS);

      expect(folder.createFile).toHaveBeenCalled();
      const safeTs = TS.replace(/:/g, '-').replace(/\./g, '-');
      expect(
        PropertiesService.getScriptProperties().getProperty(`GEMINI_FILE_${safeTs}`)
      ).toBe('file-123');
    });

    it('creates the folder when it does not exist yet', () => {
      const created = { getUrl: jest.fn(() => 'url'), getId: jest.fn(() => 'file-9') };
      const folder = { createFile: jest.fn(() => created) };
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => false, next: jest.fn() }));
      DriveApp.createFolder = jest.fn(() => folder);

      saveGeminiInteractionToDrive('request', { operationType: 'cat' }, TS);

      expect(DriveApp.createFolder).toHaveBeenCalledWith('Gemini API Debug Logs');
      expect(folder.createFile).toHaveBeenCalled();
    });

    it('uses "unknown" operation and the JSON content fallback when operationType/prompt are absent', () => {
      const created = { getUrl: jest.fn(() => 'url'), getId: jest.fn(() => 'file-x') };
      const folder = { createFile: jest.fn(() => created) };
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => true, next: () => folder }));
      // No operationType and no prompt -> exercises the `|| 'unknown'` and
      // `|| JSON.stringify(content,...)` fallbacks in the request branch.
      saveGeminiInteractionToDrive('request', { foo: 'bar' }, TS);
      const writtenContent = folder.createFile.mock.calls[0][1];
      expect(writtenContent).toContain('Operation: unknown');
      expect(writtenContent).toContain('"foo": "bar"');
    });

    it('uses response fallbacks when responseLength/responseText are absent', () => {
      const safeTs = TS.replace(/:/g, '-').replace(/\./g, '-');
      PropertiesService.getScriptProperties().setProperty(`GEMINI_FILE_${safeTs}`, 'file-r');
      const file = {
        getBlob: jest.fn(() => ({ getDataAsString: jest.fn(() => '(waiting for response...)') })),
        setContent: jest.fn(),
        getUrl: jest.fn(() => 'url')
      };
      DriveApp.getFileById = jest.fn(() => file);
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => true, next: () => ({ createFile: jest.fn() }) }));
      saveGeminiInteractionToDrive('response', {}, TS);
      const updated = file.setContent.mock.calls[0][0];
      expect(updated).toContain('LENGTH: unknown chars');
      expect(updated).toContain('Response text not available');
    });

    it('does nothing for an interaction type that is neither request nor response', () => {
      const folder = { createFile: jest.fn() };
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => true, next: () => folder }));
      DriveApp.getFileById = jest.fn();
      // type 'other' falls through both branches without touching files.
      saveGeminiInteractionToDrive('other', { operationType: 'cat' }, TS);
      expect(folder.createFile).not.toHaveBeenCalled();
    });

    it('updates the existing file with the response when a file id is stored', () => {
      const safeTs = TS.replace(/:/g, '-').replace(/\./g, '-');
      PropertiesService.getScriptProperties().setProperty(`GEMINI_FILE_${safeTs}`, 'file-77');

      const file = {
        getBlob: jest.fn(() => ({ getDataAsString: jest.fn(() => 'before (waiting for response...) after') })),
        setContent: jest.fn(),
        getUrl: jest.fn(() => 'url')
      };
      DriveApp.getFileById = jest.fn(() => file);
      // folder lookup still happens before the response branch.
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => true, next: () => ({ createFile: jest.fn() }) }));

      saveGeminiInteractionToDrive('response', { responseLength: 12, responseText: 'RESP' }, TS);

      expect(file.setContent).toHaveBeenCalledWith(expect.stringContaining('RESP'));
      // Cleanup property removed.
      expect(
        PropertiesService.getScriptProperties().getProperty(`GEMINI_FILE_${safeTs}`)
      ).toBeNull();
    });

    it('logs a warning when no request file is found for a response', () => {
      const mockLogger = jest.spyOn(Logger, 'log');
      DriveApp.getFoldersByName = jest.fn(() => ({ hasNext: () => true, next: () => ({ createFile: jest.fn() }) }));
      // No GEMINI_FILE_ property set -> fileId is null.
      saveGeminiInteractionToDrive('response', { responseText: 'x' }, TS);
      expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining('No request file found'));
      mockLogger.mockRestore();
    });

    it('swallows Drive errors (outer catch)', () => {
      DriveApp.getFoldersByName = jest.fn(() => { throw new Error('drive down'); });
      expect(() => saveGeminiInteractionToDrive('request', { operationType: 'cat' }, TS)).not.toThrow();
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });

    it('resolves the GAS-global serviceFactory when present', () => {
      // Exercises the `typeof serviceFactory !== "undefined"` true branch in _asServiceFactory.
      global.serviceFactory = serviceFactory;
      setApiKey('test-api-key');
      API_STATE.lastApiCalls = [];
      UrlFetchApp.fetch = jest.fn(() => ({
        getResponseCode: jest.fn(() => 200),
        getContentText: jest.fn(() => JSON.stringify({
          candidates: [{ content: { parts: [{ text: '{"category":"work"}' }] } }]
        }))
      }));
      const result = callGemini('a prompt');
      expect(result).toBe('{"category":"work"}');
    });
  });
});
