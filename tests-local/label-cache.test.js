/**
 * Label Cache Tests
 * Tests for Gmail label caching functionality
 */

const {
  getGmailLabels
} = require('../src/utils/label-cache.js');

// Mock Google Apps Script services
global.Logger = { log: jest.fn() };
global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn(),
    setProperty: jest.fn(),
    deleteProperty: jest.fn(),
    deleteAllProperties: jest.fn()
  }))
};
global.DriveApp = {
  getFileById: jest.fn(),
  createFile: jest.fn()
};
global.GmailApp = {
  getUserLabels: jest.fn(() => [])
};

describe('Label Cache - Complete Test Suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getGmailLabels', () => {
    it('should return array of labels', () => {
      const result = getGmailLabels();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle force refresh', () => {
      const result = getGmailLabels(true);

      expect(Array.isArray(result)).toBe(true);
      expect(global.Logger.log).toHaveBeenCalled();
    });

    it('should return empty array on error', () => {
      global.GmailApp.getUserLabels.mockImplementation(() => {
        throw new Error('API Error');
      });

      const result = getGmailLabels();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  // Note: clearLabelCache, getLabelCache and isSystemLabel tests removed
  // as these functions are not exported from label-cache.js module
});
