/**
 * GeminiAdapter Tests
 * Wraps the global callGeminiApi(prompt, operationType) function so feature
 * code never references callGeminiApi directly.
 */

const { GeminiAdapter } = require('../src/core/services/gemini-adapter.js');

describe('GeminiAdapter', () => {
  let adapter;
  let mockCallGeminiApi;

  beforeEach(() => {
    mockCallGeminiApi = jest.fn();
    adapter = new GeminiAdapter(mockCallGeminiApi);
  });

  describe('constructor', () => {
    it('should store the injected callGeminiApi function', () => {
      expect(adapter.callGeminiApi).toBe(mockCallGeminiApi);
    });

    it('should fall back to global callGeminiApi when none injected', () => {
      const original = global.callGeminiApi;
      const globalFn = jest.fn();
      global.callGeminiApi = globalFn;
      try {
        const a = new GeminiAdapter();
        expect(a.callGeminiApi).toBe(globalFn);
      } finally {
        global.callGeminiApi = original;
      }
    });
  });

  describe('call', () => {
    it('should delegate to callGeminiApi with prompt and operationType', () => {
      const expected = { success: true, response: 'ok', jobs: [] };
      mockCallGeminiApi.mockReturnValue(expected);

      const result = adapter.call('my prompt', 'job_extraction');

      expect(mockCallGeminiApi).toHaveBeenCalledWith('my prompt', 'job_extraction');
      expect(result).toBe(expected);
    });

    it('should propagate errors from callGeminiApi', () => {
      mockCallGeminiApi.mockImplementation(() => {
        throw new Error('Gemini API error');
      });

      expect(() => adapter.call('p', 'job_extraction')).toThrow('Gemini API error');
    });
  });
});
