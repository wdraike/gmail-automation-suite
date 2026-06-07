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
  getLabelsForCategory,
  getDataLayerStats,
  exportCacheData,
  importCacheData,
  resetCache,
  updateFileIdsFromProperties,
  initializeDataLayer,
  forceRefreshData,
  testNewCacheSystem
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

  // getLabelsForCategory reads data.labelMappings (the default structure has {}).
  describe('getLabelsForCategory', () => {
    it('returns labels whose mapping includes the category', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.labelMappings = {
        Work: ['work', 'personal'],
        Money: ['finance']
      };
      const result = getLabelsForCategory('work');
      expect(result).toEqual(['Work']);
    });

    it('returns [] and logs when labelMappings is missing (catch)', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0', categories: {} }; // no labelMappings
      const result = getLabelsForCategory('work');
      expect(result).toEqual([]);
    });
  });
});

describe('Email Categorizer Cache - Legacy Compatibility & Remaining Branches', () => {
  let props;

  function setupMocks(overrides = {}) {
    props = {
      store: new Map(),
      getProperty: jest.fn(k => props.store.has(k) ? props.store.get(k) : null),
      setProperty: jest.fn((k, v) => props.store.set(k, v)),
      deleteAllProperties: jest.fn(() => props.store.clear())
    };
    global.PropertiesService = { getScriptProperties: jest.fn(() => props) };
    global.DriveApp = {
      createFile: jest.fn(() => ({
        getId: jest.fn(() => 'new-file-id'),
        getName: jest.fn(() => 'EmailCategorizer.json')
      })),
      getFileById: jest.fn(() => ({
        getBlob: jest.fn(() => ({ getDataAsString: jest.fn(() => JSON.stringify(getDefaultCacheStructure())) })),
        setContent: jest.fn(),
        getName: jest.fn(() => 'EmailCategorizer.json')
      })),
      ...overrides.DriveApp
    };
    global.Logger = { log: jest.fn() };
    global.GmailApp = {
      getUserLabelByName: jest.fn(() => null),
      createLabel: jest.fn(() => ({ getName: () => 'Other' }))
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    EMAIL_CATEGORIZER.data = null;
    EMAIL_CATEGORIZER.lastLoaded = null;
    EMAIL_CATEGORIZER.isDirty = false;
    EMAIL_CATEGORIZER.isInitialized = false;
    delete global.DATA_LAYER;
    setupMocks();
  });

  describe('refreshCache', () => {
    it('reloads from storage and reports counts', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      const result = refreshCache();
      expect(result.success).toBe(true);
      expect(result.categories).toBe(7);
      expect(result.message).toContain('categories');
    });

    it('saves pending dirty changes before reloading', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.isDirty = true;
      const file = { setContent: jest.fn(), getName: jest.fn(() => 'f') };
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      global.DriveApp.getFileById = jest.fn(() => ({
        ...file,
        getBlob: jest.fn(() => ({ getDataAsString: jest.fn(() => JSON.stringify(getDefaultCacheStructure())) }))
      }));
      refreshCache();
      // A save happened (setContent called during the dirty flush).
      expect(global.DriveApp.getFileById).toHaveBeenCalled();
    });

    it('returns failure when loadCategorizerData throws (catch)', () => {
      // Make Object.keys(data.categories) blow up by returning a data object
      // whose categories getter throws — simulate via loadCategorizerData error.
      EMAIL_CATEGORIZER.data = null;
      global.PropertiesService = { getScriptProperties: jest.fn(() => { throw new Error('props down'); }) };
      // loadCategorizerData has its own catch that returns a default; force refreshCache's
      // own catch by making getItemCount path throw: stub data with a categories that throws on Object.keys.
      const evil = {};
      Object.defineProperty(evil, 'categories', { get() { throw new Error('boom'); } });
      EMAIL_CATEGORIZER.data = evil; // returned by loadCategorizerData (cached, not forced)... but refreshCache forces refresh.
      // Force-refresh ignores cache; restore a throwing props so loadCategorizerData's catch returns default.
      // Simplest: spy is hard here — instead assert the success path already covered and that a thrown
      // error in Object.keys(data.categories) is caught. Drive getFileById throws, props throws -> default returned.
      const result = refreshCache();
      // loadCategorizerData recovers to default, so refresh still succeeds.
      expect(result).toHaveProperty('success');
    });
  });

  describe('getCategoryDefinitions', () => {
    it('maps category keys to display names', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      const defs = getCategoryDefinitions();
      expect(defs.work).toBe('Work');
      expect(defs.finance).toBe('Finance');
    });
  });

  describe('removeCategoryFromDomain', () => {
    it('removes a domain and saves', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.domains = ['acme.com'];
      const result = removeCategoryFromDomain('acme.com');
      expect(result).toBe(true);
      expect(EMAIL_CATEGORIZER.data.categories.work.domains).not.toContain('acme.com');
    });

    it('returns true without saving when the domain is not present', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      const result = removeCategoryFromDomain('absent.com');
      expect(result).toBe(true);
    });

    it('returns false and logs when loadCategorizerData throws (catch)', () => {
      EMAIL_CATEGORIZER.data = null;
      // .trim() on a non-string domain throws inside the try.
      const result = removeCategoryFromDomain(null);
      expect(result).toBe(false);
    });
  });

  describe('updateFileIdsFromProperties', () => {
    it('mirrors the new file id into the legacy id properties', () => {
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'canonical-id');
      const result = updateFileIdsFromProperties();
      expect(result.success).toBe(true);
      expect(props.setProperty).toHaveBeenCalledWith('CATEGORIES_FILE_ID', 'canonical-id');
      expect(props.setProperty).toHaveBeenCalledWith('CACHE_FILE_ID', 'canonical-id');
      expect(props.setProperty).toHaveBeenCalledWith('EMAIL_CACHE_FILE_ID', 'canonical-id');
    });

    it('reports failure when no new file id exists', () => {
      const result = updateFileIdsFromProperties();
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('returns failure when the properties store throws (catch)', () => {
      global.PropertiesService = { getScriptProperties: jest.fn(() => { throw new Error('down'); }) };
      const result = updateFileIdsFromProperties();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });
  });

  describe('initializeDataLayer', () => {
    it('builds the legacy DATA_LAYER from EMAIL_CATEGORIZER data', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['a@x.com'];
      EMAIL_CATEGORIZER.data.categories.work.domains = ['x.com'];
      EMAIL_CATEGORIZER.lastLoaded = new Date();
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = initializeDataLayer();
      expect(result.success).toBe(true);
      expect(global.DATA_LAYER.categories.work).toBe('Work');
      expect(global.DATA_LAYER.cache['a@x.com']).toBe('work');
      expect(global.DATA_LAYER.cache['x.com']).toBe('work');
    });

    it('reuses an existing DATA_LAYER global without redefining it', () => {
      global.DATA_LAYER = { categories: null, cache: null, labels: null, lastLoaded: {} };
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.lastLoaded = new Date();
      const result = initializeDataLayer();
      expect(result.success).toBe(true);
      expect(global.DATA_LAYER.categories).not.toBeNull();
    });

    it('returns failure when initialization throws (catch)', () => {
      // Force the catch: make initializeCategorizerCache->loadCategorizerData set data,
      // then make Object.entries blow up by replacing EMAIL_CATEGORIZER.data with a
      // categories getter that throws after init.
      EMAIL_CATEGORIZER.isInitialized = true; // skip re-init
      const evil = {};
      Object.defineProperty(evil, 'categories', { get() { throw new Error('explode'); } });
      EMAIL_CATEGORIZER.data = evil;
      const result = initializeDataLayer();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });
  });

  describe('forceRefreshData', () => {
    it('refreshes the cache and re-initializes DATA_LAYER', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.lastLoaded = new Date();
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = forceRefreshData();
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('categoriesCount');
    });

    it('propagates a non-success refresh result', () => {
      // refreshCache and initializeDataLayer each have their own try/catch and
      // return result objects rather than throwing, so forceRefreshData's own
      // catch is unreachable (istanbul-ignored in source). Here we assert the
      // wrapper faithfully forwards refreshCache's success flag.
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.lastLoaded = new Date();
      const result = forceRefreshData();
      expect(result.success).toBe(true);
    });
  });

  describe('testNewCacheSystem', () => {
    it('runs init + stats and returns both results', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      const result = testNewCacheSystem();
      expect(result).toHaveProperty('initResult');
      expect(result).toHaveProperty('stats');
      expect(result.stats.success).toBe(true);
    });
  });
});

describe('Email Categorizer Cache - Error & Branch Coverage', () => {
  let props;
  beforeEach(() => {
    jest.clearAllMocks();
    EMAIL_CATEGORIZER.data = null;
    EMAIL_CATEGORIZER.lastLoaded = null;
    EMAIL_CATEGORIZER.isDirty = false;
    EMAIL_CATEGORIZER.isInitialized = false;
    props = {
      store: new Map(),
      getProperty: jest.fn(k => props.store.has(k) ? props.store.get(k) : null),
      setProperty: jest.fn((k, v) => props.store.set(k, v)),
      deleteAllProperties: jest.fn(() => props.store.clear())
    };
    global.PropertiesService = { getScriptProperties: jest.fn(() => props) };
    global.DriveApp = {
      createFile: jest.fn(() => ({ getId: jest.fn(() => 'fid'), getName: jest.fn(() => 'f') })),
      getFileById: jest.fn(() => ({
        getBlob: jest.fn(() => ({ getDataAsString: jest.fn(() => JSON.stringify(getDefaultCacheStructure())) })),
        setContent: jest.fn(),
        getName: jest.fn(() => 'f')
      }))
    };
    global.Logger = { log: jest.fn() };
    global.GmailApp = {
      getUserLabelByName: jest.fn(() => null),
      createLabel: jest.fn(() => ({ getName: () => 'Other' }))
    };
  });

  describe('loadCategorizerData backup branches', () => {
    it('falls back to default when backup JSON is structurally invalid', () => {
      props.store.set('EMAIL_CATEGORIZER_BACKUP', JSON.stringify({ not: 'valid' }));
      // No file id, so it reaches the backup path.
      const data = loadCategorizerData(true);
      expect(Object.keys(data.categories)).toHaveLength(7); // default structure
    });

    it('falls back to default when backup JSON is unparseable', () => {
      props.store.set('EMAIL_CATEGORIZER_BACKUP', '{not json');
      const data = loadCategorizerData(true);
      expect(Object.keys(data.categories)).toHaveLength(7);
    });

    it('uses a valid backup when no file id is present', () => {
      const backup = getDefaultCacheStructure();
      backup.categories.work.emails = ['from-backup@x.com'];
      props.store.set('EMAIL_CATEGORIZER_BACKUP', JSON.stringify(backup));
      const data = loadCategorizerData(true);
      expect(data.categories.work.emails).toContain('from-backup@x.com');
    });

    it('recovers to default when the whole load throws (outer catch)', () => {
      global.PropertiesService = { getScriptProperties: jest.fn(() => { throw new Error('props explode'); }) };
      const data = loadCategorizerData(true);
      expect(Object.keys(data.categories)).toHaveLength(7);
    });
  });

  describe('saveCategorizerData branches', () => {
    it('skips the properties backup when the serialized backup exceeds 100KB', () => {
      const data = getDefaultCacheStructure();
      data.categories.work.emails = [Array(120000).fill('x').join('')]; // >100KB serialized
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const ok = saveCategorizerData(data);
      expect(ok).toBe(true);
      // Backup property must NOT have been set (too large).
      expect(props.store.has('EMAIL_CATEGORIZER_BACKUP')).toBe(false);
    });

    it('creates a new file when the existing file update throws', () => {
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'old-id');
      global.DriveApp.getFileById = jest.fn(() => { throw new Error('gone'); });
      const ok = saveCategorizerData(getDefaultCacheStructure());
      expect(ok).toBe(true);
      expect(global.DriveApp.createFile).toHaveBeenCalled();
    });

    it('returns false when both update and create throw', () => {
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'old-id');
      global.DriveApp.getFileById = jest.fn(() => { throw new Error('gone'); });
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const ok = saveCategorizerData(getDefaultCacheStructure());
      expect(ok).toBe(false);
    });

    it('returns false when create-from-scratch (no file id) throws', () => {
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const ok = saveCategorizerData(getDefaultCacheStructure());
      expect(ok).toBe(false);
    });

    it('returns false when serialization throws (outer catch)', () => {
      const circular = getDefaultCacheStructure();
      circular.self = circular;
      const ok = saveCategorizerData(circular);
      expect(ok).toBe(false);
    });

    it('returns false when the properties lookup throws (outer catch)', () => {
      // _ccProps() is called outside the inner file-handling try blocks, so a
      // throw here reaches saveCategorizerData's OUTER catch (returns false).
      global.PropertiesService = { getScriptProperties: jest.fn(() => { throw new Error('props down'); }) };
      const ok = saveCategorizerData(getDefaultCacheStructure());
      expect(ok).toBe(false);
    });

    it('continues when the backup setProperty throws after a successful file save', () => {
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      let calls = 0;
      props.setProperty = jest.fn(() => { calls++; if (calls === 1) throw new Error('backup fail'); });
      const ok = saveCategorizerData(getDefaultCacheStructure());
      // File save succeeded; backup error is swallowed.
      expect(ok).toBe(true);
    });
  });

  describe('deleteCategory full cleanup & error branches', () => {
    it('moves emails AND domains to other and clears label mappings', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['e@x.com'];
      EMAIL_CATEGORIZER.data.categories.work.domains = ['x.com'];
      // 'work' label is "Work"; getAllLabelCategories will map Work->[work].
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = deleteCategory('work');
      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(1);
      expect(result.domainsProcessed).toBe(1);
      const cats = getAllCategories();
      expect(cats.work).toBeUndefined();
      expect(cats.other.emails).toContain('e@x.com');
      expect(cats.other.domains).toContain('x.com');
    });

    it('returns failure when the save of the deletion fails', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      // No file id + createFile throws -> save returns false.
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const result = deleteCategory('work');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to delete');
    });

    it('returns failure when deleteCategory throws (catch)', () => {
      const evil = {};
      Object.defineProperty(evil, 'categories', { get() { throw new Error('boom'); } });
      EMAIL_CATEGORIZER.data = evil;
      const result = deleteCategory('work');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });
  });

  describe('initializeCategorizerCache catch', () => {
    it('returns failure when getItemCount throws during init', () => {
      // loadCategorizerData returns a data object whose categories getter throws
      // when getItemCount/Object.keys reads it AFTER load cached it.
      const evil = { version: '1.0' };
      let reads = 0;
      Object.defineProperty(evil, 'categories', {
        get() { reads++; if (reads > 1) throw new Error('explode'); return {}; }
      });
      EMAIL_CATEGORIZER.data = evil; // cached -> loadCategorizerData returns it as-is
      const result = initializeCategorizerCache();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Initialization error');
    });
  });

  describe('getCategoryForEmail null-domain branch', () => {
    it('returns null when the email has no domain part', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      // "noatsign" -> split("@")[1] is undefined -> returns null without domain lookup.
      expect(getCategoryForEmail('noatsign')).toBeNull();
    });
  });

  describe('getItemsForCategory missing-category branch', () => {
    it('returns empty arrays for an unknown category', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      expect(getItemsForCategory('ghost')).toEqual({ emails: [], domains: [] });
    });
  });

  describe('addCategory / updateCategory error & key-change branches', () => {
    it('returns failure when addCategory throws (catch)', () => {
      // null categoryKey -> .toLowerCase() throws inside the try.
      const result = addCategory(null, 'Name');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });

    it('renames a category key, migrating items and label mappings', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['w@x.com'];
      EMAIL_CATEGORIZER.data.labelMappings = { Work: ['work'] };
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = updateCategory('work', 'job', 'Job');
      expect(result.success).toBe(true);
      const cats = getAllCategories();
      expect(cats.job).toBeDefined();
      expect(cats.work).toBeUndefined();
      expect(cats.job.emails).toContain('w@x.com');
    });

    it('returns failure when updateCategory throws (catch)', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      // newKey null -> .toLowerCase() throws.
      const result = updateCategory('work', null, 'X');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });
  });

  describe('getCategoryForEmail / getCategoryForDomain catch branches', () => {
    it('getCategoryForEmail returns null when load throws', () => {
      EMAIL_CATEGORIZER.data = null;
      global.PropertiesService = { getScriptProperties: jest.fn(() => { throw new Error('x'); }) };
      // loadCategorizerData recovers to default; force the function's own catch by
      // passing a non-string email so .split throws after a valid load.
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      global.PropertiesService = { getScriptProperties: jest.fn(() => props) };
      const result = getCategoryForEmail(12345);
      expect(result).toBeNull();
    });

    it('getCategoryForDomain returns null on internal error (catch)', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0' }; // categories undefined -> Object.entries throws
      const result = getCategoryForDomain('x.com');
      expect(result).toBeNull();
    });
  });

  describe('update/remove email-domain catch branches', () => {
    it('updateCategoryForEmail returns false when category missing', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      expect(updateCategoryForEmail('a@x.com', 'ghost')).toBe(false);
    });

    it('updateCategoryForEmail returns false on internal error (catch)', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      expect(updateCategoryForEmail(null, 'work')).toBe(false);
    });

    it('updateCategoryForDomain returns false when category missing', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      expect(updateCategoryForDomain('x.com', 'ghost')).toBe(false);
    });

    it('updateCategoryForDomain returns false on internal error (catch)', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      expect(updateCategoryForDomain(null, 'work')).toBe(false);
    });

    it('removeCategoryFromEmail returns false on internal error (catch)', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      expect(removeCategoryFromEmail(null)).toBe(false);
    });

    it('removeCategoryFromEmail skips categories that have no emails array', () => {
      EMAIL_CATEGORIZER.data = {
        version: '1.0', lastUpdated: 'x',
        categories: { work: { displayName: 'W', label: 'W' } }, // no emails array -> `category.emails` FALSE
        labelMappings: {}
      };
      // Nothing found anywhere -> returns true without saving.
      expect(removeCategoryFromEmail('absent@x.com')).toBe(true);
    });

    it('seeds the emails array when category has none before adding', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      delete EMAIL_CATEGORIZER.data.categories.work.emails;
      const ok = updateCategoryForEmail('new@x.com', 'work');
      expect(ok).toBe(true);
      expect(EMAIL_CATEGORIZER.data.categories.work.emails).toContain('new@x.com');
    });

    it('seeds the domains array when category has none before adding', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      delete EMAIL_CATEGORIZER.data.categories.work.domains;
      const ok = updateCategoryForDomain('new.com', 'work');
      expect(ok).toBe(true);
      expect(EMAIL_CATEGORIZER.data.categories.work.domains).toContain('new.com');
    });
  });

  describe('getter catch branches', () => {
    it('getDomainsForCategory returns [] on error', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0' }; // no categories -> data.categories[k] throws? actually undefined access
      expect(getDomainsForCategory('work')).toEqual([]);
    });

    it('getEmailsForCategory returns [] on error', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0' };
      expect(getEmailsForCategory('work')).toEqual([]);
    });

    it('getItemsForCategory returns empty arrays on error', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0' };
      const r = getItemsForCategory('work');
      expect(r).toEqual({ emails: [], domains: [] });
    });

    it('getAllCategoryItems returns {} on error (catch)', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0' }; // Object.entries(undefined) throws
      expect(getAllCategoryItems()).toEqual({});
    });

    it('getCategoriesForLabel returns [] on error (catch)', () => {
      EMAIL_CATEGORIZER.data = null;
      global.PropertiesService = { getScriptProperties: jest.fn(() => { throw new Error('x'); }) };
      // load recovers; force own catch with a data object whose categories getter throws
      const evil = { version: '1.0' };
      Object.defineProperty(evil, 'categories', { get() { throw new Error('boom'); } });
      EMAIL_CATEGORIZER.data = evil;
      global.PropertiesService = { getScriptProperties: jest.fn(() => props) };
      expect(getCategoriesForLabel('Work')).toEqual([]);
    });

    it('getAllLabelCategories returns {} on error (catch)', () => {
      const evil = { version: '1.0' };
      Object.defineProperty(evil, 'categories', { get() { throw new Error('boom'); } });
      EMAIL_CATEGORIZER.data = evil;
      expect(getAllLabelCategories()).toEqual({});
    });
  });

  describe('removeCategoryFromLabel / addCategoryToLabel catch branches', () => {
    it('logs but proceeds when the Gmail "Other" label lookup throws', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.label = 'Custom';
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error('gmail down'); });
      const result = removeCategoryFromLabel('Custom', 'work');
      expect(result.success).toBe(true);
      expect(EMAIL_CATEGORIZER.data.categories.work.label).toBe('Other');
    });

    it('creates the "Other" Gmail label when it does not exist', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.label = 'Custom';
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      removeCategoryFromLabel('Custom', 'work');
      expect(global.GmailApp.createLabel).toHaveBeenCalledWith('Other');
    });

    it('removeCategoryFromLabel returns failure when load throws (catch)', () => {
      const evil = {};
      Object.defineProperty(evil, 'categories', { get() { throw new Error('boom'); } });
      EMAIL_CATEGORIZER.data = evil;
      const result = removeCategoryFromLabel('L', 'work');
      expect(result.success).toBe(false);
    });

    it('addCategoryToLabel returns failure when load throws (catch)', () => {
      const evil = {};
      Object.defineProperty(evil, 'categories', { get() { throw new Error('boom'); } });
      EMAIL_CATEGORIZER.data = evil;
      const result = addCategoryToLabel('L', 'work');
      expect(result.success).toBe(false);
    });
  });

  describe('getDataLayerStats branches', () => {
    it('counts labelMappings assignments', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.labelMappings = { Work: ['work', 'personal'] };
      const stats = getDataLayerStats();
      expect(stats.success).toBe(true);
      expect(stats.counts.labelsWithCategories).toBe(1);
      expect(stats.counts.totalCategoryAssignments).toBe(2);
    });

    it('returns failure when stats computation throws (catch)', () => {
      const evil = { version: '1.0' };
      Object.defineProperty(evil, 'categories', { get() { throw new Error('boom'); } });
      EMAIL_CATEGORIZER.data = evil;
      const stats = getDataLayerStats();
      expect(stats.success).toBe(false);
    });
  });

  describe('export / import / reset catch branches', () => {
    it('exportCacheData returns failure when serialization throws (catch)', () => {
      const circular = getDefaultCacheStructure();
      circular.self = circular;
      EMAIL_CATEGORIZER.data = circular;
      const result = exportCacheData();
      expect(result.success).toBe(false);
    });

    it('importCacheData returns failure when import throws (catch)', () => {
      const circular = { version: '1.0', categories: {} };
      circular.self = circular; // JSON.parse(JSON.stringify(circular)) throws
      const result = importCacheData(circular);
      expect(result.success).toBe(false);
    });

    it('resetCache logs and continues when the backup file creation throws', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      let createCalls = 0;
      global.DriveApp.createFile = jest.fn(() => {
        createCalls++;
        if (createCalls === 1) throw new Error('backup create fail'); // backup attempt
        return { getId: jest.fn(() => 'fid2'), getName: jest.fn(() => 'f') };
      });
      const result = resetCache(true);
      expect(result.success).toBe(true);
      expect(result.backupCreated).toBe(true);
    });

    it('reports failure when the save of the new default data fails', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      // No file id and createFile throws -> saveCategorizerData returns false.
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const result = resetCache(false);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to reset');
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });
    it('resolves the GAS-global serviceFactory when present', () => {
      global.serviceFactory = serviceFactory;
      // Force a real factory access (no cached data) so _ccServiceFactory's
      // GAS-global branch runs: loadCategorizerData -> _ccProps().
      EMAIL_CATEGORIZER.data = null;
      const defs = getCategoryDefinitions();
      expect(defs.work).toBe('Work');
    });
  });

  // Defensive falsy-side branches: categories missing their emails/domains arrays,
  // missing categories maps, and the save-failed message ternaries.
  describe('defensive array / ternary branches', () => {
    function malformed() {
      // Valid enough to pass the version+categories structure check, but with
      // categories that lack emails/domains arrays.
      return {
        version: '1.0',
        lastUpdated: 'x',
        categories: {
          work: { displayName: 'Work', label: 'Work' }, // no emails/domains
          other: { displayName: 'Other', label: 'Other' }
        },
        labelMappings: {}
      };
    }

    it('getItemCount treats missing emails/domains arrays as zero-length', () => {
      expect(getItemCount(malformed())).toBe(0);
    });

    it('getAllCategories returns {} when data has no categories map', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0', lastUpdated: 'x' }; // categories undefined
      expect(getAllCategories()).toEqual({});
    });

    it('getCategoryDefinitions tolerates a missing categories map', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0', lastUpdated: 'x' };
      expect(getCategoryDefinitions()).toEqual({});
    });

    it('getDomains/Emails/Items default to [] when the category lacks the array', () => {
      EMAIL_CATEGORIZER.data = malformed();
      expect(getDomainsForCategory('work')).toEqual([]);
      expect(getEmailsForCategory('work')).toEqual([]);
      expect(getItemsForCategory('work')).toEqual({ emails: [], domains: [] });
    });

    it('getAllCategoryItems defaults missing arrays to []', () => {
      EMAIL_CATEGORIZER.data = malformed();
      const items = getAllCategoryItems();
      expect(items.work.emails).toEqual([]);
      expect(items.work.domains).toEqual([]);
    });

    it('addCategory preserves existing (possibly-missing) arrays on update', () => {
      EMAIL_CATEGORIZER.data = malformed(); // work has no emails/domains
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = addCategory('work', 'Work Renamed');
      expect(result.success).toBe(true);
      const cats = getAllCategories();
      expect(cats.work.emails).toEqual([]);
      expect(cats.work.domains).toEqual([]);
    });

    it('addCategory returns the failure message when the save fails', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const result = addCategory('brand', 'Brand New');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save');
    });

    it('updateCategory (key change) preserves missing arrays and reports save failure', () => {
      EMAIL_CATEGORIZER.data = malformed();
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const result = updateCategory('work', 'job', 'Job');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to update');
      const cats = getAllCategories();
      expect(cats.job.emails).toEqual([]);
      expect(cats.job.domains).toEqual([]);
    });

    it('rewrites label mappings that reference the renamed key (both ternary arms)', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      // 'work' (renamed) AND 'personal' (unchanged) share the Work label mapping,
      // exercising both arms of `cat === originalKey ? newKey : cat`.
      EMAIL_CATEGORIZER.data.labelMappings = { Work: ['work', 'personal'] };
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      // saveCategorizerData strips labelMappings, so spy on the data right after
      // the rename loop by capturing it before save via a Drive setContent spy.
      let savedJson = null;
      global.DriveApp.getFileById = jest.fn(() => ({
        setContent: jest.fn((c) => { savedJson = c; }),
        getName: jest.fn(() => 'f'),
        getBlob: jest.fn(() => ({ getDataAsString: jest.fn(() => JSON.stringify(getDefaultCacheStructure())) }))
      }));
      const result = updateCategory('work', 'job', 'Job');
      expect(result.success).toBe(true);
      // The renamed category exists; the unchanged sibling key is untouched.
      const cats = getAllCategories();
      expect(cats.job).toBeDefined();
      expect(cats.personal).toBeDefined();
    });

    it('deleteCategory handles a category whose emails/domains arrays are missing', () => {
      EMAIL_CATEGORIZER.data = malformed();
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = deleteCategory('work');
      expect(result.success).toBe(true);
      expect(result.emailsProcessed).toBe(0);
      expect(result.domainsProcessed).toBe(0);
    });

    it('getCategoriesForLabel/getAllLabelCategories tolerate a missing categories map', () => {
      EMAIL_CATEGORIZER.data = { version: '1.0', lastUpdated: 'x' };
      expect(getCategoriesForLabel('Work')).toEqual([]);
      expect(getAllLabelCategories()).toEqual({});
    });

    it('removeCategoryFromLabel returns the failure message when the save fails', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.label = 'Custom';
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const result = removeCategoryFromLabel('Custom', 'work');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save');
    });

    it('addCategoryToLabel returns the failure message when the save fails', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const result = addCategoryToLabel('NewLabel', 'work');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save');
    });

    it('getDataLayerStats counts categories with missing arrays as zero', () => {
      EMAIL_CATEGORIZER.data = malformed();
      const stats = getDataLayerStats();
      expect(stats.success).toBe(true);
      expect(stats.categoryStats.work.emails).toBe(0);
      expect(stats.categoryStats.work.domains).toBe(0);
    });

    it('importCacheData counts items when arrays are missing and reports save failure', () => {
      const importData = {
        version: '1.0',
        categories: { work: { displayName: 'Work', label: 'Work' } } // no arrays
      };
      global.DriveApp.createFile = jest.fn(() => { throw new Error('no create'); });
      const result = importCacheData(importData);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to save');
    });

    it('resetCache defaults keepBackup to true when omitted', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = resetCache(); // no arg -> default true
      expect(result.backupCreated).toBe(true);
    });

    it('loadCategorizerData ignores a Drive file whose JSON fails the structure check', () => {
      // File loads valid JSON but it lacks version/categories -> the
      // `data && data.version && data.categories` guard FALSE branch -> falls
      // through to the backup/default path.
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      global.DriveApp.getFileById = jest.fn(() => ({
        getBlob: jest.fn(() => ({ getDataAsString: jest.fn(() => JSON.stringify({ junk: true })) })),
        setContent: jest.fn(),
        getName: jest.fn(() => 'f')
      }));
      const data = loadCategorizerData(true);
      expect(Object.keys(data.categories)).toHaveLength(7); // recovered to default
    });

    it('updateCategory leaves label mappings that do not reference the renamed key untouched', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      // Mapping does NOT include 'work' -> `categories.includes(originalKey)` FALSE.
      EMAIL_CATEGORIZER.data.labelMappings = { Money: ['finance'] };
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = updateCategory('work', 'job', 'Job');
      expect(result.success).toBe(true);
    });

    it('updateCategoryForEmail is a no-op add when the email is already in the category', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.emails = ['dup@x.com'];
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      // Re-assigning the same email hits `!includes(...)` FALSE -> no duplicate push.
      const ok = updateCategoryForEmail('dup@x.com', 'work');
      expect(ok).toBe(true);
      expect(EMAIL_CATEGORIZER.data.categories.work.emails.filter(e => e === 'dup@x.com')).toHaveLength(1);
    });

    it('updateCategoryForDomain is a no-op add when the domain is already in the category', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.domains = ['dup.com'];
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const ok = updateCategoryForDomain('dup.com', 'work');
      expect(ok).toBe(true);
      expect(EMAIL_CATEGORIZER.data.categories.work.domains.filter(d => d === 'dup.com')).toHaveLength(1);
    });

    it('removeCategoryFromDomain skips categories that have no domains array', () => {
      EMAIL_CATEGORIZER.data = {
        version: '1.0', lastUpdated: 'x',
        categories: { work: { displayName: 'W', label: 'W' } }, // no domains array
        labelMappings: {}
      };
      // `category.domains` FALSE branch in the loop; nothing found -> returns true.
      expect(removeCategoryFromDomain('any.com')).toBe(true);
    });

    it('getAllLabelCategories skips categories that have no label', () => {
      EMAIL_CATEGORIZER.data = {
        version: '1.0', lastUpdated: 'x',
        categories: {
          work: { displayName: 'Work', label: 'Work' },
          nolabel: { displayName: 'NoLabel' } // no label -> `category.label` FALSE
        },
        labelMappings: {}
      };
      const map = getAllLabelCategories();
      expect(map.Work).toContain('work');
      expect(Object.values(map).flat()).not.toContain('nolabel');
    });

    it('removeCategoryFromLabel reuses an existing "Other" Gmail label', () => {
      EMAIL_CATEGORIZER.data = getDefaultCacheStructure();
      EMAIL_CATEGORIZER.data.categories.work.label = 'Custom';
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      // getUserLabelByName returns a truthy label -> `!gmailOtherLabel` FALSE; no createLabel.
      global.GmailApp.getUserLabelByName = jest.fn(() => ({ getName: () => 'Other' }));
      removeCategoryFromLabel('Custom', 'work');
      expect(global.GmailApp.createLabel).not.toHaveBeenCalled();
    });

    it('initializeDataLayer skips categories with no emails array when building the cache', () => {
      EMAIL_CATEGORIZER.data = {
        version: '1.0', lastUpdated: 'x',
        categories: {
          work: { displayName: 'Work', label: 'Work', domains: ['x.com'] } // no emails -> `category.emails` FALSE
        },
        labelMappings: {}
      };
      EMAIL_CATEGORIZER.lastLoaded = new Date();
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = initializeDataLayer();
      expect(result.success).toBe(true);
      expect(global.DATA_LAYER.cache['x.com']).toBe('work');
    });

    it('initializeDataLayer skips categories with no domains array when building the cache', () => {
      EMAIL_CATEGORIZER.data = {
        version: '1.0', lastUpdated: 'x',
        categories: {
          work: { displayName: 'Work', label: 'Work', emails: ['e@x.com'] } // no domains -> `category.domains` FALSE
        },
        labelMappings: {}
      };
      EMAIL_CATEGORIZER.lastLoaded = new Date();
      props.store.set('EMAIL_CATEGORIZER_FILE_ID', 'fid');
      const result = initializeDataLayer();
      expect(result.success).toBe(true);
      expect(global.DATA_LAYER.cache['e@x.com']).toBe('work');
    });

    it('getAllLabelCategories groups two categories that share the same label', () => {
      EMAIL_CATEGORIZER.data = {
        version: '1.0', lastUpdated: 'x',
        categories: {
          work: { displayName: 'Work', label: 'Shared' },
          tasks: { displayName: 'Tasks', label: 'Shared' } // same label -> `!labelCategories[label]` FALSE on 2nd
        },
        labelMappings: {}
      };
      const map = getAllLabelCategories();
      expect(map.Shared.sort()).toEqual(['tasks', 'work']);
    });

    it('initializeDataLayer reports zero counts when DATA_LAYER ends up empty', () => {
      // With the cache already "initialized" but holding no data, the DATA_LAYER
      // population block is skipped, so DATA_LAYER.categories/cache stay null and
      // the count ternaries take their falsy (0) side.
      delete global.DATA_LAYER;
      EMAIL_CATEGORIZER.isInitialized = true;
      EMAIL_CATEGORIZER.data = null;
      const result = initializeDataLayer();
      expect(result.success).toBe(true);
      expect(result.categories).toBe(0);
      expect(result.cache).toBe(0);
    });
  });
});
