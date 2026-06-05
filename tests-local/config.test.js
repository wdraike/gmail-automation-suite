/**
 * Local Jest Tests for Config Module
 * These tests run in VS Code using Jest
 */

// Load the module to test (using require for proper coverage tracking)
const {
  PROPERTY_KEYS,
  EMAIL_SORTER_CONFIG,
  JOB_FINDER_CONFIG,
  API_SERVICE_CONFIG,
  getApiKey,
  setApiKey,
  isApiKeySet,
  getSpreadsheetId,
  setSpreadsheetId,
  isDynamicCategoriesEnabled,
  setDynamicCategoriesEnabled,
  getCacheFileId,
  setCacheFileId,
  getCategoriesFileId,
  setCategoriesFileId,
  getJobFinderSourceLabel,
  setJobFinderSourceLabel,
  getJobFinderProcessedLabel,
  setJobFinderProcessedLabel,
  getJobFinderRateLimitLabel,
  setJobFinderRateLimitLabel,
  getJobFinderNoJobsLabel,
  setJobFinderNoJobsLabel
} = require('../src/core/config.js');

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

      const stored = getApiKey();
      expect(stored).toBe('api-key-with-spaces');
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
      expect(JOB_FINDER_CONFIG).toHaveProperty('SOURCE_LABEL', '📬 JobAlerts');
    });

    it('should have API_SERVICE_CONFIG defined', () => {
      expect(typeof API_SERVICE_CONFIG).toBe('object');
      expect(API_SERVICE_CONFIG.GEMINI_API_ENDPOINT).toContain('generativelanguage');
    });

    // Regression lock for leg1-sheet-cleanup (Phase 1): the production sheet schema
    // must be exactly 18 columns with the Careers URL columns removed, and the
    // BACKUP_SHEET_NAME constant must no longer exist. This asserts the REAL config
    // (config.test.js requires the actual module), not a test-local mock.
    it('SHEET_COLUMNS is the final 18-column set with no Careers URL columns', () => {
      const cols = JOB_FINDER_CONFIG.SHEET_COLUMNS;
      expect(cols.length).toBe(18);
      expect(cols).not.toContain('Careers URL');
      expect(cols).not.toContain('Careers URL Status');
      expect(cols).toEqual([
        'Company', 'Company Description', 'Job Title', 'Employment Type',
        'Work Arrangement', 'Experience Level', 'Location',
        'Minimum Salary', 'Maximum Salary', 'Salary Period',
        'Job URL', 'URL Status',
        'Email Received Date', 'Email Source', 'Date Added',
        'Interest', 'Email Title', 'Jobs Found In Email'
      ]);
    });

    it('no longer defines BACKUP_SHEET_NAME (dedup/backup routing removed)', () => {
      expect(JOB_FINDER_CONFIG.BACKUP_SHEET_NAME).toBeUndefined();
      expect(Object.prototype.hasOwnProperty.call(JOB_FINDER_CONFIG, 'BACKUP_SHEET_NAME')).toBe(false);
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

  describe('Job Finder Label Configuration', () => {
    beforeEach(() => {
      PropertiesService.getScriptProperties().deleteProperty('JOB_FINDER_SOURCE_LABEL');
      PropertiesService.getScriptProperties().deleteProperty('JOB_FINDER_PROCESSED_LABEL');
      PropertiesService.getScriptProperties().deleteProperty('JOB_FINDER_RATE_LIMIT_LABEL');
      PropertiesService.getScriptProperties().deleteProperty('JOB_FINDER_NO_JOBS_LABEL');
    });

    it('getJobFinderSourceLabel returns default when not set', () => {
      expect(getJobFinderSourceLabel()).toBe(JOB_FINDER_CONFIG.SOURCE_LABEL);
    });

    it('getJobFinderSourceLabel returns stored value when set', () => {
      setJobFinderSourceLabel('MyJobs');
      expect(getJobFinderSourceLabel()).toBe('MyJobs');
    });

    it('setJobFinderSourceLabel returns true on success', () => {
      expect(setJobFinderSourceLabel('MyJobs')).toBe(true);
    });

    it('getJobFinderProcessedLabel returns default when not set', () => {
      expect(getJobFinderProcessedLabel()).toBe(JOB_FINDER_CONFIG.PROCESSED_LABEL);
    });

    it('getJobFinderProcessedLabel returns stored value when set', () => {
      setJobFinderProcessedLabel('MyJobs/Done');
      expect(getJobFinderProcessedLabel()).toBe('MyJobs/Done');
    });

    it('setJobFinderProcessedLabel returns true on success', () => {
      expect(setJobFinderProcessedLabel('MyJobs/Done')).toBe(true);
    });

    it('getJobFinderRateLimitLabel returns default when not set', () => {
      expect(getJobFinderRateLimitLabel()).toBe(JOB_FINDER_CONFIG.RATE_LIMIT_LABEL);
    });

    it('getJobFinderRateLimitLabel returns stored value when set', () => {
      setJobFinderRateLimitLabel('MyJobs/Queue');
      expect(getJobFinderRateLimitLabel()).toBe('MyJobs/Queue');
    });

    it('setJobFinderRateLimitLabel returns true on success', () => {
      expect(setJobFinderRateLimitLabel('MyJobs/Queue')).toBe(true);
    });

    it('setter returns false when properties storage throws', () => {
      const orig = PropertiesService.getScriptProperties;
      PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: jest.fn(() => { throw new Error('storage error'); }),
        getProperty: jest.fn(() => null)
      }));
      expect(setJobFinderSourceLabel('x')).toBe(false);
      expect(setJobFinderProcessedLabel('x')).toBe(false);
      expect(setJobFinderRateLimitLabel('x')).toBe(false);
      PropertiesService.getScriptProperties = orig;
    });

    it('getJobFinderNoJobsLabel returns default when not set', () => {
      expect(getJobFinderNoJobsLabel()).toBe('📬 JobAlerts/NoJobs');
    });

    it('getJobFinderNoJobsLabel returns stored value when set', () => {
      setJobFinderNoJobsLabel('MyJobs/NoJobs');
      expect(getJobFinderNoJobsLabel()).toBe('MyJobs/NoJobs');
    });

    it('setJobFinderNoJobsLabel returns true on success', () => {
      expect(setJobFinderNoJobsLabel('MyJobs/NoJobs')).toBe(true);
    });

    it('setJobFinderNoJobsLabel returns false when properties storage throws', () => {
      const orig = PropertiesService.getScriptProperties;
      PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: jest.fn(() => { throw new Error('storage error'); }),
        getProperty: jest.fn(() => null)
      }));
      expect(setJobFinderNoJobsLabel('x')).toBe(false);
      PropertiesService.getScriptProperties = orig;
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
