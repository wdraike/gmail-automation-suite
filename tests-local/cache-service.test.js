/**
 * Cache Service Tests
 * Comprehensive tests for unified caching system
 */

// Load modules using require for proper coverage tracking
const config = require('../src/core/config.js');
const {
  CACHE_CONFIG,
  UnifiedCacheCore,
  EmailCategoriesCache,
  LabelCategoriesCache,
  CategoryDefinitionsCache,
  RetentionRulesCache,
  UnifiedCacheService
} = require('../src/core/cache-service.js');
// Cache/Properties/Drive access is routed through serviceFactory ports; the real
// adapters delegate to the global mocks. Tests reassign those globals per-test,
// so reset the factory each test to rebind the adapters to the current globals.
const { serviceFactory } = require('../src/core/services/index.js');

describe('Cache Service - Complete Test Suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    serviceFactory.reset();
  });

  afterEach(() => {
    serviceFactory.reset();
  });

  describe('CACHE_CONFIG', () => {
    it('should have correct cache keys defined', () => {
      expect(CACHE_CONFIG.KEYS).toBeDefined();
      expect(CACHE_CONFIG.KEYS.EMAIL_CATEGORIES).toBe('EMAIL_CATEGORIES_CACHE');
      expect(CACHE_CONFIG.KEYS.LABEL_CATEGORIES).toBe('LABEL_CATEGORIES_MAP');
      expect(CACHE_CONFIG.KEYS.GMAIL_LABELS).toBe('GMAIL_LABELS_CACHE');
    });

    it('should have correct duration constants', () => {
      expect(CACHE_CONFIG.DURATIONS).toBeDefined();
      expect(CACHE_CONFIG.DURATIONS.SHORT).toBe(300);
      expect(CACHE_CONFIG.DURATIONS.MEDIUM).toBe(3600);
      expect(CACHE_CONFIG.DURATIONS.LONG).toBe(86400);
      expect(CACHE_CONFIG.DURATIONS.PERMANENT).toBe(-1);
    });

    it('should have correct storage types', () => {
      expect(CACHE_CONFIG.STORAGE).toBeDefined();
      expect(CACHE_CONFIG.STORAGE.CACHE).toBe('cache');
      expect(CACHE_CONFIG.STORAGE.PROPERTIES).toBe('properties');
      expect(CACHE_CONFIG.STORAGE.DRIVE).toBe('drive');
    });
  });

  describe('UnifiedCacheCore.get', () => {
    it('should get data from CacheService', () => {
      const testData = { name: 'test', value: 123 };

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          get: jest.fn(() => JSON.stringify(testData))
        }))
      };

      const result = UnifiedCacheCore.get('TEST_KEY');

      expect(result).toEqual(testData);
      expect(CacheService.getScriptCache).toHaveBeenCalled();
    });

    it('should return null when cache miss', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          get: jest.fn(() => null)
        }))
      };

      const result = UnifiedCacheCore.get('NONEXISTENT_KEY');

      expect(result).toBeNull();
    });

    it('should get data from PropertiesService', () => {
      const testData = { setting: 'value' };

      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn(() => JSON.stringify(testData))
        }))
      };

      const result = UnifiedCacheCore.get('TEST_KEY', CACHE_CONFIG.STORAGE.PROPERTIES);

      expect(result).toEqual(testData);
      expect(PropertiesService.getScriptProperties).toHaveBeenCalled();
    });

    it('should return null on properties miss', () => {
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn(() => null)
        }))
      };

      const result = UnifiedCacheCore.get('NONEXISTENT_KEY', CACHE_CONFIG.STORAGE.PROPERTIES);

      expect(result).toBeNull();
    });

    it('should handle JSON parse errors gracefully', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          get: jest.fn(() => 'invalid json {{{')
        }))
      };

      const result = UnifiedCacheCore.get('BAD_JSON_KEY');

      expect(result).toBeNull();
    });

    it('should handle cache service errors', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => {
          throw new Error('Cache service error');
        })
      };

      const result = UnifiedCacheCore.get('TEST_KEY');

      expect(result).toBeNull();
    });
  });

  describe('UnifiedCacheCore.set', () => {
    it('should set data in CacheService with default duration', () => {
      const testData = { name: 'test', value: 123 };
      const mockPut = jest.fn();

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: mockPut
        }))
      };

      UnifiedCacheCore.set('TEST_KEY', testData);

      expect(mockPut).toHaveBeenCalledWith(
        'TEST_KEY',
        JSON.stringify(testData),
        CACHE_CONFIG.DURATIONS.SHORT // Default is SHORT (300s)
      );
    });

    it('should set data with custom duration', () => {
      const testData = { name: 'test' };
      const mockPut = jest.fn();

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: mockPut
        }))
      };

      UnifiedCacheCore.set('TEST_KEY', testData, CACHE_CONFIG.DURATIONS.LONG);

      expect(mockPut).toHaveBeenCalledWith(
        'TEST_KEY',
        JSON.stringify(testData),
        CACHE_CONFIG.DURATIONS.LONG
      );
    });

    it('should set data in PropertiesService', () => {
      const testData = { setting: 'value' };
      const mockSetProperty = jest.fn();

      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          setProperty: mockSetProperty
        }))
      };

      UnifiedCacheCore.set('TEST_KEY', testData, CACHE_CONFIG.DURATIONS.PERMANENT, CACHE_CONFIG.STORAGE.PROPERTIES);

      expect(mockSetProperty).toHaveBeenCalledWith(
        'TEST_KEY',
        JSON.stringify(testData)
      );
    });

    it('should handle set errors gracefully', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: jest.fn(() => {
            throw new Error('Cache service error');
          })
        }))
      };

      // Should not throw
      expect(() => {
        UnifiedCacheCore.set('TEST_KEY', { data: 'test' });
      }).not.toThrow();
    });

    it('should handle null data', () => {
      const mockPut = jest.fn();

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: mockPut
        }))
      };

      UnifiedCacheCore.set('TEST_KEY', null);

      expect(mockPut).toHaveBeenCalledWith(
        'TEST_KEY',
        'null',
        CACHE_CONFIG.DURATIONS.SHORT
      );
    });

    it('should handle undefined data', () => {
      const mockPut = jest.fn();

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: mockPut
        }))
      };

      UnifiedCacheCore.set('TEST_KEY', undefined);

      // undefined becomes null in JSON
      expect(mockPut).toHaveBeenCalled();
    });
  });

  describe('UnifiedCacheCore.delete', () => {
    it('should delete data from CacheService', () => {
      const mockRemove = jest.fn();

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          remove: mockRemove
        }))
      };

      UnifiedCacheCore.delete('TEST_KEY');

      expect(mockRemove).toHaveBeenCalledWith('TEST_KEY');
    });

    it('should delete data from PropertiesService', () => {
      const mockDeleteProperty = jest.fn();

      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          deleteProperty: mockDeleteProperty
        }))
      };

      UnifiedCacheCore.delete('TEST_KEY', CACHE_CONFIG.STORAGE.PROPERTIES);

      expect(mockDeleteProperty).toHaveBeenCalledWith('TEST_KEY');
    });

    it('should handle delete errors gracefully', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          remove: jest.fn(() => {
            throw new Error('Remove error');
          })
        }))
      };

      // Should not throw
      expect(() => {
        UnifiedCacheCore.delete('TEST_KEY');
      }).not.toThrow();
    });
  });

  describe('UnifiedCacheCore.clearAll', () => {
    it('should clear all data from CacheService', () => {
      const mockRemoveAll = jest.fn();

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          removeAll: mockRemoveAll
        }))
      };

      UnifiedCacheCore.clearAll();

      expect(mockRemoveAll).toHaveBeenCalled();
    });

    it('should handle clear errors gracefully', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          removeAll: jest.fn(() => {
            throw new Error('Clear error');
          })
        }))
      };

      // Should not throw
      expect(() => {
        UnifiedCacheCore.clearAll();
      }).not.toThrow();
    });
  });

  describe('Cache Expiration', () => {
    it('should respect SHORT duration', () => {
      const mockPut = jest.fn();
      global.CacheService = {
        getScriptCache: jest.fn(() => ({ put: mockPut }))
      };

      UnifiedCacheCore.set('KEY', { data: 'test' }, CACHE_CONFIG.DURATIONS.SHORT);

      expect(mockPut).toHaveBeenCalledWith(
        'KEY',
        expect.any(String),
        300 // 5 minutes
      );
    });

    it('should respect MEDIUM duration', () => {
      const mockPut = jest.fn();
      global.CacheService = {
        getScriptCache: jest.fn(() => ({ put: mockPut }))
      };

      UnifiedCacheCore.set('KEY', { data: 'test' }, CACHE_CONFIG.DURATIONS.MEDIUM);

      expect(mockPut).toHaveBeenCalledWith(
        'KEY',
        expect.any(String),
        3600 // 1 hour
      );
    });

    it('should respect LONG duration', () => {
      const mockPut = jest.fn();
      global.CacheService = {
        getScriptCache: jest.fn(() => ({ put: mockPut }))
      };

      UnifiedCacheCore.set('KEY', { data: 'test' }, CACHE_CONFIG.DURATIONS.LONG);

      expect(mockPut).toHaveBeenCalledWith(
        'KEY',
        expect.any(String),
        86400 // 24 hours
      );
    });
  });

  describe('Complex Data Types', () => {
    it('should handle arrays', () => {
      const testArray = [1, 2, 3, 'test', { nested: true }];
      const mockPut = jest.fn();

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: mockPut,
          get: jest.fn(() => JSON.stringify(testArray))
        }))
      };

      UnifiedCacheCore.set('ARRAY_KEY', testArray);
      const result = UnifiedCacheCore.get('ARRAY_KEY');

      expect(result).toEqual(testArray);
    });

    it('should handle nested objects', () => {
      const testObject = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          },
          array: [1, 2, 3]
        }
      };

      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: jest.fn(),
          get: jest.fn(() => JSON.stringify(testObject))
        }))
      };

      UnifiedCacheCore.set('NESTED_KEY', testObject);
      const result = UnifiedCacheCore.get('NESTED_KEY');

      expect(result).toEqual(testObject);
    });

    it('should handle boolean values', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: jest.fn(),
          get: jest.fn(() => JSON.stringify(true))
        }))
      };

      UnifiedCacheCore.set('BOOL_KEY', true);
      const result = UnifiedCacheCore.get('BOOL_KEY');

      expect(result).toBe(true);
    });

    it('should handle number values', () => {
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: jest.fn(),
          get: jest.fn(() => JSON.stringify(42.5))
        }))
      };

      UnifiedCacheCore.set('NUMBER_KEY', 42.5);
      const result = UnifiedCacheCore.get('NUMBER_KEY');

      expect(result).toBe(42.5);
    });

    it('should handle string values', () => {
      const testString = 'Hello, World!';
      global.CacheService = {
        getScriptCache: jest.fn(() => ({
          put: jest.fn(),
          get: jest.fn(() => JSON.stringify(testString))
        }))
      };

      UnifiedCacheCore.set('STRING_KEY', testString);
      const result = UnifiedCacheCore.get('STRING_KEY');

      expect(result).toBe(testString);
    });
  });
});
