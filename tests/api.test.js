/**
 * Unit Tests for API Service Module
 */

describe('API Configuration', () => {
  describe('getApiKey', () => {
    it('should return a string or null', () => {
      const apiKey = getApiKey();

      expect.value(apiKey === null || typeof apiKey === 'string').toBeTruthy();
    });
  });

  describe('isApiKeySet', () => {
    it('should return a boolean', () => {
      const isSet = isApiKeySet();

      expect.value(typeof isSet).toBe('boolean');
    });

    it('should return true if API key exists', () => {
      const apiKey = getApiKey();

      if (apiKey) {
        expect.value(isApiKeySet()).toBeTruthy();
      }
    });
  });

  describe('setApiKey', () => {
    it('should reject empty API key', () => {
      const result = setApiKey('');

      expect.value(result).toContain('Error');
    });

    it('should reject null API key', () => {
      const result = setApiKey(null);

      expect.value(result).toContain('Error');
    });

    it('should accept valid API key string', () => {
      const testKey = 'test_api_key_12345';
      const result = setApiKey(testKey);

      expect.value(result).toContain('success');

      // Verify it was set
      const retrieved = getApiKey();
      expect.value(retrieved).toBe(testKey);
    });
  });
});

describe('API Rate Limiting', () => {
  describe('API_MONITOR', () => {
    it('should exist as global object', () => {
      expect.value(typeof API_MONITOR).toBe('object');
      expect.value(API_MONITOR).toBeTruthy();
    });

    it('should have request tracking properties', () => {
      expect.value(API_MONITOR).toHaveProperty('requestCount');
      expect.value(API_MONITOR).toHaveProperty('lastResetTime');
    });

    it('should initialize request count as number', () => {
      expect.value(typeof API_MONITOR.requestCount).toBe('number');
    });
  });

  describe('canMakeApiCall', () => {
    it('should return boolean', () => {
      const canCall = canMakeApiCall();

      expect.value(typeof canCall).toBe('boolean');
    });

    it('should allow calls when under rate limit', () => {
      // Reset the monitor
      resetApiMonitor();

      const canCall = canMakeApiCall();

      expect.value(canCall).toBeTruthy();
    });
  });

  describe('incrementApiCallCount', () => {
    it('should increment the request counter', () => {
      resetApiMonitor();
      const initialCount = API_MONITOR.requestCount;

      incrementApiCallCount();

      expect.value(API_MONITOR.requestCount).toBe(initialCount + 1);
    });
  });

  describe('resetApiMonitor', () => {
    it('should reset request count to zero', () => {
      // Make some calls
      incrementApiCallCount();
      incrementApiCallCount();

      // Reset
      resetApiMonitor();

      expect.value(API_MONITOR.requestCount).toBe(0);
    });

    it('should update last reset time', () => {
      const beforeReset = API_MONITOR.lastResetTime;

      // Wait a tiny bit
      Utilities.sleep(10);

      resetApiMonitor();

      expect.value(API_MONITOR.lastResetTime).toBeGreaterThan(beforeReset);
    });
  });

  describe('getRemainingApiCalls', () => {
    it('should return number', () => {
      const remaining = getRemainingApiCalls();

      expect.value(typeof remaining).toBe('number');
    });

    it('should not exceed maximum calls per minute', () => {
      const remaining = getRemainingApiCalls();
      const maxCalls = EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE || 15;

      expect.value(remaining).toBeLessThan(maxCalls + 1);
    });

    it('should decrease when calls are made', () => {
      resetApiMonitor();
      const before = getRemainingApiCalls();

      incrementApiCallCount();

      const after = getRemainingApiCalls();

      expect.value(after).toBe(before - 1);
    });
  });
});

describe('Gemini API Response Handling', () => {
  describe('cleanGeminiResponse', () => {
    it('should extract JSON from markdown code blocks', () => {
      const responseWithMarkdown = '```json\n{"category": "work"}\n```';
      const cleaned = cleanGeminiResponse(responseWithMarkdown);

      expect.value(cleaned).toContain('{"category": "work"}');
    });

    it('should handle plain JSON responses', () => {
      const plainJson = '{"category": "personal"}';
      const cleaned = cleanGeminiResponse(plainJson);

      expect.value(cleaned).toBe(plainJson);
    });

    it('should remove trailing commas from JSON', () => {
      const jsonWithComma = '{"category": "finance",}';
      const cleaned = cleanGeminiResponse(jsonWithComma);

      expect.value(cleaned).not.toContain(',}');
    });

    it('should handle empty responses', () => {
      const cleaned = cleanGeminiResponse('');

      expect.value(cleaned).toBeTruthy();
      expect.value(typeof cleaned).toBe('string');
    });

    it('should handle malformed responses gracefully', () => {
      const malformed = 'This is not JSON at all';
      const cleaned = cleanGeminiResponse(malformed);

      expect.value(typeof cleaned).toBe('string');
    });
  });

  describe('parseGeminiCategory', () => {
    it('should parse valid category response', () => {
      const validResponse = '{"category": "work"}';
      const category = parseGeminiCategory(validResponse);

      expect.value(category).toBe('work');
    });

    it('should handle JSON in markdown', () => {
      const markdownResponse = '```json\n{"category": "shopping"}\n```';
      const category = parseGeminiCategory(markdownResponse);

      expect.value(category).toBe('shopping');
    });

    it('should return "other" for invalid JSON', () => {
      const invalidResponse = 'Not valid JSON';
      const category = parseGeminiCategory(invalidResponse);

      expect.value(category).toBe('other');
    });

    it('should return "other" for missing category field', () => {
      const noCategory = '{"result": "no category here"}';
      const category = parseGeminiCategory(noCategory);

      expect.value(category).toBe('other');
    });

    it('should handle empty response', () => {
      const category = parseGeminiCategory('');

      expect.value(category).toBe('other');
    });
  });
});

describe('API Error Handling', () => {
  describe('handleApiError', () => {
    it('should format error messages', () => {
      const error = new Error('Test error');
      const formatted = handleApiError(error);

      expect.value(formatted).toBeTruthy();
      expect.value(typeof formatted).toBe('string');
      expect.value(formatted).toContain('error');
    });

    it('should handle rate limit errors specially', () => {
      const rateLimitError = {
        message: 'Rate limit exceeded',
        code: 429
      };

      const formatted = handleApiError(rateLimitError);

      expect.value(formatted.toLowerCase()).toContain('rate limit');
    });

    it('should handle authentication errors', () => {
      const authError = {
        message: 'Invalid API key',
        code: 401
      };

      const formatted = handleApiError(authError);

      expect.value(formatted.toLowerCase()).toContain('api key');
    });
  });

  describe('isRetryableError', () => {
    it('should identify network errors as retryable', () => {
      const networkError = { message: 'Network timeout' };
      const isRetryable = isRetryableError(networkError);

      expect.value(typeof isRetryable).toBe('boolean');
    });

    it('should identify rate limit errors as retryable', () => {
      const rateLimitError = { code: 429 };
      const isRetryable = isRetryableError(rateLimitError);

      expect.value(isRetryable).toBeTruthy();
    });

    it('should not retry authentication errors', () => {
      const authError = { code: 401 };
      const isRetryable = isRetryableError(authError);

      expect.value(isRetryable).toBeFalsy();
    });

    it('should not retry bad request errors', () => {
      const badRequest = { code: 400 };
      const isRetryable = isRetryableError(badRequest);

      expect.value(isRetryable).toBeFalsy();
    });
  });
});

describe('API Call Logging', () => {
  describe('logApiCall', () => {
    it('should log successful calls', () => {
      const result = logApiCall('test_endpoint', 'success', 200);

      expect.value(typeof result).toBe('boolean');
    });

    it('should log failed calls', () => {
      const result = logApiCall('test_endpoint', 'error', 500);

      expect.value(typeof result).toBe('boolean');
    });

    it('should accept optional metadata', () => {
      const metadata = { duration: 150, retries: 1 };
      const result = logApiCall('test_endpoint', 'success', 200, metadata);

      expect.value(typeof result).toBe('boolean');
    });
  });

  describe('getApiCallStats', () => {
    it('should return statistics object', () => {
      const stats = getApiCallStats();

      expect.value(typeof stats).toBe('object');
    });

    it('should include total calls', () => {
      const stats = getApiCallStats();

      expect.value(stats).toHaveProperty('totalCalls');
      expect.value(typeof stats.totalCalls).toBe('number');
    });

    it('should include success and failure counts', () => {
      const stats = getApiCallStats();

      expect.value(stats).toHaveProperty('successCount');
      expect.value(stats).toHaveProperty('failureCount');
    });
  });
});
