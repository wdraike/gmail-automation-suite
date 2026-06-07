/**
 * Unified Cache Service
 * Centralized caching system for all data types
 * Provides consistent interface for script properties, cache service, and Drive storage
 *
 * This is the application-level cache service. Its storage backends (script
 * cache, script properties, Drive) are accessed exclusively through the
 * src/core/services ports (CacheAdapter, PropertiesAdapter, DriveAdapter) via
 * the serviceFactory seam — no direct platform SDK references
 * (full-hexagonal-conversion, Wave 4 / D3).
 */

/**
 * Resolve the shared serviceFactory singleton (lazy, call-time).
 */
function _csServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  /* istanbul ignore else -- in Node `require` is always defined; the else (defensive throw) is unreachable in both Node and GAS. */
  if (typeof require !== 'undefined') {
    return require('./services/index.js').serviceFactory;
  } else {
    throw new Error('serviceFactory is not available');
  }
}

function _csCache() {
  return _csServiceFactory().getCacheAdapter();
}

function _csProps() {
  return _csServiceFactory().getPropertiesAdapter();
}

function _csDrive() {
  return _csServiceFactory().getDriveAdapter();
}

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  // Cache keys
  KEYS: {
    EMAIL_CATEGORIES: 'EMAIL_CATEGORIES_CACHE',
    LABEL_CATEGORIES: 'LABEL_CATEGORIES_MAP',
    GMAIL_LABELS: 'GMAIL_LABELS_CACHE',
    CATEGORY_DEFINITIONS: 'CATEGORY_DEFINITIONS',
    RETENTION_RULES: 'EMAIL_RETENTION_RULES',
    API_MONITOR: 'API_MONITOR_STATE'
  },
  
  // Cache durations (in seconds)
  DURATIONS: {
    SHORT: 300,      // 5 minutes
    MEDIUM: 3600,    // 1 hour
    LONG: 86400,     // 24 hours
    PERMANENT: -1    // No expiration
  },
  
  // Storage types
  STORAGE: {
    CACHE: 'cache',
    PROPERTIES: 'properties',
    DRIVE: 'drive'
  }
};

/**
 * Main cache service
 */
const UnifiedCacheCore = {
  /**
   * Get data from cache with fallback to properties
   * @param {string} key - Cache key
   * @param {string} storageType - Storage type (cache, properties, drive)
   * @returns {*} Cached data or null
   */
  get(key, storageType = CACHE_CONFIG.STORAGE.CACHE) {
    try {
      let data = null;
      
      switch (storageType) {
        case CACHE_CONFIG.STORAGE.CACHE:
          const cached = _csCache().get(key);
          if (cached) {
            data = JSON.parse(cached);
          }
          break;

        case CACHE_CONFIG.STORAGE.PROPERTIES:
          const prop = _csProps().getProperty(key);
          if (prop) {
            data = JSON.parse(prop);
          }
          break;
          
        case CACHE_CONFIG.STORAGE.DRIVE:
          data = this._getDriveData(key);
          break;
      }
      
      return data;
    } catch (error) {
      Logger.log(`Error getting cache ${key}: ${error}`);
      return null;
    }
  },
  
  /**
   * Set data in cache
   * @param {string} key - Cache key
   * @param {*} data - Data to cache
   * @param {number} duration - Cache duration in seconds
   * @param {string} storageType - Storage type
   * @returns {boolean} Success status
   */
  set(key, data, duration = CACHE_CONFIG.DURATIONS.SHORT, storageType = CACHE_CONFIG.STORAGE.CACHE) {
    try {
      const jsonData = JSON.stringify(data);
      
      switch (storageType) {
        case CACHE_CONFIG.STORAGE.CACHE:
          if (duration > 0) {
            _csCache().put(key, jsonData, duration);
          }
          break;

        case CACHE_CONFIG.STORAGE.PROPERTIES:
          _csProps().setProperty(key, jsonData);
          break;
          
        case CACHE_CONFIG.STORAGE.DRIVE:
          this._setDriveData(key, data);
          break;
      }
      
      return true;
    } catch (error) {
      Logger.log(`Error setting cache ${key}: ${error}`);
      return false;
    }
  },
  
  /**
   * Delete cached data
   * @param {string} key - Cache key
   * @param {string} storageType - Storage type
   * @returns {boolean} Success status
   */
  delete(key, storageType = CACHE_CONFIG.STORAGE.CACHE) {
    try {
      switch (storageType) {
        case CACHE_CONFIG.STORAGE.CACHE:
          _csCache().remove(key);
          break;

        case CACHE_CONFIG.STORAGE.PROPERTIES:
          _csProps().deleteProperty(key);
          break;
          
        case CACHE_CONFIG.STORAGE.DRIVE:
          this._deleteDriveData(key);
          break;
      }
      
      return true;
    } catch (error) {
      Logger.log(`Error deleting cache ${key}: ${error}`);
      return false;
    }
  },
  
  /**
   * Clear all cache of a specific type
   * @param {string} storageType - Storage type to clear
   * @returns {boolean} Success status
   */
  clearAll(storageType = CACHE_CONFIG.STORAGE.CACHE) {
    try {
      switch (storageType) {
        case CACHE_CONFIG.STORAGE.CACHE:
          _csCache().removeAll(Object.values(CACHE_CONFIG.KEYS));
          break;

        case CACHE_CONFIG.STORAGE.PROPERTIES:
          const props = _csProps();
          Object.values(CACHE_CONFIG.KEYS).forEach(key => {
            props.deleteProperty(key);
          });
          break;
      }
      
      return true;
    } catch (error) {
      Logger.log(`Error clearing cache: ${error}`);
      return false;
    }
  },
  
  /**
   * Get or compute data with caching
   * @param {string} key - Cache key
   * @param {Function} computeFn - Function to compute data if not cached
   * @param {number} duration - Cache duration
   * @param {string} storageType - Storage type
   * @returns {*} Cached or computed data
   */
  getOrCompute(key, computeFn, duration = CACHE_CONFIG.DURATIONS.SHORT, storageType = CACHE_CONFIG.STORAGE.CACHE) {
    let data = this.get(key, storageType);
    
    if (data === null) {
      data = computeFn();
      if (data !== null && data !== undefined) {
        this.set(key, data, duration, storageType);
      }
    }
    
    return data;
  },
  
  /**
   * Private method to get data from Drive
   * @private
   */
  _getDriveData(key) {
    try {
      const fileId = _csProps().getProperty(`${key}_FILE_ID`);
      if (!fileId) return null;

      const file = _csDrive().getFileById(fileId);
      const content = file.getBlob().getDataAsString();
      return JSON.parse(content);
    } catch (error) {
      Logger.log(`Error reading Drive file for ${key}: ${error}`);
      return null;
    }
  },
  
  /**
   * Private method to set data in Drive
   * @private
   */
  _setDriveData(key, data) {
    try {
      const fileId = _csProps().getProperty(`${key}_FILE_ID`);
      let file;

      if (fileId) {
        file = _csDrive().getFileById(fileId);
        file.setContent(JSON.stringify(data, null, 2));
      } else {
        file = _csDrive().createFile(`${key}.json`, JSON.stringify(data, null, 2));
        _csProps().setProperty(`${key}_FILE_ID`, file.getId());
      }
      
      return true;
    } catch (error) {
      Logger.log(`Error writing Drive file for ${key}: ${error}`);
      return false;
    }
  },
  
  /**
   * Private method to delete Drive data
   * @private
   */
  _deleteDriveData(key) {
    try {
      const fileId = _csProps().getProperty(`${key}_FILE_ID`);
      if (fileId) {
        _csDrive().getFileById(fileId).setTrashed(true);
        _csProps().deleteProperty(`${key}_FILE_ID`);
      }
      return true;
    } catch (error) {
      Logger.log(`Error deleting Drive file for ${key}: ${error}`);
      return false;
    }
  }
};

/**
 * Specialized cache managers
 */

/**
 * Email categories cache manager
 */
const EmailCategoriesCache = {
  /**
   * Get all email categories
   * @returns {Object} Email to categories mapping
   */
  getAll() {
    return UnifiedCacheCore.getOrCompute(
      CACHE_CONFIG.KEYS.EMAIL_CATEGORIES,
      () => {
        // Fallback to properties if not in cache
        const prop = _csProps().getProperty('EMAIL_CATEGORIES_MAP');
        return prop ? JSON.parse(prop) : {};
      },
      CACHE_CONFIG.DURATIONS.MEDIUM,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
  },
  
  /**
   * Get categories for a specific email
   * @param {string} email - Email address
   * @returns {string[]} Array of categories
   */
  getForEmail(email) {
    const allCategories = this.getAll();
    return allCategories[email.toLowerCase()] || [];
  },
  
  /**
   * Update categories for an email
   * @param {string} email - Email address
   * @param {string[]} categories - Categories array
   * @returns {boolean} Success status
   */
  updateForEmail(email, categories) {
    const allCategories = this.getAll();
    allCategories[email.toLowerCase()] = categories;
    
    // Save to both cache and properties
    const success = UnifiedCacheCore.set(
      CACHE_CONFIG.KEYS.EMAIL_CATEGORIES,
      allCategories,
      CACHE_CONFIG.DURATIONS.MEDIUM,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
    
    if (success) {
      UnifiedCacheCore.set(
        CACHE_CONFIG.KEYS.EMAIL_CATEGORIES,
        allCategories,
        CACHE_CONFIG.DURATIONS.MEDIUM,
        CACHE_CONFIG.STORAGE.CACHE
      );
    }
    
    return success;
  },
  
  /**
   * Remove an email from categories
   * @param {string} email - Email address
   * @returns {boolean} Success status
   */
  removeEmail(email) {
    const allCategories = this.getAll();
    delete allCategories[email.toLowerCase()];
    
    return UnifiedCacheCore.set(
      CACHE_CONFIG.KEYS.EMAIL_CATEGORIES,
      allCategories,
      CACHE_CONFIG.DURATIONS.MEDIUM,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
  }
};

/**
 * Label categories cache manager
 */
const LabelCategoriesCache = {
  /**
   * Get all label to category mappings
   * @returns {Object} Label to categories mapping
   */
  getAll() {
    return UnifiedCacheCore.getOrCompute(
      CACHE_CONFIG.KEYS.LABEL_CATEGORIES,
      () => {
        const prop = _csProps().getProperty('LABEL_CATEGORIES_MAP');
        /* istanbul ignore next -- the truthy branch is unreachable: CACHE_CONFIG.KEYS.LABEL_CATEGORIES === 'LABEL_CATEGORIES_MAP', so getOrCompute's prior get() already read this exact property; the computeFn only runs on a miss, at which point this read also returns null. */
        return prop ? JSON.parse(prop) : {};
      },
      CACHE_CONFIG.DURATIONS.LONG,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
  },
  
  /**
   * Get categories for a label
   * @param {string} labelName - Label name
   * @returns {string[]} Array of categories
   */
  getForLabel(labelName) {
    const allMappings = this.getAll();
    return allMappings[labelName] || [];
  },
  
  /**
   * Update categories for a label
   * @param {string} labelName - Label name
   * @param {string[]} categories - Categories array
   * @returns {boolean} Success status
   */
  updateForLabel(labelName, categories) {
    const allMappings = this.getAll();
    
    if (categories && categories.length > 0) {
      allMappings[labelName] = categories;
    } else {
      delete allMappings[labelName];
    }
    
    return UnifiedCacheCore.set(
      CACHE_CONFIG.KEYS.LABEL_CATEGORIES,
      allMappings,
      CACHE_CONFIG.DURATIONS.LONG,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
  }
};

/**
 * Category definitions cache manager
 */
const CategoryDefinitionsCache = {
  /**
   * Get all category definitions
   * @returns {Object} Category definitions
   */
  getAll() {
    return UnifiedCacheCore.getOrCompute(
      CACHE_CONFIG.KEYS.CATEGORY_DEFINITIONS,
      () => {
        const defaults = EMAIL_SORTER_CONFIG.DEFAULT_CATEGORIES || {};
        return defaults;
      },
      CACHE_CONFIG.DURATIONS.LONG,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
  },
  
  /**
   * Update category definitions
   * @param {Object} definitions - New definitions
   * @returns {boolean} Success status
   */
  update(definitions) {
    return UnifiedCacheCore.set(
      CACHE_CONFIG.KEYS.CATEGORY_DEFINITIONS,
      definitions,
      CACHE_CONFIG.DURATIONS.LONG,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
  }
};

/**
 * Retention rules cache manager
 */
const RetentionRulesCache = {
  /**
   * Get all retention rules
   * @returns {Array} Retention rules array
   */
  getAll() {
    return UnifiedCacheCore.get(CACHE_CONFIG.KEYS.RETENTION_RULES, CACHE_CONFIG.STORAGE.PROPERTIES) || [];
  },
  
  /**
   * Update retention rules
   * @param {Array} rules - New rules array
   * @returns {boolean} Success status
   */
  update(rules) {
    return UnifiedCacheCore.set(
      CACHE_CONFIG.KEYS.RETENTION_RULES,
      rules,
      CACHE_CONFIG.DURATIONS.PERMANENT,
      CACHE_CONFIG.STORAGE.PROPERTIES
    );
  }
};

/**
 * Export all cache managers
 */
const UnifiedCacheService = {
  core: UnifiedCacheCore,
  emailCategories: EmailCategoriesCache,
  labelCategories: LabelCategoriesCache,
  categoryDefinitions: CategoryDefinitionsCache,
  retentionRules: RetentionRulesCache,
  config: CACHE_CONFIG
};

// Conditional exports for testing (works in both Node.js and Apps Script)
/* istanbul ignore next -- the `typeof module` guard is always true under Node/Jest and always false in GAS; the false branch is never taken in the test runtime. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CACHE_CONFIG,
    UnifiedCacheCore,
    EmailCategoriesCache,
    LabelCategoriesCache,
    CategoryDefinitionsCache,
    RetentionRulesCache,
    UnifiedCacheService
  };
}
