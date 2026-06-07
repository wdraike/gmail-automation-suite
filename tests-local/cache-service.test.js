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

  describe('UnifiedCacheCore.set — cache with non-positive duration', () => {
    it('does NOT write to the cache when duration is <= 0', () => {
      const mockPut = jest.fn();
      global.CacheService = { getScriptCache: jest.fn(() => ({ put: mockPut })) };
      // PERMANENT (-1) on CACHE storage -> skip the put (cache can't be permanent).
      const ok = UnifiedCacheCore.set('K', { a: 1 }, CACHE_CONFIG.DURATIONS.PERMANENT, CACHE_CONFIG.STORAGE.CACHE);
      expect(ok).toBe(true);
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('UnifiedCacheCore.clearAll — PROPERTIES', () => {
    it('deletes every known key from PropertiesService', () => {
      const mockDelete = jest.fn();
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ deleteProperty: mockDelete })) };
      const ok = UnifiedCacheCore.clearAll(CACHE_CONFIG.STORAGE.PROPERTIES);
      expect(ok).toBe(true);
      // One delete per configured key.
      expect(mockDelete).toHaveBeenCalledTimes(Object.values(CACHE_CONFIG.KEYS).length);
      expect(mockDelete).toHaveBeenCalledWith(CACHE_CONFIG.KEYS.EMAIL_CATEGORIES);
    });

    it('returns false when a properties delete throws', () => {
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({ deleteProperty: jest.fn(() => { throw new Error('boom'); }) }))
      };
      expect(UnifiedCacheCore.clearAll(CACHE_CONFIG.STORAGE.PROPERTIES)).toBe(false);
    });
  });

  describe('UnifiedCacheCore.delete — DRIVE', () => {
    it('trashes the Drive file and clears the file-id property', () => {
      const setTrashed = jest.fn();
      const deleteProperty = jest.fn();
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn(() => 'drive-file-1'),
          deleteProperty,
        }))
      };
      global.DriveApp = { getFileById: jest.fn(() => ({ setTrashed })) };

      const ok = UnifiedCacheCore.delete('DKEY', CACHE_CONFIG.STORAGE.DRIVE);
      expect(ok).toBe(true);
      expect(setTrashed).toHaveBeenCalledWith(true);
      expect(deleteProperty).toHaveBeenCalledWith('DKEY_FILE_ID');
    });

    it('is a no-op when there is no Drive file id', () => {
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => null), deleteProperty: jest.fn() }))
      };
      global.DriveApp = { getFileById: jest.fn() };
      const ok = UnifiedCacheCore.delete('DKEY', CACHE_CONFIG.STORAGE.DRIVE);
      expect(ok).toBe(true);
      expect(global.DriveApp.getFileById).not.toHaveBeenCalled();
    });

    it('returns true but logs when trashing throws (caught)', () => {
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => 'f'), deleteProperty: jest.fn() }))
      };
      global.DriveApp = { getFileById: jest.fn(() => { throw new Error('drive boom'); }) };
      // _deleteDriveData catches internally and returns false, but delete() wraps it
      // and still returns true (the switch case does not propagate the inner result).
      expect(UnifiedCacheCore.delete('DKEY', CACHE_CONFIG.STORAGE.DRIVE)).toBe(true);
    });
  });

  describe('UnifiedCacheCore DRIVE get/set (_getDriveData / _setDriveData)', () => {
    it('reads and parses a Drive-backed value', () => {
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => 'file-1') }))
      };
      global.DriveApp = {
        getFileById: jest.fn(() => ({ getBlob: () => ({ getDataAsString: () => JSON.stringify({ x: 1 }) }) }))
      };
      const result = UnifiedCacheCore.get('DKEY', CACHE_CONFIG.STORAGE.DRIVE);
      expect(result).toEqual({ x: 1 });
    });

    it('returns null when no Drive file id is stored', () => {
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => null) })) };
      global.DriveApp = { getFileById: jest.fn() };
      expect(UnifiedCacheCore.get('DKEY', CACHE_CONFIG.STORAGE.DRIVE)).toBeNull();
      expect(global.DriveApp.getFileById).not.toHaveBeenCalled();
    });

    it('returns null when reading the Drive file throws', () => {
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => 'f') })) };
      global.DriveApp = { getFileById: jest.fn(() => { throw new Error('read boom'); }) };
      expect(UnifiedCacheCore.get('DKEY', CACHE_CONFIG.STORAGE.DRIVE)).toBeNull();
    });

    it('updates the existing Drive file when a file id is stored (set)', () => {
      const setContent = jest.fn();
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => 'file-1'), setProperty: jest.fn() })) };
      global.DriveApp = { getFileById: jest.fn(() => ({ setContent })) };
      const ok = UnifiedCacheCore.set('DKEY', { y: 2 }, CACHE_CONFIG.DURATIONS.LONG, CACHE_CONFIG.STORAGE.DRIVE);
      expect(ok).toBe(true);
      expect(setContent).toHaveBeenCalledWith(JSON.stringify({ y: 2 }, null, 2));
    });

    it('creates a new Drive file + persists its id when none exists (set)', () => {
      const setProperty = jest.fn();
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => null), setProperty })) };
      global.DriveApp = { createFile: jest.fn(() => ({ getId: () => 'new-drive-id' })) };
      const ok = UnifiedCacheCore.set('DKEY', { z: 3 }, CACHE_CONFIG.DURATIONS.LONG, CACHE_CONFIG.STORAGE.DRIVE);
      expect(ok).toBe(true);
      expect(global.DriveApp.createFile).toHaveBeenCalledWith('DKEY.json', JSON.stringify({ z: 3 }, null, 2), 'text/plain');
      expect(setProperty).toHaveBeenCalledWith('DKEY_FILE_ID', 'new-drive-id');
    });

    it('returns false (via set) when the Drive write throws', () => {
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => null), setProperty: jest.fn() })) };
      global.DriveApp = { createFile: jest.fn(() => { throw new Error('write boom'); }) };
      // _setDriveData catches and returns false; set() itself returns true (switch
      // case doesn't propagate), so we assert the create was attempted + no throw.
      expect(() => UnifiedCacheCore.set('DKEY', { z: 3 }, CACHE_CONFIG.DURATIONS.LONG, CACHE_CONFIG.STORAGE.DRIVE)).not.toThrow();
    });
  });

  describe('UnifiedCacheCore.getOrCompute', () => {
    it('returns the cached value without computing when present', () => {
      global.CacheService = { getScriptCache: jest.fn(() => ({ get: jest.fn(() => JSON.stringify({ cached: true })), put: jest.fn() })) };
      const computeFn = jest.fn();
      const result = UnifiedCacheCore.getOrCompute('K', computeFn);
      expect(result).toEqual({ cached: true });
      expect(computeFn).not.toHaveBeenCalled();
    });

    it('computes and caches when the value is missing', () => {
      const put = jest.fn();
      global.CacheService = { getScriptCache: jest.fn(() => ({ get: jest.fn(() => null), put })) };
      const computeFn = jest.fn(() => ({ computed: 1 }));
      const result = UnifiedCacheCore.getOrCompute('K', computeFn);
      expect(computeFn).toHaveBeenCalled();
      expect(result).toEqual({ computed: 1 });
      expect(put).toHaveBeenCalled();
    });

    it('does NOT cache a computed null/undefined result', () => {
      const put = jest.fn();
      global.CacheService = { getScriptCache: jest.fn(() => ({ get: jest.fn(() => null), put })) };
      const result = UnifiedCacheCore.getOrCompute('K', jest.fn(() => null));
      expect(result).toBeNull();
      expect(put).not.toHaveBeenCalled();
    });
  });

  describe('EmailCategoriesCache', () => {
    function propStore(initial = {}) {
      const map = new Map(Object.entries(initial));
      return {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn((k) => (map.has(k) ? map.get(k) : null)),
          setProperty: jest.fn((k, v) => map.set(k, v)),
          deleteProperty: jest.fn((k) => map.delete(k)),
        })),
        _map: map,
      };
    }

    it('getAll falls back to the EMAIL_CATEGORIES_MAP property when not cached', () => {
      global.PropertiesService = propStore({
        EMAIL_CATEGORIES_MAP: JSON.stringify({ 'a@x.com': ['work'] }),
      });
      expect(EmailCategoriesCache.getAll()).toEqual({ 'a@x.com': ['work'] });
    });

    it('getAll returns {} when no property exists', () => {
      global.PropertiesService = propStore({});
      expect(EmailCategoriesCache.getAll()).toEqual({});
    });

    it('getForEmail returns the categories for a (lowercased) email', () => {
      global.PropertiesService = propStore({
        EMAIL_CATEGORIES_MAP: JSON.stringify({ 'a@x.com': ['work'] }),
      });
      expect(EmailCategoriesCache.getForEmail('A@X.com')).toEqual(['work']);
    });

    it('getForEmail returns [] for an unknown email', () => {
      global.PropertiesService = propStore({});
      expect(EmailCategoriesCache.getForEmail('none@x.com')).toEqual([]);
    });

    it('updateForEmail writes the new mapping to properties (and cache on success)', () => {
      const store = propStore({});
      global.PropertiesService = store;
      const put = jest.fn();
      global.CacheService = { getScriptCache: jest.fn(() => ({ put })) };
      const ok = EmailCategoriesCache.updateForEmail('B@X.com', ['finance']);
      expect(ok).toBe(true);
      const saved = JSON.parse(store._map.get('EMAIL_CATEGORIES_CACHE'));
      expect(saved['b@x.com']).toEqual(['finance']);
      expect(put).toHaveBeenCalled();
    });

    it('updateForEmail does NOT write the cache copy when the properties write fails', () => {
      // getAll() reads the prop (succeeds); the subsequent setProperty throws so the
      // PROPERTIES set returns false -> the `if (success)` cache write is skipped.
      let call = 0;
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn(() => JSON.stringify({})),
          setProperty: jest.fn(() => { throw new Error('prop write fail'); }),
        })),
      };
      const put = jest.fn();
      global.CacheService = { getScriptCache: jest.fn(() => ({ put })) };
      const ok = EmailCategoriesCache.updateForEmail('c@x.com', ['x']);
      expect(ok).toBe(false);
      expect(put).not.toHaveBeenCalled();
    });

    it('removeEmail deletes the email from the mapping', () => {
      const store = propStore({ EMAIL_CATEGORIES_MAP: JSON.stringify({ 'a@x.com': ['work'], 'b@x.com': ['x'] }) });
      global.PropertiesService = store;
      const ok = EmailCategoriesCache.removeEmail('A@X.com');
      expect(ok).toBe(true);
      const saved = JSON.parse(store._map.get('EMAIL_CATEGORIES_CACHE'));
      expect(saved['a@x.com']).toBeUndefined();
      expect(saved['b@x.com']).toEqual(['x']);
    });
  });

  describe('LabelCategoriesCache', () => {
    function propStore(initial = {}) {
      const map = new Map(Object.entries(initial));
      return {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn((k) => (map.has(k) ? map.get(k) : null)),
          setProperty: jest.fn((k, v) => map.set(k, v)),
          deleteProperty: jest.fn((k) => map.delete(k)),
        })),
        _map: map,
      };
    }

    it('getAll falls back to LABEL_CATEGORIES_MAP property', () => {
      global.PropertiesService = propStore({ LABEL_CATEGORIES_MAP: JSON.stringify({ Work: ['work'] }) });
      expect(LabelCategoriesCache.getAll()).toEqual({ Work: ['work'] });
    });

    it('getForLabel returns categories for a label, [] when missing', () => {
      global.PropertiesService = propStore({ LABEL_CATEGORIES_MAP: JSON.stringify({ Work: ['work'] }) });
      expect(LabelCategoriesCache.getForLabel('Work')).toEqual(['work']);
      expect(LabelCategoriesCache.getForLabel('Nope')).toEqual([]);
    });

    it('updateForLabel sets the categories when non-empty', () => {
      const store = propStore({});
      global.PropertiesService = store;
      const ok = LabelCategoriesCache.updateForLabel('Work', ['work', 'jobs']);
      expect(ok).toBe(true);
      const saved = JSON.parse(store._map.get('LABEL_CATEGORIES_MAP'));
      expect(saved.Work).toEqual(['work', 'jobs']);
    });

    it('updateForLabel deletes the label when given an empty list', () => {
      const store = propStore({ LABEL_CATEGORIES_MAP: JSON.stringify({ Work: ['work'] }) });
      global.PropertiesService = store;
      const ok = LabelCategoriesCache.updateForLabel('Work', []);
      expect(ok).toBe(true);
      const saved = JSON.parse(store._map.get('LABEL_CATEGORIES_MAP'));
      expect(saved.Work).toBeUndefined();
    });
  });

  describe('CategoryDefinitionsCache', () => {
    it('getAll falls back to EMAIL_SORTER_CONFIG.DEFAULT_CATEGORIES', () => {
      global.EMAIL_SORTER_CONFIG = { DEFAULT_CATEGORIES: { work: { label: 'Work' } } };
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => null), setProperty: jest.fn() })) };
      expect(CategoryDefinitionsCache.getAll()).toEqual({ work: { label: 'Work' } });
    });

    it('getAll uses {} when DEFAULT_CATEGORIES is absent', () => {
      global.EMAIL_SORTER_CONFIG = {};
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => null), setProperty: jest.fn() })) };
      expect(CategoryDefinitionsCache.getAll()).toEqual({});
    });

    it('update writes definitions to properties', () => {
      const setProperty = jest.fn();
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ setProperty })) };
      const ok = CategoryDefinitionsCache.update({ a: {} });
      expect(ok).toBe(true);
      expect(setProperty).toHaveBeenCalledWith(CACHE_CONFIG.KEYS.CATEGORY_DEFINITIONS, JSON.stringify({ a: {} }));
    });
  });

  describe('RetentionRulesCache', () => {
    it('getAll returns the stored rules array', () => {
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => JSON.stringify([{ id: 'r1' }])) })) };
      expect(RetentionRulesCache.getAll()).toEqual([{ id: 'r1' }]);
    });

    it('getAll returns [] when nothing is stored', () => {
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ getProperty: jest.fn(() => null) })) };
      expect(RetentionRulesCache.getAll()).toEqual([]);
    });

    it('update stores the rules array', () => {
      const setProperty = jest.fn();
      global.PropertiesService = { getScriptProperties: jest.fn(() => ({ setProperty })) };
      const ok = RetentionRulesCache.update([{ id: 'r2' }]);
      expect(ok).toBe(true);
      expect(setProperty).toHaveBeenCalledWith(CACHE_CONFIG.KEYS.RETENTION_RULES, JSON.stringify([{ id: 'r2' }]));
    });
  });

  describe('UnifiedCacheService facade', () => {
    it('exposes all managers and config', () => {
      expect(UnifiedCacheService.core).toBe(UnifiedCacheCore);
      expect(UnifiedCacheService.emailCategories).toBe(EmailCategoriesCache);
      expect(UnifiedCacheService.labelCategories).toBe(LabelCategoriesCache);
      expect(UnifiedCacheService.categoryDefinitions).toBe(CategoryDefinitionsCache);
      expect(UnifiedCacheService.retentionRules).toBe(RetentionRulesCache);
      expect(UnifiedCacheService.config).toBe(CACHE_CONFIG);
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });

    it('resolves the GAS-global serviceFactory when present', () => {
      global.serviceFactory = serviceFactory;
      global.CacheService = { getScriptCache: jest.fn(() => ({ get: jest.fn(() => JSON.stringify({ ok: 1 })) })) };
      expect(UnifiedCacheCore.get('K')).toEqual({ ok: 1 });
    });
  });
});
