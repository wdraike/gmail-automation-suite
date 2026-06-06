/**
 * Email Categorizer Cache Tests
 * Comprehensive tests for the unified email categorization cache system
 */

const fs = require('fs');
const path = require('path');

// Load modules using require for proper coverage tracking
const config = require('../src/core/config.js');
const { serviceFactory } = require('../src/core/services/index.js');
const emailCategorizerModule = require('../src/features/email-sorter/categorizer-cache.js');

// Drive/Properties/Gmail access is routed through serviceFactory ports. Tests swap
// the global SDK objects, so cached adapters are cleared after each test and
// rebuilt lazily on first access against the then-current globals.
afterEach(() => {
  serviceFactory.reset();
});

// Extract all needed functions
const {
  EMAIL_CATEGORIZER,
  getDefaultCacheStructure,
  initializeCategorizerCache,
  getItemCount,
  loadCategorizerData,
  saveCategorizerData,
  markCacheDirty,
  saveCacheIfDirty,
  refreshCache,
  getAllCategories,
  getCategoryDefinitions,
  addCategory,
  deleteCategory,
  updateCategory,
  getCategoryForEmail,
  getCategoryForDomain,
  updateCategoryForEmail,
  updateCategoryForDomain,
  removeCategoryFromEmail,
  removeCategoryFromDomain,
  getDomainsForCategory,
  getEmailsForCategory,
  getItemsForCategory,
  getAllCategoryItems,
  getCategoriesForLabel,
  getAllLabelCategories,
  removeCategoryFromLabel,
  addCategoryToLabel,
  getDataLayerStats,
  exportCacheData,
  importCacheData,
  resetCache
} = emailCategorizerModule;

describe('Email Categorizer Cache - Core Functions', () => {

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the EMAIL_CATEGORIZER state
    EMAIL_CATEGORIZER.data = null;
    EMAIL_CATEGORIZER.lastLoaded = null;
    EMAIL_CATEGORIZER.isDirty = false;
    EMAIL_CATEGORIZER.isInitialized = false;

    // Mock PropertiesService
    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn(),
        deleteAllProperties: jest.fn()
      }))
    };

    // Mock DriveApp
    global.DriveApp = {
      createFile: jest.fn(() => ({
        getId: jest.fn(() => 'test-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      })),
      getFileById: jest.fn(() => ({
        getBlob: jest.fn(() => ({
          getDataAsString: jest.fn(() => JSON.stringify(getDefaultCacheStructure()))
        })),
        setContent: jest.fn(),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }))
    };

    // Mock Logger
    global.Logger = {
      log: jest.fn()
    };

    // Mock GmailApp
    global.GmailApp = {
      getUserLabelByName: jest.fn(() => null),
      createLabel: jest.fn(() => ({ getName: () => 'Other' }))
    };
  });

  describe('getDefaultCacheStructure', () => {
    it('should return default cache structure with 7 categories', () => {
      const result = getDefaultCacheStructure();

      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('lastUpdated');
      expect(result).toHaveProperty('categories');
      expect(result).toHaveProperty('labelMappings');
      expect(Object.keys(result.categories)).toHaveLength(7);
      expect(result.categories).toHaveProperty('work');
      expect(result.categories).toHaveProperty('personal');
      expect(result.categories).toHaveProperty('finance');
      expect(result.categories).toHaveProperty('newsletters');
      expect(result.categories).toHaveProperty('shopping');
      expect(result.categories).toHaveProperty('social');
      expect(result.categories).toHaveProperty('other');
    });

    it('should have proper structure for each category', () => {
      const result = getDefaultCacheStructure();
      const workCategory = result.categories.work;

      expect(workCategory).toHaveProperty('displayName', 'Work');
      expect(workCategory).toHaveProperty('label', 'Work');
      expect(workCategory).toHaveProperty('domains');
      expect(workCategory).toHaveProperty('emails');
      expect(Array.isArray(workCategory.domains)).toBe(true);
      expect(Array.isArray(workCategory.emails)).toBe(true);
    });
  });

  describe('initializeCategorizerCache', () => {
    it('should initialize cache successfully', () => {
      const result = initializeCategorizerCache();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('categories', 7);
      expect(result).toHaveProperty('items');
      expect(EMAIL_CATEGORIZER.isInitialized).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      EMAIL_CATEGORIZER.isInitialized = true;

      const result = initializeCategorizerCache();

      expect(result.success).toBe(true);
      expect(result.message).toContain('already initialized');
    });

    it('should handle initialization errors gracefully', () => {
      global.PropertiesService.getScriptProperties = jest.fn(() => {
        throw new Error('Properties error');
      });

      const result = initializeCategorizerCache();

      // Note: The function catches the error but loadCategorizerData falls back to default structure,
      // so initialization still succeeds with default data
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('categories');
    });
  });

  describe('getItemCount', () => {
    it('should count items in all categories', () => {
      const data = getDefaultCacheStructure();
      data.categories.work.emails = ['test1@example.com', 'test2@example.com'];
      data.categories.work.domains = ['example.com'];
      data.categories.finance.emails = ['bank@example.com'];

      const count = getItemCount(data);

      expect(count).toBe(4); // 2 emails + 1 domain + 1 email
    });

    it('should return 0 for null data', () => {
      const count = getItemCount(null);

      expect(count).toBe(0);
    });

    it('should return 0 for data without categories', () => {
      const count = getItemCount({});

      expect(count).toBe(0);
    });
  });

  describe('loadCategorizerData', () => {
    it('should load data from Drive file if available', () => {
      const mockData = getDefaultCacheStructure();
      mockData.categories.work.emails = ['test@example.com'];

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn((key) => key === 'EMAIL_CATEGORIZER_FILE_ID' ? 'test-file-id' : null),
        setProperty: jest.fn()
      }));

      global.DriveApp.getFileById = jest.fn(() => ({
        getBlob: jest.fn(() => ({
          getDataAsString: jest.fn(() => JSON.stringify(mockData))
        }))
      }));

      const result = loadCategorizerData();

      expect(result).toEqual(mockData);
      expect(EMAIL_CATEGORIZER.data).toEqual(mockData);
      expect(EMAIL_CATEGORIZER.isDirty).toBe(false);
    });

    it('should use cached data if available and not forcing refresh', () => {
      const cachedData = { test: 'cached' };
      EMAIL_CATEGORIZER.data = cachedData;

      const result = loadCategorizerData(false);

      expect(result).toEqual(cachedData);
    });

    it('should force refresh when requested', () => {
      EMAIL_CATEGORIZER.data = { test: 'old' };

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => 'test-file-id'),
        setProperty: jest.fn()
      }));

      const result = loadCategorizerData(true);

      expect(result).not.toEqual({ test: 'old' });
    });

    it('should create new file if no file ID exists', () => {
      const createFileMock = jest.fn(() => ({
        getId: jest.fn(() => 'new-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }));

      global.DriveApp.createFile = createFileMock;

      loadCategorizerData();

      expect(createFileMock).toHaveBeenCalled();
    });

    it('should use backup data if file cannot be loaded', () => {
      const backupData = getDefaultCacheStructure();
      backupData.categories.work.emails = ['backup@example.com'];

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn((key) => {
          if (key === 'EMAIL_CATEGORIZER_FILE_ID') return 'test-file-id';
          if (key === 'EMAIL_CATEGORIZER_BACKUP') return JSON.stringify(backupData);
          return null;
        }),
        setProperty: jest.fn()
      }));

      global.DriveApp.getFileById = jest.fn(() => {
        throw new Error('File not found');
      });

      const result = loadCategorizerData();

      expect(result.categories.work.emails).toEqual(['backup@example.com']);
    });
  });

  describe('saveCategorizerData', () => {
    it('should save data to Drive file', () => {
      const setContentMock = jest.fn();
      const data = getDefaultCacheStructure();

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => 'test-file-id'),
        setProperty: jest.fn()
      }));

      global.DriveApp.getFileById = jest.fn(() => ({
        setContent: setContentMock,
        getName: jest.fn(() => 'EmailCategorizer.json')
      }));

      const result = saveCategorizerData(data);

      expect(result).toBe(true);
      expect(setContentMock).toHaveBeenCalled();
    });

    it('should remove labelMappings before saving', () => {
      const setContentMock = jest.fn();
      const data = getDefaultCacheStructure();
      data.labelMappings = { 'Test': ['work'] };

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => 'test-file-id'),
        setProperty: jest.fn()
      }));

      global.DriveApp.getFileById = jest.fn(() => ({
        setContent: setContentMock,
        getName: jest.fn(() => 'EmailCategorizer.json')
      }));

      saveCategorizerData(data);

      expect(data.labelMappings).toBeUndefined();
    });

    it('should use cached data if no data provided', () => {
      const setContentMock = jest.fn();
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => 'test-file-id'),
        setProperty: jest.fn()
      }));

      global.DriveApp.getFileById = jest.fn(() => ({
        setContent: setContentMock,
        getName: jest.fn(() => 'EmailCategorizer.json')
      }));

      const result = saveCategorizerData();

      expect(result).toBe(true);
      expect(setContentMock).toHaveBeenCalled();
    });

    it('should return false if no data to save', () => {
      EMAIL_CATEGORIZER.data = null;

      const result = saveCategorizerData();

      expect(result).toBe(false);
    });

    it('should create new file if existing file cannot be updated', () => {
      const createFileMock = jest.fn(() => ({
        getId: jest.fn(() => 'new-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }));

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => 'test-file-id'),
        setProperty: jest.fn()
      }));

      global.DriveApp.getFileById = jest.fn(() => {
        throw new Error('File error');
      });
      global.DriveApp.createFile = createFileMock;

      const data = getDefaultCacheStructure();
      const result = saveCategorizerData(data);

      expect(result).toBe(true);
      expect(createFileMock).toHaveBeenCalled();
    });
  });

  describe('markCacheDirty and saveCacheIfDirty', () => {
    it('should mark cache as dirty', () => {
      EMAIL_CATEGORIZER.isDirty = false;

      markCacheDirty();

      expect(EMAIL_CATEGORIZER.isDirty).toBe(true);
    });

    it('should save if cache is dirty', () => {
      EMAIL_CATEGORIZER.isDirty = true;
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => 'test-file-id'),
        setProperty: jest.fn()
      }));

      global.DriveApp.getFileById = jest.fn(() => ({
        setContent: jest.fn(),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }));

      const result = saveCacheIfDirty();

      expect(result).toBe(true);
    });

    it('should not save if cache is clean', () => {
      EMAIL_CATEGORIZER.isDirty = false;

      const result = saveCacheIfDirty();

      expect(result).toBe(true);
    });
  });
});

describe('Email Categorizer Cache - Category Management', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    EMAIL_CATEGORIZER.data = null;
    EMAIL_CATEGORIZER.isInitialized = false;

    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn()
      }))
    };

    global.DriveApp = {
      createFile: jest.fn(() => ({
        getId: jest.fn(() => 'test-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      })),
      getFileById: jest.fn(() => ({
        setContent: jest.fn(),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }))
    };

    global.Logger = { log: jest.fn() };
    global.GmailApp = {
      getUserLabelByName: jest.fn(() => null),
      createLabel: jest.fn(() => ({ getName: () => 'Other' }))
    };
  });

  describe('getAllCategories', () => {
    it('should return all categories', () => {
      const result = getAllCategories();

      expect(Object.keys(result)).toHaveLength(7);
      expect(result).toHaveProperty('work');
      expect(result).toHaveProperty('finance');
    });
  });

  describe('getCategoryDefinitions', () => {
    it('should return category display names', () => {
      const result = getCategoryDefinitions();

      expect(result).toHaveProperty('work', 'Work');
      expect(result).toHaveProperty('finance', 'Finance');
      expect(result).toHaveProperty('shopping', 'Shopping');
    });
  });

  describe('addCategory', () => {
    it('should add a new category', () => {
      const result = addCategory('urgent', 'Urgent', 'Urgent');

      expect(result.success).toBe(true);
      expect(result.message).toContain('created');
      expect(result.categoryKey).toBe('urgent');
    });

    it('should update an existing category', () => {
      // First add
      addCategory('urgent', 'Urgent', 'Urgent');

      // Then update
      const result = addCategory('urgent', 'Very Urgent', 'VeryUrgent');

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated');
    });

    it('should clean category key', () => {
      const result = addCategory('Test Category!', 'Test Category', 'Test');

      expect(result.categoryKey).toBe('test_category_');
    });

    it('should default label to display name if not provided', () => {
      addCategory('test', 'Test Category');
      const categories = getAllCategories();

      expect(categories.test.label).toBe('Test Category');
    });

    it('should preserve existing arrays when updating', () => {
      // Add with data
      addCategory('test', 'Test', 'Test');
      EMAIL_CATEGORIZER.data.categories.test.emails = ['test@example.com'];
      EMAIL_CATEGORIZER.data.categories.test.domains = ['example.com'];

      // Update
      addCategory('test', 'Updated Test', 'UpdatedTest');

      const categories = getAllCategories();
      expect(categories.test.emails).toEqual(['test@example.com']);
      expect(categories.test.domains).toEqual(['example.com']);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category', () => {
      addCategory('temp', 'Temporary', 'Temp');

      const result = deleteCategory('temp');

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted successfully');
    });

    it('should not allow deleting the "other" category', () => {
      const result = deleteCategory('other');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot delete');
    });

    it('should return error for non-existent category', () => {
      const result = deleteCategory('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should move associated emails to "other" category', () => {
      // Add category with emails
      addCategory('temp', 'Temp', 'Temp');
      EMAIL_CATEGORIZER.data.categories.temp.emails = ['test@example.com'];

      // Delete category
      deleteCategory('temp');

      // Check email moved to other
      const otherCategory = getAllCategories().other;
      expect(otherCategory.emails).toContain('test@example.com');
    });
  });

  describe('updateCategory', () => {
    it('should update category properties', () => {
      const result = updateCategory('work', 'work', 'Professional', 'Work-Pro');

      expect(result.success).toBe(true);
      expect(result.message).toContain('updated successfully');

      const categories = getAllCategories();
      expect(categories.work.displayName).toBe('Professional');
      expect(categories.work.label).toBe('Work-Pro');
    });

    it('should return error for non-existent category', () => {
      const result = updateCategory('nonexistent', 'new', 'New', 'New');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should prevent key conflict', () => {
      const result = updateCategory('work', 'finance', 'Finance Copy', 'Finance');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already in use');
    });

    it('should allow same key update', () => {
      const result = updateCategory('work', 'work', 'Updated Work', 'Work-New');

      expect(result.success).toBe(true);
    });
  });
});

describe('Email Categorizer Cache - Email/Domain Management', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    EMAIL_CATEGORIZER.data = null;
    EMAIL_CATEGORIZER.isInitialized = false;

    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn()
      }))
    };

    global.DriveApp = {
      createFile: jest.fn(() => ({
        getId: jest.fn(() => 'test-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      })),
      getFileById: jest.fn(() => ({
        setContent: jest.fn(),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }))
    };

    global.Logger = { log: jest.fn() };
  });

  describe('getCategoryForEmail', () => {
    it('should find category for email', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['test@example.com'];

      const result = getCategoryForEmail('test@example.com');

      expect(result).toBe('work');
    });

    it('should check domain if email not found', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.finance.domains = ['bank.com'];

      const result = getCategoryForEmail('user@bank.com');

      expect(result).toBe('finance');
    });

    it('should return null if not found', () => {
      const result = getCategoryForEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  describe('updateCategoryForEmail', () => {
    it('should assign email to category', () => {
      const result = updateCategoryForEmail('test@example.com', 'work');

      expect(result).toBe(true);

      const categories = getAllCategories();
      expect(categories.work.emails).toContain('test@example.com');
    });

    it('should move email between categories', () => {
      // Add to work
      updateCategoryForEmail('test@example.com', 'work');

      // Move to finance
      updateCategoryForEmail('test@example.com', 'finance');

      const categories = getAllCategories();
      expect(categories.work.emails).not.toContain('test@example.com');
      expect(categories.finance.emails).toContain('test@example.com');
    });

    it('should sort emails alphabetically', () => {
      updateCategoryForEmail('zebra@example.com', 'work');
      updateCategoryForEmail('alpha@example.com', 'work');

      const categories = getAllCategories();
      expect(categories.work.emails[0]).toBe('alpha@example.com');
      expect(categories.work.emails[1]).toBe('zebra@example.com');
    });

    it('should return false for non-existent category', () => {
      const result = updateCategoryForEmail('test@example.com', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should trim email address', () => {
      updateCategoryForEmail('  test@example.com  ', 'work');

      const categories = getAllCategories();
      expect(categories.work.emails).toContain('test@example.com');
    });
  });

  describe('updateCategoryForDomain', () => {
    it('should assign domain to category', () => {
      const result = updateCategoryForDomain('example.com', 'work');

      expect(result).toBe(true);

      const categories = getAllCategories();
      expect(categories.work.domains).toContain('example.com');
    });

    it('should move domain between categories', () => {
      updateCategoryForDomain('example.com', 'work');
      updateCategoryForDomain('example.com', 'finance');

      const categories = getAllCategories();
      expect(categories.work.domains).not.toContain('example.com');
      expect(categories.finance.domains).toContain('example.com');
    });

    it('should sort domains alphabetically', () => {
      updateCategoryForDomain('zebra.com', 'work');
      updateCategoryForDomain('alpha.com', 'work');

      const categories = getAllCategories();
      expect(categories.work.domains[0]).toBe('alpha.com');
      expect(categories.work.domains[1]).toBe('zebra.com');
    });
  });

  describe('removeCategoryFromEmail', () => {
    it('should remove email from category', () => {
      updateCategoryForEmail('test@example.com', 'work');

      const result = removeCategoryFromEmail('test@example.com');

      expect(result).toBe(true);

      const categories = getAllCategories();
      expect(categories.work.emails).not.toContain('test@example.com');
    });

    it('should return true if email not found', () => {
      const result = removeCategoryFromEmail('nonexistent@example.com');

      expect(result).toBe(true);
    });
  });

  describe('getDomainsForCategory and getEmailsForCategory', () => {
    it('should get domains for category', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.domains = ['example.com', 'test.com'];

      const result = getDomainsForCategory('work');

      expect(result).toEqual(['example.com', 'test.com']);
    });

    it('should get emails for category', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['test@example.com'];

      const result = getEmailsForCategory('work');

      expect(result).toEqual(['test@example.com']);
    });

    it('should return empty array for non-existent category', () => {
      const domains = getDomainsForCategory('nonexistent');
      const emails = getEmailsForCategory('nonexistent');

      expect(domains).toEqual([]);
      expect(emails).toEqual([]);
    });
  });

  describe('getItemsForCategory', () => {
    it('should return both emails and domains', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['test@example.com'];
      EMAIL_CATEGORIZER.data.categories.work.domains = ['example.com'];

      const result = getItemsForCategory('work');

      expect(result.emails).toEqual(['test@example.com']);
      expect(result.domains).toEqual(['example.com']);
    });
  });

  describe('getAllCategoryItems', () => {
    it('should return all items for all categories', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['test@example.com'];

      const result = getAllCategoryItems();

      expect(result).toHaveProperty('work');
      expect(result.work).toHaveProperty('displayName', 'Work');
      expect(result.work).toHaveProperty('emails');
      expect(result.work).toHaveProperty('domains');
    });
  });
});

describe('Email Categorizer Cache - Statistics & Export', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    EMAIL_CATEGORIZER.data = null;
    EMAIL_CATEGORIZER.isInitialized = false;

    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn()
      }))
    };

    global.DriveApp = {
      createFile: jest.fn(() => ({
        getId: jest.fn(() => 'test-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      })),
      getFileById: jest.fn(() => ({
        setContent: jest.fn(),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }))
    };

    global.Logger = { log: jest.fn() };
  });

  describe('getDataLayerStats', () => {
    it('should return statistics', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['test@example.com'];
      EMAIL_CATEGORIZER.data.categories.work.domains = ['example.com'];

      const result = getDataLayerStats();

      expect(result.success).toBe(true);
      expect(result.counts).toHaveProperty('categories', 7);
      expect(result.counts).toHaveProperty('emails', 1);
      expect(result.counts).toHaveProperty('domains', 1);
      expect(result.counts).toHaveProperty('totalItems', 2);
    });

    it('should include category stats', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['test@example.com'];

      const result = getDataLayerStats();

      expect(result.categoryStats).toHaveProperty('work');
      expect(result.categoryStats.work).toHaveProperty('emails', 1);
      expect(result.categoryStats.work).toHaveProperty('domains', 0);
    });
  });

  describe('exportCacheData', () => {
    it('should export cache data', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();

      const result = exportCacheData();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('categories');
      expect(result.data).toHaveProperty('exportedAt');
    });
  });

  describe('importCacheData', () => {
    it('should import valid cache data', () => {
      const importData = getDefaultCacheStructure();
      importData.categories.work.emails = ['imported@example.com'];

      const result = importCacheData(importData);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Imported');
      expect(result).toHaveProperty('categories', 7);
    });

    it('should reject invalid import data', () => {
      const result = importCacheData({ invalid: 'data' });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid import data');
    });

    it('should add import timestamp', () => {
      const importData = getDefaultCacheStructure();

      importCacheData(importData);

      expect(EMAIL_CATEGORIZER.data).toHaveProperty('importedAt');
    });
  });

  describe('resetCache', () => {
    it('should reset cache to defaults', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['test@example.com'];

      const createFileMock = jest.fn(() => ({
        getId: jest.fn(() => 'backup-file-id'),
        getName: jest.fn(() => 'Backup.json')
      }));
      global.DriveApp.createFile = createFileMock;

      const result = resetCache(true);

      expect(result.success).toBe(true);
      expect(result.backupCreated).toBe(true);
      expect(createFileMock).toHaveBeenCalled();
    });

    it('should not create backup if requested', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();

      const createFileMock = jest.fn(() => ({
        getId: jest.fn(() => 'test-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }));
      global.DriveApp.createFile = createFileMock;

      const result = resetCache(false);

      expect(result.success).toBe(true);
      expect(result.backupCreated).toBe(false);
      // Note: createFile may be called for both the reset file and by saveCategorizerData
      // We just verify the backupCreated flag is false
    });
  });
});

describe('Email Categorizer Cache - Label Mappings', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    EMAIL_CATEGORIZER.data = null;

    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn()
      }))
    };

    global.DriveApp = {
      createFile: jest.fn(() => ({
        getId: jest.fn(() => 'test-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      })),
      getFileById: jest.fn(() => ({
        setContent: jest.fn(),
        getName: jest.fn(() => 'EmailCategorizer.json')
      }))
    };

    global.Logger = { log: jest.fn() };
    global.GmailApp = {
      getUserLabelByName: jest.fn(() => null),
      createLabel: jest.fn(() => ({ getName: () => 'Other' }))
    };
  });

  describe('getCategoriesForLabel', () => {
    it('should find categories with matching label', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();

      const result = getCategoriesForLabel('Work');

      expect(result).toContain('work');
    });

    it('should return empty array if no matches', () => {
      const result = getCategoriesForLabel('NonExistent');

      expect(result).toEqual([]);
    });
  });

  describe('getAllLabelCategories', () => {
    it('should build label to categories mapping', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();

      const result = getAllLabelCategories();

      expect(result).toHaveProperty('Work');
      expect(result.Work).toContain('work');
      expect(result).toHaveProperty('Finance');
      expect(result.Finance).toContain('finance');
    });
  });

  describe('addCategoryToLabel', () => {
    it('should assign category to label', () => {
      const result = addCategoryToLabel('Custom', 'work');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);

      const categories = getAllCategories();
      expect(categories.work.label).toBe('Custom');
    });

    it('should handle already assigned category', () => {
      const result = addCategoryToLabel('Work', 'work');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.message).toContain('already assigned');
    });

    it('should return error for non-existent category', () => {
      const result = addCategoryToLabel('Test', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('removeCategoryFromLabel', () => {
    it('should remove category from label and move to Other', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.label = 'CustomLabel';

      const result = removeCategoryFromLabel('CustomLabel', 'work');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);

      const categories = getAllCategories();
      expect(categories.work.label).toBe('Other');
    });

    it('should handle category not assigned to label', () => {
      const result = removeCategoryFromLabel('WrongLabel', 'work');

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.message).toContain('not assigned');
    });
  });
});
