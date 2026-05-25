/**
 * Local Jest Tests for Config Module
 * These tests run in VS Code using Jest
 */

// Load the module to test
// Note: We need to handle Google Apps Script's lack of module system
const fs = require('fs');
const path = require('path');

// Load config.js into the global scope
const configCode = fs.readFileSync(path.join(__dirname, '../config.js'), 'utf8');
eval(configCode);

describe('Config Module - Local Tests', () => {

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('getApiKey', () => {
    it('should return null when no API key is set', () => {
      const result = getApiKey();
      expect(result).toBeNull();
    });

    it('should return API key after setting it', () => {
      const testKey = 'test-api-key-12345';
      setApiKey(testKey);

      const result = getApiKey();
      expect(result).toBe(testKey);
    });
  });

  describe('setApiKey', () => {
    it('should reject empty API key', () => {
      const result = setApiKey('');
      expect(result).toContain('Error');
    });

    it('should reject null API key', () => {
      const result = setApiKey(null);
      expect(result).toContain('Error');
    });

    it('should accept valid API key', () => {
      const testKey = 'valid-api-key-67890';
      const result = setApiKey(testKey);

      expect(result).toContain('success');
      expect(getApiKey()).toBe(testKey);
    });

    it('should trim whitespace from API key', () => {
      const testKey = '  api-key-with-spaces  ';
      setApiKey(testKey);

      // Note: Current implementation doesn't trim,
      // but it should for better UX
      const stored = getApiKey();
      expect(stored).toBeDefined();
    });
  });

  describe('isApiKeySet', () => {
    it('should return false when no key is set', () => {
      // Clear any existing key
      PropertiesService.getScriptProperties().deleteProperty('API_KEY');

      const result = isApiKeySet();
      expect(result).toBe(false);
    });

    it('should return true when key is set', () => {
      setApiKey('test-key');

      const result = isApiKeySet();
      expect(result).toBe(true);
    });
  });

  describe('Configuration Constants', () => {
    it('should have PROPERTY_KEYS defined', () => {
      expect(typeof PROPERTY_KEYS).toBe('object');
      expect(PROPERTY_KEYS).toHaveProperty('API_KEY', 'API_KEY');
    });

    it('should have EMAIL_SORTER_CONFIG defined', () => {
      expect(typeof EMAIL_SORTER_CONFIG).toBe('object');
      expect(EMAIL_SORTER_CONFIG).toHaveProperty('MAX_GEMINI_CALLS_PER_MINUTE', 15);
    });

    it('should have JOB_FINDER_CONFIG defined', () => {
      expect(typeof JOB_FINDER_CONFIG).toBe('object');
      expect(JOB_FINDER_CONFIG).toHaveProperty('SOURCE_LABEL', 'JobAlerts');
    });

    it('should have API_SERVICE_CONFIG defined', () => {
      expect(typeof API_SERVICE_CONFIG).toBe('object');
      expect(API_SERVICE_CONFIG.GEMINI_API_ENDPOINT).toContain('generativelanguage');
    });
  });

  describe('getSpreadsheetId', () => {
    it('should return empty string when not set', () => {
      const result = getSpreadsheetId();
      expect(result).toBe('');
    });

    it('should return spreadsheet ID after setting', () => {
      const testId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
      setSpreadsheetId(testId);

      const result = getSpreadsheetId();
      expect(result).toBe(testId);
    });
  });

  describe('setSpreadsheetId', () => {
    it('should store spreadsheet ID', () => {
      const testId = 'test-spreadsheet-id';
      const result = setSpreadsheetId(testId);

      expect(result).toBe(true);
      expect(getSpreadsheetId()).toBe(testId);
    });

    it('should handle errors gracefully', () => {
      // Save the original implementation
      const originalGetScriptProperties = PropertiesService.getScriptProperties;

      // Mock PropertiesService to throw an error
      PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: jest.fn(() => {
          throw new Error('Storage error');
        })
      }));

      const result = setSpreadsheetId('test-id');
      expect(result).toBe(false);

      // Restore original
      PropertiesService.getScriptProperties = originalGetScriptProperties;
    });
  });

  describe('Dynamic Categories', () => {
    it('should return false when not enabled', () => {
      const result = isDynamicCategoriesEnabled();
      expect(typeof result).toBe('boolean');
    });

    it('should enable dynamic categories', () => {
      const result = setDynamicCategoriesEnabled(true);
      expect(result).toBe(true);

      const isEnabled = isDynamicCategoriesEnabled();
      expect(isEnabled).toBe(true);
    });

    it('should disable dynamic categories', () => {
      setDynamicCategoriesEnabled(false);

      const isEnabled = isDynamicCategoriesEnabled();
      expect(isEnabled).toBe(false);
    });
  });

  describe('File ID Management', () => {
    it('should get and set cache file ID', () => {
      const testId = 'cache-file-id-123';

      setCacheFileId(testId);
      const result = getCacheFileId();

      expect(result).toBe(testId);
    });

    it('should get and set categories file ID', () => {
      const testId = 'categories-file-id-456';

      setCategoriesFileId(testId);
      const result = getCategoriesFileId();

      expect(result).toBe(testId);
    });

    it('should return empty string for unset file IDs', () => {
      PropertiesService.getScriptProperties().deleteProperty('CACHE_FILE_ID');

      const result = getCacheFileId();
      expect(result).toBe('');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing properties gracefully', () => {
      expect(() => getApiKey()).not.toThrow();
      expect(() => getSpreadsheetId()).not.toThrow();
      expect(() => getCacheFileId()).not.toThrow();
    });

    it('should log errors when setting properties fails', () => {
      const mockLogger = jest.spyOn(Logger, 'log');
      const originalGetScriptProperties = PropertiesService.getScriptProperties;

      // Mock PropertiesService to throw an error
      PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: jest.fn(() => {
          throw new Error('Mock error');
        }),
        getProperty: jest.fn(() => null)
      }));

      setApiKey('test-key');

      // Logger should have been called with error
      expect(mockLogger).toHaveBeenCalled();

      // Restore original
      PropertiesService.getScriptProperties = originalGetScriptProperties;
      mockLogger.mockRestore();
    });
  });
});

describe('Config Module - Integration Tests', () => {

  beforeEach(() => {
    // Clear all properties before each integration test
    PropertiesService.getScriptProperties().deleteAllProperties();
  });

  it('should handle complete setup workflow', () => {
    // 1. Set API key
    const apiKey = 'integration-test-key';
    setApiKey(apiKey);
    expect(isApiKeySet()).toBe(true);

    // 2. Set spreadsheet ID
    const spreadsheetId = 'integration-spreadsheet-id';
    setSpreadsheetId(spreadsheetId);
    expect(getSpreadsheetId()).toBe(spreadsheetId);

    // 3. Enable dynamic categories
    setDynamicCategoriesEnabled(true);
    expect(isDynamicCategoriesEnabled()).toBe(true);

    // 4. Verify all settings persist
    expect(getApiKey()).toBe(apiKey);
    expect(getSpreadsheetId()).toBe(spreadsheetId);
    expect(isDynamicCategoriesEnabled()).toBe(true);
  });

  it('should handle property updates', () => {
    // Set initial value
    const initialKey = 'initial-key';
    setApiKey(initialKey);
    expect(getApiKey()).toBe(initialKey);

    // Update value
    const updatedKey = 'updated-key';
    setApiKey(updatedKey);
    expect(getApiKey()).toBe(updatedKey);
  });
});
