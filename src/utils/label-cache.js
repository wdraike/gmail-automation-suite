// Cache for label structure
let LABEL_STRUCTURE_CACHE = null;
let LAST_CACHE_UPDATE = null;
const CACHE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Constants for PropertiesService keys and file names
const PROP_LABEL_CACHE_TIMESTAMP = "LABEL_CACHE_TIMESTAMP";
const PROP_LABEL_CACHE_FILE_ID = "LABEL_CACHE_FILE_ID";
const LABEL_CACHE_FILENAME = "GmailLabelCache.json";

/**
 * List of system labels that should be handled specially
 * These are built into Gmail and have special behavior
 */
const GMAIL_SYSTEM_LABELS = [
  "INBOX",
  "SPAM",
  "TRASH",
  "DRAFT",
  "SENT",
  "STARRED",
  "IMPORTANT",
  "UNREAD",
  "CHAT",
  "CHATS",
  "ALL_MAIL",
  "ARCHIVED",
  "SNOOZED",
  // Categories from Gmail's tabbed inbox
  "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL",
  "CATEGORY_UPDATES",
  "CATEGORY_FORUMS",
  "CATEGORY_PROMOTIONS",
];

/**
 * Get all Gmail labels with auto-initialization of cache
 * This is the main function that should be used by all consumers
 *
 * @param {boolean} forceRefresh - Force refresh from Gmail API
 * @returns {Array} Array of label objects
 */
function getGmailLabels(forceRefresh = false) {
  try {
    // If forcing refresh, clear the cache
    if (forceRefresh) {
      LABEL_STRUCTURE_CACHE = null;
      LAST_CACHE_UPDATE = null;
      Logger.log("Force refresh requested, clearing label cache");
    }

    // Ensure cache is initialized
    _ensureCacheInitialized();

    // Return the cache (even if empty)
    return LABEL_STRUCTURE_CACHE || [];
  } catch (error) {
    Logger.log(`Error in getGmailLabels: ${error}`);
    // Return empty array on error
    return [];
  }
}

/**
 * Private function to initialize the cache if needed
 * This is called automatically by getGmailLabels
 *
 * @returns {boolean} True if initialization successful
 */
function _ensureCacheInitialized() {
  // If cache is already initialized and fresh, we're good
  if (
    LABEL_STRUCTURE_CACHE &&
    LAST_CACHE_UPDATE &&
    new Date() - LAST_CACHE_UPDATE <= CACHE_EXPIRATION
  ) {
    Logger.log("Using existing label cache (still fresh)");
    return true;
  }

  Logger.log("Label cache not initialized or expired, initializing now...");

  try {
    // Try to read existing cache from storage
    const cachedTimestamp = PropertiesService.getScriptProperties().getProperty(
      PROP_LABEL_CACHE_TIMESTAMP
    );
    const cachedFileId = PropertiesService.getScriptProperties().getProperty(
      PROP_LABEL_CACHE_FILE_ID
    );

    // Check if we have both a timestamp and file ID
    if (cachedTimestamp && cachedFileId) {
      LAST_CACHE_UPDATE = new Date(
        parseInt(cachedTimestamp) || cachedTimestamp
      );

      // If cache is still fresh, load from file
      if (new Date() - LAST_CACHE_UPDATE <= CACHE_EXPIRATION) {
        try {
          const file = DriveApp.getFileById(cachedFileId);
          const content = file.getBlob().getDataAsString();
          LABEL_STRUCTURE_CACHE = JSON.parse(content);
          Logger.log(
            `Loaded ${LABEL_STRUCTURE_CACHE.length} labels from cache file.`
          );
          return true;
        } catch (fileError) {
          Logger.log(`Could not load cache file: ${fileError}`);
          // Fall through to refresh cache
        }
      } else {
        Logger.log("Cache expired, refreshing from Gmail API");
      }
    }

    // If we get here, we need to refresh the cache
    Logger.log("Refreshing label cache from Gmail API...");

    // Get all user labels
    const gmailLabels = GmailApp.getUserLabels();

    // Map Gmail labels to our cache structure
    LABEL_STRUCTURE_CACHE = gmailLabels.map((label) => {
      const name = label.getName();

      // Get parent path for nested labels
      let parentPath = null;
      if (name.includes("/")) {
        const parts = name.split("/");
        parts.pop(); // Remove the last part (current label name)
        parentPath = parts.join("/");
      }

      return {
        name: name,
        path: name,
        isSystem: isSystemLabel(name),
        parentPath: parentPath,
      };
    });

    // Update cache timestamp
    LAST_CACHE_UPDATE = new Date();

    // Store in properties
    PropertiesService.getScriptProperties().setProperty(
      PROP_LABEL_CACHE_TIMESTAMP,
      LAST_CACHE_UPDATE.getTime().toString()
    );

    // Save to file
    saveCacheToFile();

    Logger.log(`Cached ${LABEL_STRUCTURE_CACHE.length} labels from Gmail API.`);
    return true;
  } catch (error) {
    Logger.log(`Error initializing label cache: ${error}`);
    // Return false but don't throw error so consumers can still get empty array
    return false;
  }
}

/**
 * Gets a structured response with labels and cache metadata
 * Use this when you need detailed information about the labels
 *
 * @param {boolean} forceRefresh - Force refresh from Gmail API
 * @returns {Object} Result with labels and metadata
 */
function getGmailLabelStructure(forceRefresh = false) {
  try {
    // Use getGmailLabels to get the labels (will handle cache)
    const labels = getGmailLabels(forceRefresh);

    return {
      success: true,
      labels: labels,
      lastUpdated: LAST_CACHE_UPDATE
        ? LAST_CACHE_UPDATE.getTime()
        : new Date().getTime(),
      message: forceRefresh
        ? `Refreshed ${labels.length} labels from Gmail API`
        : `Retrieved ${labels.length} labels from cache`,
      fromCache:
        !forceRefresh &&
        LAST_CACHE_UPDATE &&
        new Date() - LAST_CACHE_UPDATE <= CACHE_EXPIRATION,
    };
  } catch (error) {
    Logger.log(`Error in getGmailLabelStructure: ${error}`);

    // Fallback to hardcoded labels if everything fails
    const hardcodedLabels = getHardcodedLabels();
    Logger.log(`Using ${hardcodedLabels.length} hardcoded labels as fallback`);

    return {
      success: true,
      labels: hardcodedLabels,
      lastUpdated: new Date().getTime(),
      message: `Using ${hardcodedLabels.length} hardcoded labels as fallback (error occurred)`,
      fromCache: false,
      error: error.toString(),
    };
  }
}

/**
 * Check if a label exists and returns it
 * Use this instead of direct GmailApp.getUserLabelByName calls
 *
 * @param {string} labelName - Name of the label to find
 * @returns {Object|null} Label object if found, null otherwise
 */
function getLabelByName(labelName) {
  try {
    // First check the cache
    const labels = getGmailLabels();
    const matchingLabel = labels.find((label) => label.name === labelName);

    if (matchingLabel) {
      return matchingLabel;
    }

    // If not found in cache, try direct API call as fallback
    try {
      const label = GmailApp.getUserLabelByName(labelName);
      if (label) {
        // Add to cache for next time
        if (!LABEL_STRUCTURE_CACHE) {
          LABEL_STRUCTURE_CACHE = [];
        }

        const labelNameFromApi = label.getName();
        let parentPath = null;
        if (labelNameFromApi.includes("/")) {
          const parts = labelNameFromApi.split("/");
          parts.pop(); // Remove the last part (current label name)
          parentPath = parts.join("/");
        }

        const newLabelInfo = {
          name: labelNameFromApi,
          path: labelNameFromApi,
          isSystem: isSystemLabel(labelNameFromApi),
          parentPath: parentPath,
        };
        LABEL_STRUCTURE_CACHE.push(newLabelInfo);
        return newLabelInfo;
      }
    } catch (labelError) {
      Logger.log(`Error getting label by name directly: ${labelError}`);
    }

    return null;
  } catch (error) {
    Logger.log(`Error in getLabelByName: ${error}`);
    return null;
  }
}

/**
 * Check if a label exists without making a direct API call
 *
 * @param {string} labelName - Name of the label to check
 * @returns {boolean} True if the label exists
 */
function labelExists(labelName) {
  const labels = getGmailLabels(false);
  return labels.some((label) => label.name === labelName);
}

/**
 * Save the cache to a file for persistence
 *
 * @returns {boolean} True if successful
 */
function saveCacheToFile() {
  if (!LABEL_STRUCTURE_CACHE) {
    Logger.log("No label cache to save");
    return false;
  }

  try {
    const jsonContent = JSON.stringify(LABEL_STRUCTURE_CACHE);

    // Get the existing file ID or create a new file
    let cacheFileId = PropertiesService.getScriptProperties().getProperty(
      PROP_LABEL_CACHE_FILE_ID
    );
    let file;

    if (cacheFileId) {
      try {
        file = DriveApp.getFileById(cacheFileId);
        file.setContent(jsonContent);
        Logger.log("Updated existing label cache file");
      } catch (fileError) {
        Logger.log(`Error updating cache file: ${fileError}`);
        cacheFileId = null;
      }
    }

    if (!cacheFileId) {
      // Create a new file
      file = DriveApp.createFile(LABEL_CACHE_FILENAME, jsonContent);
      PropertiesService.getScriptProperties().setProperty(
        PROP_LABEL_CACHE_FILE_ID,
        file.getId()
      );
      Logger.log(`Created new label cache file with ID: ${file.getId()}`);
    }

    return true;
  } catch (error) {
    Logger.log(`Error saving cache to file: ${error}`);
    return false;
  }
}

/**
 * Fallback function for emergencies only
 * Returns hardcoded labels if all else fails
 *
 * @returns {Array} Hardcoded set of common labels
 */
function getHardcodedLabels() {
  Logger.log("WARNING: Using hardcoded labels as fallback");

  return [
    // System labels
    { name: "INBOX", path: "INBOX", isSystem: true, parentPath: null },
    { name: "SENT", path: "SENT", isSystem: true, parentPath: null },
    { name: "DRAFT", path: "DRAFT", isSystem: true, parentPath: null },
    { name: "STARRED", path: "STARRED", isSystem: true, parentPath: null },
    { name: "TRASH", path: "TRASH", isSystem: true, parentPath: null },
    { name: "IMPORTANT", path: "IMPORTANT", isSystem: true, parentPath: null },

    // Common user labels
    { name: "Work", path: "Work", isSystem: false, parentPath: null },
    { name: "Personal", path: "Personal", isSystem: false, parentPath: null },
    { name: "Finance", path: "Finance", isSystem: false, parentPath: null },
    { name: "Travel", path: "Travel", isSystem: false, parentPath: null },
    { name: "Shopping", path: "Shopping", isSystem: false, parentPath: null },
    {
      name: "Newsletters",
      path: "Newsletters",
      isSystem: false,
      parentPath: null,
    },

    // Some nested labels
    {
      name: "Work/Projects",
      path: "Work/Projects",
      isSystem: false,
      parentPath: "Work",
    },
    {
      name: "Work/Meetings",
      path: "Work/Meetings",
      isSystem: false,
      parentPath: "Work",
    },
    {
      name: "Personal/Family",
      path: "Personal/Family",
      isSystem: false,
      parentPath: "Personal",
    },
  ];
}

/**
 * Check if a label is a system label that should be handled specially
 *
 * @param {string} labelName - The name of the label to check
 * @returns {boolean} True if this is a system label
 */
function isSystemLabel(labelName) {
  // First check if it's undefined
  if (!labelName) return false;

  // Then use the GMAIL_SYSTEM_LABELS array
  return (
    GMAIL_SYSTEM_LABELS.includes(labelName) ||
    labelName.startsWith("CATEGORY_") ||
    labelName.startsWith("SYSTEM_")
  );
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGmailLabels,
    _ensureCacheInitialized,
    getGmailLabelStructure,
    getLabelByName,
    labelExists,
    saveCacheToFile,
    getHardcodedLabels,
    isSystemLabel,
    LABEL_STRUCTURE_CACHE,
    LAST_CACHE_UPDATE,
    CACHE_EXPIRATION,
    PROP_LABEL_CACHE_TIMESTAMP,
    PROP_LABEL_CACHE_FILE_ID,
    LABEL_CACHE_FILENAME,
    GMAIL_SYSTEM_LABELS
  };
}
