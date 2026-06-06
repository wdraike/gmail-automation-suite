/**
 * Email Categorizer Cache - Unified Data Storage
 *
 * This file provides a centralized system for storing and retrieving
 * email categorization data, replacing the previous multi-file approach.
 *
 * Platform access (Drive, Properties, Gmail) is routed exclusively through
 * src/core/services ports via the serviceFactory (hexagonal-ports-refactor).
 */

/** Resolve the shared serviceFactory singleton (global in Apps Script, required in Node). */
function _ccServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  if (typeof require !== 'undefined') {
    return require('../../core/services/index.js').serviceFactory;
  }
  throw new Error('serviceFactory is not available');
}

function _ccDrive() {
  return _ccServiceFactory().getDriveAdapter();
}

function _ccProps() {
  return _ccServiceFactory().getPropertiesAdapter();
}

function _ccGmail() {
  return _ccServiceFactory().getGmailAdapter();
}

/**
 * Global cache object for in-memory access
 */
const EMAIL_CATEGORIZER = {
  data: null,
  lastLoaded: null,
  isDirty: false,
  isInitialized: false,
};

/**
 * Get the default structure for a new cache
 *
 * @returns {Object} Default cache structure
 */
function getDefaultCacheStructure() {
  return {
    version: "1.0",
    lastUpdated: new Date().toISOString(),
    categories: {
      work: {
        displayName: "Work",
        label: "Work",
        domains: [],
        emails: [],
      },
      personal: {
        displayName: "Personal",
        label: "Personal",
        domains: [],
        emails: [],
      },
      finance: {
        displayName: "Finance",
        label: "Finance",
        domains: [],
        emails: [],
      },
      newsletters: {
        displayName: "Newsletters",
        label: "Newsletters",
        domains: [],
        emails: [],
      },
      shopping: {
        displayName: "Shopping",
        label: "Shopping",
        domains: [],
        emails: [],
      },
      social: {
        displayName: "Social",
        label: "Social",
        domains: [],
        emails: [],
      },
      other: {
        displayName: "Other",
        label: "Other",
        domains: [],
        emails: [],
      },
    },
    labelMappings: {},
  };
}

/**
 * Initialize the email categorizer cache
 * This should be called at the start of each script execution
 *
 * @returns {Object} Result with success flag
 */
function initializeCategorizerCache() {
  try {
    if (EMAIL_CATEGORIZER.isInitialized) {
      Logger.log("Email categorizer cache already initialized");
      return {
        success: true,
        message: "Cache already initialized",
      };
    }

    Logger.log("Initializing email categorizer cache");

    // Load data from storage
    const data = loadCategorizerData();

    // Set initialized flag
    EMAIL_CATEGORIZER.isInitialized = true;

    return {
      success: true,
      message: `Initialized with ${
        Object.keys(data.categories).length
      } categories and ${getItemCount(data)} total items`,
      categories: Object.keys(data.categories).length,
      items: getItemCount(data),
    };
  } catch (error) {
    Logger.log(`Error initializing cache: ${error}`);
    return {
      success: false,
      message: `Initialization error: ${error.toString()}`,
    };
  }
}

/**
 * Count total number of items in the cache
 *
 * @param {Object} data - The cache data
 * @returns {number} Total number of items
 */
function getItemCount(data) {
  let count = 0;

  if (!data || !data.categories) return 0;

  // Count all domains and emails in all categories
  for (const category of Object.values(data.categories)) {
    count += (category.domains || []).length;
    count += (category.emails || []).length;
  }

  return count;
}

/**
 * Load the email categorizer data
 *
 * @param {boolean} forceRefresh - Whether to force a refresh from storage
 * @returns {Object} The categorizer data
 */
function loadCategorizerData(forceRefresh = false) {
  try {
    // Use cached data if available and not forcing refresh
    if (EMAIL_CATEGORIZER.data && !forceRefresh) {
      return EMAIL_CATEGORIZER.data;
    }

    Logger.log("Loading categorizer data from storage");

    // Try to get file ID from properties
    const scriptProperties = _ccProps();
    const fileId = scriptProperties.getProperty("EMAIL_CATEGORIZER_FILE_ID");

    if (fileId) {
      // Try to load from the file
      try {
        const file = _ccDrive().getFileById(fileId);
        const content = file.getBlob().getDataAsString();
        const data = JSON.parse(content);

        // Validate basic structure
        if (data && data.version && data.categories) {
          // Update cache
          EMAIL_CATEGORIZER.data = data;
          EMAIL_CATEGORIZER.lastLoaded = new Date();
          EMAIL_CATEGORIZER.isDirty = false;

          Logger.log(
            `Loaded categorizer data with ${
              Object.keys(data.categories).length
            } categories`
          );
          return data;
        }
      } catch (fileError) {
        Logger.log(`Error reading file: ${fileError}`);
        // Continue to fallback
      }
    }

    // If we get here, we need to create a new file or restore from backup
    Logger.log(
      "Unable to load from file, checking backup or creating new data"
    );

    // Try to load from properties backup first
    const backupJson = scriptProperties.getProperty("EMAIL_CATEGORIZER_BACKUP");
    let data;

    if (backupJson) {
      try {
        data = JSON.parse(backupJson);
        // Validate backup data
        if (!data || !data.version || !data.categories) {
          Logger.log("Backup data invalid, using default structure");
          data = getDefaultCacheStructure();
        } else {
          Logger.log("Using backup data from properties");
        }
      } catch (parseError) {
        Logger.log(`Error parsing backup data: ${parseError}`);
        data = getDefaultCacheStructure();
      }
    } else {
      // Use default structure
      Logger.log("No backup found, using default structure");
      data = getDefaultCacheStructure();
    }

    // Create a new file with the data
    const newFile = _ccDrive().createFile(
      "EmailCategorizer.json",
      JSON.stringify(data, null, 2)
    );

    // Store the file ID
    scriptProperties.setProperty("EMAIL_CATEGORIZER_FILE_ID", newFile.getId());

    // Also save to backup
    scriptProperties.setProperty(
      "EMAIL_CATEGORIZER_BACKUP",
      JSON.stringify(data)
    );

    // Update cache
    EMAIL_CATEGORIZER.data = data;
    EMAIL_CATEGORIZER.lastLoaded = new Date();
    EMAIL_CATEGORIZER.isDirty = false;

    Logger.log(
      `Created new categorizer data file with ${
        Object.keys(data.categories).length
      } categories`
    );
    return data;
  } catch (error) {
    Logger.log(`Error in loadCategorizerData: ${error}`);
    // Return a minimal default structure in case of error
    const defaultData = getDefaultCacheStructure();
    EMAIL_CATEGORIZER.data = defaultData;
    return defaultData;
  }
}

/**
 * Save the email categorizer data
 *
 * @param {Object} data - The data to save (optional, uses cache if not provided)
 * @returns {boolean} True if successful
 */
function saveCategorizerData(data = null) {
  try {
    // If no data provided, use the cached data
    if (!data) {
      if (!EMAIL_CATEGORIZER.data) {
        Logger.log("No data to save");
        return false;
      }
      data = EMAIL_CATEGORIZER.data;
    }

    // Always remove labelMappings property before saving to prevent redundancy
    if (data.labelMappings) {
      Logger.log("Removing redundant labelMappings property before saving");
      delete data.labelMappings;
    }

    // Update timestamp
    data.lastUpdated = new Date().toISOString();

    // Get file ID
    const scriptProperties = _ccProps();
    const fileId = scriptProperties.getProperty("EMAIL_CATEGORIZER_FILE_ID");

    let saved = false;

    if (fileId) {
      // Update existing file
      try {
        const file = _ccDrive().getFileById(fileId);
        file.setContent(JSON.stringify(data, null, 2));
        Logger.log(`Updated categorizer data file: ${file.getName()}`);
        saved = true;
      } catch (fileError) {
        Logger.log(`Error updating file: ${fileError}`);

        // Create a new file
        try {
          const newFile = _ccDrive().createFile(
            "EmailCategorizer.json",
            JSON.stringify(data, null, 2)
          );

          scriptProperties.setProperty(
            "EMAIL_CATEGORIZER_FILE_ID",
            newFile.getId()
          );
          Logger.log(`Created new categorizer data file: ${newFile.getName()}`);
          saved = true;
        } catch (createError) {
          Logger.log(`Error creating new file: ${createError}`);
        }
      }
    } else {
      // Create a new file
      try {
        const newFile = _ccDrive().createFile(
          "EmailCategorizer.json",
          JSON.stringify(data, null, 2)
        );

        scriptProperties.setProperty(
          "EMAIL_CATEGORIZER_FILE_ID",
          newFile.getId()
        );
        Logger.log(`Created new categorizer data file: ${newFile.getName()}`);
        saved = true;
      } catch (createError) {
        Logger.log(`Error creating new file: ${createError}`);
      }
    }

    // Update backup in properties if file save was successful
    if (saved) {
      try {
        const backupJson = JSON.stringify(data);

        // Guard: the properties store has a 500KB total limit. If the backup
        // alone exceeds 100KB, skip the in-properties backup and rely on
        // the Drive file (which was just saved above). TODO: If category
        // data grows large, move backups entirely to Drive or Sheets.
        if (backupJson.length > 100000) {
          Logger.log(
            `WARN: EMAIL_CATEGORIZER_BACKUP too large (${backupJson.length} bytes). Skipping properties-store backup; Drive file is the canonical source.`
          );
        } else {
          scriptProperties.setProperty(
            "EMAIL_CATEGORIZER_BACKUP",
            backupJson
          );
        }

        // Update cache
        EMAIL_CATEGORIZER.data = data;
        EMAIL_CATEGORIZER.lastLoaded = new Date();
        EMAIL_CATEGORIZER.isDirty = false;
      } catch (backupError) {
        Logger.log(`Warning: Error updating backup: ${backupError}`);
        // Continue anyway since we saved to file
      }
    }

    return saved;
  } catch (error) {
    Logger.log(`Error in saveCategorizerData: ${error}`);
    return false;
  }
}

/**
 * Mark the cache as dirty
 */
function markCacheDirty() {
  EMAIL_CATEGORIZER.isDirty = true;
}

/**
 * Save the cache if it's dirty
 *
 * @returns {boolean} True if saved or no save was needed
 */
function saveCacheIfDirty() {
  if (EMAIL_CATEGORIZER.isDirty) {
    return saveCategorizerData();
  }
  return true;
}

/**
 * Force refresh the cache from storage
 *
 * @returns {Object} Result with success flag
 */
function refreshCache() {
  try {
    // Save any pending changes first
    if (EMAIL_CATEGORIZER.isDirty) {
      saveCategorizerData();
    }

    // Force reload from storage
    const data = loadCategorizerData(true);

    return {
      success: true,
      message: `Cache refreshed with ${
        Object.keys(data.categories).length
      } categories and ${getItemCount(data)} items`,
      categories: Object.keys(data.categories).length,
      items: getItemCount(data),
    };
  } catch (error) {
    Logger.log(`Error refreshing cache: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

//==============================================================================
// Category Management Functions
//==============================================================================

/**
 * Get all categories
 *
 * @returns {Object} Map of category keys to category objects
 */
function getAllCategories() {
  const data = loadCategorizerData();
  return data.categories || {};
}

/**
 * Get category display names
 *
 * @returns {Object} Map of category keys to display names
 */
function getCategoryDefinitions() {
  const data = loadCategorizerData();

  // Convert to simple key-name object for compatibility with old code
  const definitions = {};
  for (const [key, category] of Object.entries(data.categories || {})) {
    definitions[key] = category.displayName;
  }

  return definitions;
}

/**
 * Add or update a category
 *
 * @param {string} categoryKey - The category key
 * @param {string} displayName - The display name
 * @param {string} label - The Gmail label to use (defaults to displayName)
 * @returns {Object} Result with success flag
 */
function addCategory(categoryKey, displayName, label = null) {
  try {
    const data = loadCategorizerData();

    // Clean the category key
    categoryKey = categoryKey
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, "_");

    // Default label to display name if not provided
    if (!label) {
      label = displayName;
    }

    // Check if this is an update or new category
    const isUpdate = !!data.categories[categoryKey];

    // Create or update the category
    data.categories[categoryKey] = {
      displayName: displayName,
      label: label,
      // Preserve existing arrays if updating
      domains: isUpdate ? data.categories[categoryKey].domains || [] : [],
      emails: isUpdate ? data.categories[categoryKey].emails || [] : [],
    };

    // Save the data
    const saved = saveCategorizerData(data);

    return {
      success: saved,
      message: saved
        ? `Category "${displayName}" ${
            isUpdate ? "updated" : "created"
          } successfully`
        : "Failed to save category",
      categoryKey: categoryKey,
    };
  } catch (error) {
    Logger.log(`Error in addCategory: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Delete a category and clean up all related items
 *
 * @param {string} categoryKey - The category key to delete
 * @returns {Object} Result with success flag
 */
function deleteCategory(categoryKey) {
  try {
    Logger.log(`Starting deletion of category "${categoryKey}"`);

    // Don't allow deleting the "other" category
    if (categoryKey === "other") {
      return {
        success: false,
        message: "Cannot delete the 'other' category as it is required",
      };
    }

    const data = loadCategorizerData();

    // Check if category exists
    if (!data.categories[categoryKey]) {
      return {
        success: false,
        message: `Category "${categoryKey}" not found`,
      };
    }

    // Store all items that will be affected before deleting the category
    const emailsToClean = data.categories[categoryKey].emails
      ? data.categories[categoryKey].emails.slice()
      : [];
    const domainsToClean = data.categories[categoryKey].domains
      ? data.categories[categoryKey].domains.slice()
      : [];

    Logger.log(
      `Found ${emailsToClean.length} emails and ${domainsToClean.length} domains to clean`
    );

    // Remove the category
    delete data.categories[categoryKey];
    Logger.log(`Deleted category from data structure`);

    // Save the updated category data
    const saved = saveCategorizerData(data);

    if (!saved) {
      Logger.log(`Failed to save updated category data`);
      return {
        success: false,
        message: "Failed to delete category",
      };
    }

    // If save was successful, clean up all related items

    // Clean up all emails
    let emailsProcessed = 0;
    for (const email of emailsToClean) {
      Logger.log(`Removing category assignment for email: ${email}`);
      // Move to "other" category instead of removing completely
      updateCategoryForEmail(email, "other");
      emailsProcessed++;
    }

    // Clean up all domains
    let domainsProcessed = 0;
    for (const domain of domainsToClean) {
      Logger.log(`Removing category assignment for domain: ${domain}`);
      // Move to "other" category instead of removing completely
      updateCategoryForDomain(domain, "other");
      domainsProcessed++;
    }

    // Also remove this category from label mappings
    const allLabelCategories = getAllLabelCategories();
    for (const label in allLabelCategories) {
      const categories = allLabelCategories[label];
      const categoryIndex = categories.indexOf(categoryKey);
      if (categoryIndex !== -1) {
        // Remove this category from label
        removeCategoryFromLabel(label, categoryKey);
      }
    }

    return {
      success: true,
      message: `Category "${categoryKey}" deleted successfully`,
      emailsProcessed: emailsProcessed,
      domainsProcessed: domainsProcessed,
      totalItemsProcessed: emailsProcessed + domainsProcessed,
    };
  } catch (error) {
    Logger.log(`Error in deleteCategory: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Update an existing category
 *
 * @param {string} originalKey - The original category key
 * @param {string} newKey - The new category key (can be same as original)
 * @param {string} displayName - The new display name
 * @param {string} label - The new Gmail label (optional)
 * @returns {Object} Result with success flag
 */
function updateCategory(originalKey, newKey, displayName, label = null) {
  try {
    const data = loadCategorizerData();

    // Check if original category exists
    if (!data.categories[originalKey]) {
      return {
        success: false,
        message: `Category "${originalKey}" not found`,
      };
    }

    // Clean the new key
    newKey = newKey
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_]/g, "_");

    // Default label to display name if not provided
    if (!label) {
      label = displayName;
    }

    // Check if new key would conflict with existing category
    if (originalKey !== newKey && data.categories[newKey]) {
      return {
        success: false,
        message: `Category key "${newKey}" is already in use`,
      };
    }

    // If key is changing, we need to update all references
    if (originalKey !== newKey) {
      // Create new category with new key
      data.categories[newKey] = {
        displayName: displayName,
        label: label,
        domains: data.categories[originalKey].domains || [],
        emails: data.categories[originalKey].emails || [],
      };

      // Remove old category
      delete data.categories[originalKey];

      // Update label mappings
      for (const [label, categories] of Object.entries(data.labelMappings)) {
        if (categories.includes(originalKey)) {
          // Replace old key with new key
          data.labelMappings[label] = categories.map((cat) =>
            cat === originalKey ? newKey : cat
          );
        }
      }
    } else {
      // Just update the existing category
      data.categories[originalKey].displayName = displayName;
      data.categories[originalKey].label = label;
    }

    // Save the data
    const saved = saveCategorizerData(data);

    return {
      success: saved,
      message: saved
        ? `Category "${displayName}" updated successfully`
        : "Failed to update category",
      categoryKey: newKey,
    };
  } catch (error) {
    Logger.log(`Error in updateCategory: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

//==============================================================================
// Email/Domain Categorization Functions
//==============================================================================

/**
 * Get the category for a specific email
 *
 * @param {string} emailAddress - The email address
 * @returns {string|null} The category key or null if not found
 */
function getCategoryForEmail(emailAddress) {
  try {
    const data = loadCategorizerData();

    // Check each category for this email
    for (const [categoryKey, category] of Object.entries(data.categories)) {
      if (category.emails && category.emails.includes(emailAddress)) {
        return categoryKey;
      }
    }

    // If not found by email, check domain
    const domain = emailAddress.split("@")[1];
    if (domain) {
      return getCategoryForDomain(domain);
    }

    return null;
  } catch (error) {
    Logger.log(`Error in getCategoryForEmail: ${error}`);
    return null;
  }
}

/**
 * Get the category for a specific domain
 *
 * @param {string} domain - The domain
 * @returns {string|null} The category key or null if not found
 */
function getCategoryForDomain(domain) {
  try {
    const data = loadCategorizerData();

    // Check each category for this domain
    for (const [categoryKey, category] of Object.entries(data.categories)) {
      if (category.domains && category.domains.includes(domain)) {
        return categoryKey;
      }
    }

    return null;
  } catch (error) {
    Logger.log(`Error in getCategoryForDomain: ${error}`);
    return null;
  }
}

/**
 * Update the category for an email address
 *
 * @param {string} emailAddress - The email address
 * @param {string} categoryKey - The category key
 * @returns {boolean} True if successful
 */
function updateCategoryForEmail(emailAddress, categoryKey) {
  try {
    const data = loadCategorizerData();

    // Clean up the email address
    emailAddress = emailAddress.trim();

    // Ensure the category exists
    if (!data.categories[categoryKey]) {
      Logger.log(`Category "${categoryKey}" not found`);
      return false;
    }

    // Remove from any existing category
    for (const category of Object.values(data.categories)) {
      if (category.emails) {
        const index = category.emails.indexOf(emailAddress);
        if (index !== -1) {
          category.emails.splice(index, 1);
        }
      }
    }

    // Add to the new category
    if (!data.categories[categoryKey].emails) {
      data.categories[categoryKey].emails = [];
    }

    if (!data.categories[categoryKey].emails.includes(emailAddress)) {
      data.categories[categoryKey].emails.push(emailAddress);

      // Sort emails alphabetically for easier management
      data.categories[categoryKey].emails.sort();
    }

    // Mark as dirty
    markCacheDirty();

    // Save immediately
    return saveCategorizerData(data);
  } catch (error) {
    Logger.log(`Error in updateCategoryForEmail: ${error}`);
    return false;
  }
}

/**
 * Update the category for a domain
 *
 * @param {string} domain - The domain
 * @param {string} categoryKey - The category key
 * @returns {boolean} True if successful
 */
function updateCategoryForDomain(domain, categoryKey) {
  try {
    const data = loadCategorizerData();

    // Clean up the domain
    domain = domain.trim();

    // Ensure the category exists
    if (!data.categories[categoryKey]) {
      Logger.log(`Category "${categoryKey}" not found`);
      return false;
    }

    // Remove from any existing category
    for (const category of Object.values(data.categories)) {
      if (category.domains) {
        const index = category.domains.indexOf(domain);
        if (index !== -1) {
          category.domains.splice(index, 1);
        }
      }
    }

    // Add to the new category
    if (!data.categories[categoryKey].domains) {
      data.categories[categoryKey].domains = [];
    }

    if (!data.categories[categoryKey].domains.includes(domain)) {
      data.categories[categoryKey].domains.push(domain);

      // Sort domains alphabetically for easier management
      data.categories[categoryKey].domains.sort();
    }

    // Mark as dirty
    markCacheDirty();

    // Save immediately
    return saveCategorizerData(data);
  } catch (error) {
    Logger.log(`Error in updateCategoryForDomain: ${error}`);
    return false;
  }
}

/**
 * Remove the category from an email address
 *
 * @param {string} emailAddress - The email address
 * @returns {boolean} True if successful
 */
function removeCategoryFromEmail(emailAddress) {
  try {
    const data = loadCategorizerData();

    // Clean up the email address
    emailAddress = emailAddress.trim();

    let found = false;

    // Remove from any category
    for (const category of Object.values(data.categories)) {
      if (category.emails) {
        const index = category.emails.indexOf(emailAddress);
        if (index !== -1) {
          category.emails.splice(index, 1);
          found = true;
        }
      }
    }

    if (!found) {
      // Nothing was removed
      return true;
    }

    // Mark as dirty
    markCacheDirty();

    // Save immediately
    return saveCategorizerData(data);
  } catch (error) {
    Logger.log(`Error in removeCategoryFromEmail: ${error}`);
    return false;
  }
}

/**
 * Remove the category from a domain
 *
 * @param {string} domain - The domain
 * @returns {boolean} True if successful
 */
function removeCategoryFromDomain(domain) {
  try {
    const data = loadCategorizerData();

    // Clean up the domain
    domain = domain.trim();

    let found = false;

    // Remove from any category
    for (const category of Object.values(data.categories)) {
      if (category.domains) {
        const index = category.domains.indexOf(domain);
        if (index !== -1) {
          category.domains.splice(index, 1);
          found = true;
        }
      }
    }

    if (!found) {
      // Nothing was removed
      return true;
    }

    // Mark as dirty
    markCacheDirty();

    // Save immediately
    return saveCategorizerData(data);
  } catch (error) {
    Logger.log(`Error in removeCategoryFromDomain: ${error}`);
    return false;
  }
}

/**
 * Get categorized domains for a specific category
 *
 * @param {string} categoryKey - The category key
 * @returns {string[]} Array of domains
 */
function getDomainsForCategory(categoryKey) {
  try {
    const data = loadCategorizerData();

    if (!data.categories[categoryKey]) {
      return [];
    }

    return data.categories[categoryKey].domains || [];
  } catch (error) {
    Logger.log(`Error in getDomainsForCategory: ${error}`);
    return [];
  }
}

/**
 * Get categorized emails for a specific category
 *
 * @param {string} categoryKey - The category key
 * @returns {string[]} Array of email addresses
 */
function getEmailsForCategory(categoryKey) {
  try {
    const data = loadCategorizerData();

    if (!data.categories[categoryKey]) {
      return [];
    }

    return data.categories[categoryKey].emails || [];
  } catch (error) {
    Logger.log(`Error in getEmailsForCategory: ${error}`);
    return [];
  }
}

/**
 * Get all categorized items (emails and domains) for a specific category
 *
 * @param {string} categoryKey - The category key
 * @returns {Object} Object with emails and domains arrays
 */
function getItemsForCategory(categoryKey) {
  try {
    const data = loadCategorizerData();

    if (!data.categories[categoryKey]) {
      return {
        emails: [],
        domains: [],
      };
    }

    return {
      emails: data.categories[categoryKey].emails || [],
      domains: data.categories[categoryKey].domains || [],
    };
  } catch (error) {
    Logger.log(`Error in getItemsForCategory: ${error}`);
    return {
      emails: [],
      domains: [],
    };
  }
}

/**
 * Get all items for all categories (for UI display)
 *
 * @returns {Object} Map of category keys to items
 */
function getAllCategoryItems() {
  try {
    const data = loadCategorizerData();
    const result = {};

    for (const [key, category] of Object.entries(data.categories)) {
      result[key] = {
        displayName: category.displayName,
        label: category.label,
        emails: category.emails || [],
        domains: category.domains || [],
      };
    }

    return result;
  } catch (error) {
    Logger.log(`Error in getAllCategoryItems: ${error}`);
    return {};
  }
}

//==============================================================================
// Label-Category Mapping Functions
//==============================================================================

/**
 * Get all categories for a label - Updated version without labelMappings
 *
 * @param {string} labelName - The label name
 * @returns {string[]} Array of category keys
 */
function getCategoriesForLabel(labelName) {
  try {
    const data = loadCategorizerData();
    const categoryKeys = [];

    // Find all categories that have this label
    for (const [categoryKey, category] of Object.entries(
      data.categories || {}
    )) {
      if (category.label === labelName) {
        categoryKeys.push(categoryKey);
      }
    }

    return categoryKeys;
  } catch (error) {
    Logger.log(`Error in getCategoriesForLabel: ${error}`);
    return [];
  }
}

/**
 * Get all label-category mappings - Updated version without labelMappings
 *
 * @returns {Object} Map of labels to arrays of category keys
 */
function getAllLabelCategories() {
  try {
    const data = loadCategorizerData();
    const labelCategories = {};

    // Build label-to-categories mapping from categories
    for (const [categoryKey, category] of Object.entries(
      data.categories || {}
    )) {
      if (category.label) {
        if (!labelCategories[category.label]) {
          labelCategories[category.label] = [];
        }

        if (!labelCategories[category.label].includes(categoryKey)) {
          labelCategories[category.label].push(categoryKey);
        }
      }
    }

    return labelCategories;
  } catch (error) {
    Logger.log(`Error in getAllLabelCategories: ${error}`);
    return {};
  }
}

// In email-categorizer-cache.js
// Update this function

function removeCategoryFromLabel(labelName, categoryKey) {
  try {
    Logger.log(`Removing category "${categoryKey}" from label "${labelName}"`);

    // Get the data
    const data = loadCategorizerData();

    // Check if the category exists and has this label
    if (
      data.categories[categoryKey] &&
      data.categories[categoryKey].label === labelName
    ) {
      Logger.log(`Confirmed category has this label, proceeding with removal`);

      // Before removing, get or create the "Other" label
      let otherLabel = "Other";

      try {
        let gmailOtherLabel = _ccGmail().getUserLabelByName(otherLabel);
        if (!gmailOtherLabel) {
          // Create the Other label if it doesn't exist
          gmailOtherLabel = _ccGmail().createLabel(otherLabel);
          Logger.log(`Created "Other" Gmail label`);
        }
      } catch (labelError) {
        Logger.log(`Error with "Other" Gmail label: ${labelError}`);
      }

      // Move the category to the "Other" label
      data.categories[categoryKey].label = otherLabel;

      // Save the changes
      const saved = saveCategorizerData(data);

      // If save was successful, add the category to the "Other" label's categories
      if (saved) {
        Logger.log(`Added category to "Other" label`);
        // This will be handled automatically since we updated the category's label
      }

      return {
        success: saved,
        message: saved
          ? `Removed category from label "${labelName}" and moved to "Other"`
          : "Failed to save updates",
        changed: saved,
      };
    }

    return {
      success: true,
      message: "Category was not assigned to this label",
      changed: false,
    };
  } catch (error) {
    Logger.log(`Error in removeCategoryFromLabel: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
      changed: false,
    };
  }
}

/**
 * Add a category to a label - Updated version without labelMappings
 *
 * @param {string} labelName - The label name
 * @param {string} categoryKey - The category key
 * @returns {Object} Result with success flag
 */
function addCategoryToLabel(labelName, categoryKey) {
  try {
    // Get the data
    const data = loadCategorizerData();

    // Check if the category exists
    if (!data.categories[categoryKey]) {
      return {
        success: false,
        message: `Category "${categoryKey}" not found`,
        changed: false,
      };
    }

    // Check if already assigned
    if (data.categories[categoryKey].label === labelName) {
      return {
        success: true,
        message: "Category is already assigned to this label",
        changed: false,
      };
    }

    // Update the category's label
    data.categories[categoryKey].label = labelName;

    // Save the changes
    const saved = saveCategorizerData(data);

    return {
      success: saved,
      message: saved
        ? `Added category to label "${labelName}"`
        : "Failed to save updates",
      changed: saved,
    };
  } catch (error) {
    Logger.log(`Error in addCategoryToLabel: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
      changed: false,
    };
  }
}

/**
 * Get all labels for a specific category
 *
 * @param {string} categoryKey - The category key
 * @returns {string[]} Array of label names
 */
function getLabelsForCategory(categoryKey) {
  try {
    const data = loadCategorizerData();
    const labels = [];

    for (const [label, categories] of Object.entries(data.labelMappings)) {
      if (categories.includes(categoryKey)) {
        labels.push(label);
      }
    }

    return labels;
  } catch (error) {
    Logger.log(`Error in getLabelsForCategory: ${error}`);
    return [];
  }
}

//==============================================================================
// Statistics Functions
//==============================================================================

/**
 * Get statistics about the cache
 *
 * @returns {Object} Statistics object
 */
function getDataLayerStats() {
  try {
    const data = loadCategorizerData();

    // Count emails and domains in each category
    const categoryStats = {};
    let totalEmails = 0;
    let totalDomains = 0;

    for (const [key, category] of Object.entries(data.categories)) {
      const emails = category.emails ? category.emails.length : 0;
      const domains = category.domains ? category.domains.length : 0;

      categoryStats[key] = {
        displayName: category.displayName,
        label: category.label,
        emails: emails,
        domains: domains,
        totalItems: emails + domains,
      };

      totalEmails += emails;
      totalDomains += domains;
    }

    // Count labels
    let labelsWithCategories = 0;
    let totalCategoryAssignments = 0;

    for (const categories of Object.values(data.labelMappings)) {
      labelsWithCategories++;
      totalCategoryAssignments += categories.length;
    }

    return {
      success: true,
      lastLoaded: EMAIL_CATEGORIZER.lastLoaded,
      lastUpdated: data.lastUpdated,
      version: data.version,
      counts: {
        categories: Object.keys(data.categories).length,
        emails: totalEmails,
        domains: totalDomains,
        totalItems: totalEmails + totalDomains,
        labelsWithCategories: labelsWithCategories,
        totalCategoryAssignments: totalCategoryAssignments,
      },
      categoryStats: categoryStats,
    };
  } catch (error) {
    Logger.log(`Error getting data layer stats: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

//==============================================================================
// Import/Export Functions
//==============================================================================

/**
 * Export the cache data for backup or transfer
 *
 * @returns {Object} The cache data
 */
function exportCacheData() {
  try {
    const data = loadCategorizerData();

    // Create a clean copy for export
    const exportData = JSON.parse(JSON.stringify(data));

    // Add export timestamp
    exportData.exportedAt = new Date().toISOString();

    return {
      success: true,
      data: exportData,
    };
  } catch (error) {
    Logger.log(`Error exporting cache data: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Import cache data from a backup
 *
 * @param {Object} importData - The data to import
 * @returns {Object} Result of import
 */
function importCacheData(importData) {
  try {
    // Validate import data
    if (!importData || !importData.version || !importData.categories) {
      return {
        success: false,
        message: "Invalid import data format",
      };
    }

    // Create a clean copy for import
    const data = JSON.parse(JSON.stringify(importData));

    // Add import timestamp
    data.lastUpdated = new Date().toISOString();
    data.importedAt = new Date().toISOString();

    // Save the imported data
    const saved = saveCategorizerData(data);

    // Get counts for reporting
    let totalItems = 0;
    for (const category of Object.values(data.categories)) {
      totalItems += category.emails ? category.emails.length : 0;
      totalItems += category.domains ? category.domains.length : 0;
    }

    return {
      success: saved,
      message: saved
        ? `Imported ${
            Object.keys(data.categories).length
          } categories with ${totalItems} items`
        : "Failed to save imported data",
      categories: Object.keys(data.categories).length,
      items: totalItems,
    };
  } catch (error) {
    Logger.log(`Error importing cache data: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Reset the cache to default values
 *
 * @param {boolean} keepBackup - Whether to keep a backup of the current data
 * @returns {Object} Result of reset
 */
function resetCache(keepBackup = true) {
  try {
    // Get current data for backup
    const currentData = loadCategorizerData();

    // Create a backup if requested
    if (keepBackup) {
      try {
        // Backup to a new file
        const backupFile = _ccDrive().createFile(
          `EmailCategorizer_Backup_${new Date()
            .toISOString()
            .replace(/:/g, "-")}.json`,
          JSON.stringify(currentData, null, 2)
        );

        Logger.log(`Created backup file: ${backupFile.getName()}`);
      } catch (backupError) {
        Logger.log(`Warning: Error creating backup: ${backupError}`);
        // Continue with reset even if backup fails
      }
    }

    // Create new default data
    const newData = getDefaultCacheStructure();

    // Save the new data
    const saved = saveCategorizerData(newData);

    return {
      success: saved,
      message: saved
        ? "Cache reset to default values"
        : "Failed to reset cache",
      backupCreated: keepBackup,
    };
  } catch (error) {
    Logger.log(`Error resetting cache: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

//==============================================================================
// Legacy Compatibility Functions
//==============================================================================

/**
 * Update the Google Drive file IDs in script properties
 * for compatibility with previous versions
 *
 * @returns {Object} The updated file IDs
 */
function updateFileIdsFromProperties() {
  try {
    const scriptProperties = _ccProps();

    // Get the new file ID
    const newFileId = scriptProperties.getProperty("EMAIL_CATEGORIZER_FILE_ID");

    if (newFileId) {
      // Update the old file ID properties for compatibility
      scriptProperties.setProperty("CATEGORIES_FILE_ID", newFileId);
      scriptProperties.setProperty("CACHE_FILE_ID", newFileId);
      scriptProperties.setProperty("EMAIL_CACHE_FILE_ID", newFileId);

      return {
        success: true,
        message: "File IDs updated in properties",
        fileId: newFileId,
      };
    }

    return {
      success: false,
      message: "New file ID not found",
    };
  } catch (error) {
    Logger.log(`Error updating file IDs: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * For compatibility with old code - initializes the DATA_LAYER object
 *
 * @returns {Object} Result with success flag
 */
function initializeDataLayer() {
  try {
    // Define global DATA_LAYER if it doesn't exist
    if (typeof DATA_LAYER === "undefined") {
      global.DATA_LAYER = {
        categories: null,
        cache: null,
        labels: null,
        lastLoaded: {
          categories: null,
          cache: null,
          labels: null,
        },
      };
    }

    // Initialize our cache
    initializeCategorizerCache();

    // Update global DATA_LAYER with our data
    if (EMAIL_CATEGORIZER.data) {
      // Convert the new format to the old format

      // For categories, we need key-to-name mapping
      DATA_LAYER.categories = {};
      for (const [key, category] of Object.entries(
        EMAIL_CATEGORIZER.data.categories
      )) {
        DATA_LAYER.categories[key] = category.displayName;
      }

      // For cache, we need a flat map of items to category keys
      DATA_LAYER.cache = {};

      for (const [key, category] of Object.entries(
        EMAIL_CATEGORIZER.data.categories
      )) {
        // Add emails
        if (category.emails) {
          for (const email of category.emails) {
            DATA_LAYER.cache[email] = key;
          }
        }

        // Add domains
        if (category.domains) {
          for (const domain of category.domains) {
            DATA_LAYER.cache[domain] = key;
          }
        }
      }

      // Update timestamps
      DATA_LAYER.lastLoaded.categories =
        EMAIL_CATEGORIZER.lastLoaded?.getTime();
      DATA_LAYER.lastLoaded.cache = EMAIL_CATEGORIZER.lastLoaded?.getTime();
    }

    // Update file IDs in properties
    updateFileIdsFromProperties();

    return {
      success: true,
      message: "DATA_LAYER initialized for compatibility",
      categories: DATA_LAYER.categories
        ? Object.keys(DATA_LAYER.categories).length
        : 0,
      cache: DATA_LAYER.cache ? Object.keys(DATA_LAYER.cache).length : 0,
    };
  } catch (error) {
    Logger.log(`Error initializing DATA_LAYER: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * For compatibility with old code - force refresh data from storage
 *
 * @returns {Object} Result with success flag
 */
function forceRefreshData() {
  try {
    // Refresh our cache
    const result = refreshCache();

    // Update DATA_LAYER
    initializeDataLayer();

    return {
      success: result.success,
      message: result.message,
      categoriesCount: result.categories,
      cacheCount: result.items,
    };
  } catch (error) {
    Logger.log(`Error in forceRefreshData: ${error}`);
    return {
      success: false,
      error: error.toString(),
    };
  }
}

function testNewCacheSystem() {
  // Initialize the cache
  const initResult = initializeCategorizerCache();
  Logger.log("Initialization result: " + JSON.stringify(initResult));

  // Get statistics
  const stats = getDataLayerStats();
  Logger.log("Cache statistics: " + JSON.stringify(stats));

  return {
    initResult: initResult,
    stats: stats,
  };
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
    testNewCacheSystem,
    EMAIL_CATEGORIZER
  };
}
