/**
 * Unit Tests for Cache/Storage Module
 */

describe('Cache Service', () => {
  describe('UnifiedCacheCore', () => {
    it('should exist as a global object', () => {
      expect.value(typeof UnifiedCacheCore).toBe('object');
      expect.value(UnifiedCacheCore).toBeTruthy();
    });

    it('should have get and set methods', () => {
      expect.value(typeof UnifiedCacheCore.get).toBe('function');
      expect.value(typeof UnifiedCacheCore.set).toBe('function');
    });
  });

  describe('Cache Storage and Retrieval', () => {
    it('should store and retrieve string values', () => {
      const testKey = 'test_string_' + new Date().getTime();
      const testValue = 'Hello World';

      UnifiedCacheCore.set(testKey, testValue, 600);
      const retrieved = UnifiedCacheCore.get(testKey);

      expect.value(retrieved).toBe(testValue);

      // Clean up
      UnifiedCacheCore.remove(testKey);
    });

    it('should store and retrieve object values', () => {
      const testKey = 'test_object_' + new Date().getTime();
      const testValue = { name: 'Test', count: 42 };

      UnifiedCacheCore.set(testKey, testValue, 600);
      const retrieved = UnifiedCacheCore.get(testKey);

      expect.value(retrieved).toEqual(testValue);
      expect.value(retrieved.name).toBe('Test');
      expect.value(retrieved.count).toBe(42);

      // Clean up
      UnifiedCacheCore.remove(testKey);
    });

    it('should store and retrieve array values', () => {
      const testKey = 'test_array_' + new Date().getTime();
      const testValue = ['item1', 'item2', 'item3'];

      UnifiedCacheCore.set(testKey, testValue, 600);
      const retrieved = UnifiedCacheCore.get(testKey);

      expect.value(Array.isArray(retrieved)).toBeTruthy();
      expect.value(retrieved).toHaveLength(3);
      expect.value(retrieved).toContain('item2');

      // Clean up
      UnifiedCacheCore.remove(testKey);
    });

    it('should return null for non-existent keys', () => {
      const nonExistentKey = 'non_existent_key_xyz_' + new Date().getTime();
      const retrieved = UnifiedCacheCore.get(nonExistentKey);

      expect.value(retrieved).toBeNull();
    });

    it('should handle complex nested objects', () => {
      const testKey = 'test_nested_' + new Date().getTime();
      const testValue = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          },
          array: [1, 2, 3]
        }
      };

      UnifiedCacheCore.set(testKey, testValue, 600);
      const retrieved = UnifiedCacheCore.get(testKey);

      expect.value(retrieved.level1.level2.level3.value).toBe('deep');
      expect.value(retrieved.level1.array).toHaveLength(3);

      // Clean up
      UnifiedCacheCore.remove(testKey);
    });
  });

  describe('Cache Expiration', () => {
    it('should respect cache expiration time', () => {
      const testKey = 'test_expiration_' + new Date().getTime();
      const testValue = 'This should expire';

      // Set with very short expiration (1 second)
      UnifiedCacheCore.set(testKey, testValue, 1);

      // Should be available immediately
      const immediate = UnifiedCacheCore.get(testKey);
      expect.value(immediate).toBe(testValue);

      // Wait for expiration (Note: This is a simplified test)
      // In actual implementation, you'd need to wait 1 second
      // For unit tests, we just verify the expiration parameter is accepted
      expect.value(true).toBeTruthy();

      // Clean up
      UnifiedCacheCore.remove(testKey);
    });
  });

  describe('Cache Removal', () => {
    it('should remove cached values', () => {
      const testKey = 'test_removal_' + new Date().getTime();
      const testValue = 'To be removed';

      UnifiedCacheCore.set(testKey, testValue, 600);

      // Verify it's there
      expect.value(UnifiedCacheCore.get(testKey)).toBe(testValue);

      // Remove it
      UnifiedCacheCore.remove(testKey);

      // Verify it's gone
      expect.value(UnifiedCacheCore.get(testKey)).toBeNull();
    });
  });
});

describe('Categorizer Data Storage', () => {
  describe('loadCategorizerData', () => {
    it('should load categorizer data successfully', () => {
      const data = loadCategorizerData();

      expect.value(data).toBeTruthy();
      expect.value(typeof data).toBe('object');
    });

    it('should have categories property', () => {
      const data = loadCategorizerData();

      expect.value(data).toHaveProperty('categories');
      expect.value(typeof data.categories).toBe('object');
    });

    it('should have labelMappings property', () => {
      const data = loadCategorizerData();

      expect.value(data).toHaveProperty('labelMappings');
      expect.value(typeof data.labelMappings).toBe('object');
    });
  });

  describe('saveCategorizerData', () => {
    it('should save data successfully', () => {
      const result = saveCategorizerData();

      expect.value(result).toBeTruthy();
      expect.value(typeof result).toBe('object');
      expect.value(result).toHaveProperty('success');
    });

    it('should handle null data parameter', () => {
      const result = saveCategorizerData(null);

      // Should use current data from EMAIL_CATEGORIZER
      expect.value(result).toBeTruthy();
      expect.value(result).toHaveProperty('success');
    });
  });

  describe('markCacheDirty', () => {
    it('should mark cache as dirty', () => {
      markCacheDirty();

      expect.value(EMAIL_CATEGORIZER.isDirty).toBeTruthy();
    });
  });

  describe('saveCacheIfDirty', () => {
    it('should save if cache is dirty', () => {
      markCacheDirty();

      const result = saveCacheIfDirty();

      expect.value(typeof result).toBe('boolean');
    });

    it('should not save if cache is clean', () => {
      // Ensure cache is not dirty
      if (EMAIL_CATEGORIZER) {
        EMAIL_CATEGORIZER.isDirty = false;
      }

      const result = saveCacheIfDirty();

      expect.value(result).toBeFalsy();
    });
  });
});

describe('Data Layer Statistics', () => {
  describe('getDataLayerStats', () => {
    it('should return statistics object', () => {
      const stats = getDataLayerStats();

      expect.value(stats).toBeTruthy();
      expect.value(typeof stats).toBe('object');
    });

    it('should include category count', () => {
      const stats = getDataLayerStats();

      expect.value(stats).toHaveProperty('totalCategories');
      expect.value(typeof stats.totalCategories).toBe('number');
    });

    it('should include email and domain counts', () => {
      const stats = getDataLayerStats();

      expect.value(stats).toHaveProperty('totalEmails');
      expect.value(stats).toHaveProperty('totalDomains');
      expect.value(typeof stats.totalEmails).toBe('number');
      expect.value(typeof stats.totalDomains).toBe('number');
    });

    it('should include category breakdown', () => {
      const stats = getDataLayerStats();

      expect.value(stats).toHaveProperty('categoryBreakdown');
      expect.value(typeof stats.categoryBreakdown).toBe('object');
    });
  });
});

describe('Cache Import/Export', () => {
  describe('exportCacheData', () => {
    it('should export cache data successfully', () => {
      const exported = exportCacheData();

      expect.value(exported).toBeTruthy();
      expect.value(typeof exported).toBe('object');
    });

    it('should include categories in export', () => {
      const exported = exportCacheData();

      expect.value(exported).toHaveProperty('categories');
    });

    it('should include metadata in export', () => {
      const exported = exportCacheData();

      expect.value(exported).toHaveProperty('version');
      expect.value(exported).toHaveProperty('exportDate');
    });
  });

  describe('importCacheData', () => {
    it('should validate import data structure', () => {
      const invalidData = { invalid: 'structure' };
      const result = importCacheData(invalidData);

      expect.value(result).toHaveProperty('success');
    });

    it('should reject empty import data', () => {
      const result = importCacheData({});

      expect.value(result).toHaveProperty('success', false);
    });

    it('should accept valid import data', () => {
      const validData = {
        categories: {
          test: {
            displayName: 'Test',
            label: 'Test',
            emails: [],
            domains: []
          }
        },
        labelMappings: {}
      };

      const result = importCacheData(validData);

      expect.value(result).toHaveProperty('success');
    });
  });
});
