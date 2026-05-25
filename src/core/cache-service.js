/**
 * Unified Cache Service
 * Centralized caching system for all data types
 * Provides consistent interface for script properties, cache service, and Drive storage
 */

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
          const cached = CacheService.getScriptCache().get(key);
          if (cached) {
            data = JSON.parse(cached);
          }
          break;
          
        case CACHE_CONFIG.STORAGE.PROPERTIES:
          const prop = PropertiesService.getScriptProperties().getProperty(key);
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
            CacheService.getScriptCache().put(key, jsonData, duration);
          }
          break;
          
        case CACHE_CONFIG.STORAGE.PROPERTIES:
          PropertiesService.getScriptProperties().setProperty(key, jsonData);
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
          CacheService.getScriptCache().remove(key);
          break;
          
        case CACHE_CONFIG.STORAGE.PROPERTIES:
          PropertiesService.getScriptProperties().deleteProperty(key);
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
          CacheService.getScriptCache().removeAll(Object.values(CACHE_CONFIG.KEYS));
          break;
          
        case CACHE_CONFIG.STORAGE.PROPERTIES:
          const props = PropertiesService.getScriptProperties();
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
      const fileId = PropertiesService.getScriptProperties().getProperty(`${key}_FILE_ID`);
      if (!fileId) return null;
      
      const file = DriveApp.getFileById(fileId);
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
      const fileId = PropertiesService.getScriptProperties().getProperty(`${key}_FILE_ID`);
      let file;
      
      if (fileId) {
        file = DriveApp.getFileById(fileId);
        file.setContent(JSON.stringify(data, null, 2));
      } else {
        file = DriveApp.createFile(`${key}.json`, JSON.stringify(data, null, 2));
        PropertiesService.getScriptProperties().setProperty(`${key}_FILE_ID`, file.getId());
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
      const fileId = PropertiesService.getScriptProperties().getProperty(`${key}_FILE_ID`);
      if (fileId) {
        DriveApp.getFileById(fileId).setTrashed(true);
        PropertiesService.getScriptProperties().deleteProperty(`${key}_FILE_ID`);
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
        const prop = PropertiesService.getScriptProperties().getProperty('EMAIL_CATEGORIES_MAP');
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
        const prop = PropertiesService.getScriptProperties().getProperty('LABEL_CATEGORIES_MAP');
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
