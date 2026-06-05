/**
 * Gmail Automation - Centralized Configuration
 *
 * This file contains all configuration settings for the Gmail automation scripts.
 * All sensitive data (API keys, etc.) should be stored in ScriptProperties.
 */

// Script Properties Keys
const PROPERTY_KEYS = {
  API_KEY: "API_KEY",
  SPREADSHEET_ID: "SPREADSHEET_ID",
  CACHE_FILE_ID: "CACHE_FILE_ID",
  CATEGORIES_FILE_ID: "CATEGORIES_FILE_ID",
  RATE_LIMIT_NEXT_RUN: "RATE_LIMIT_NEXT_RUN",
  ENABLE_DYNAMIC_CATEGORIES: "ENABLE_DYNAMIC_CATEGORIES",
  JOB_FINDER_SOURCE_LABEL: "JOB_FINDER_SOURCE_LABEL",
  JOB_FINDER_PROCESSED_LABEL: "JOB_FINDER_PROCESSED_LABEL",
  JOB_FINDER_RATE_LIMIT_LABEL: "JOB_FINDER_RATE_LIMIT_LABEL",
};

// Global retention rules array. Centralized here to eliminate the dangerous
// load-order dependency between dashboardController.js and
// email-retention-manager.js (ARCH-BLOCK-01).
var RETENTION_RULES = null;


// Email Sorter Configuration
const EMAIL_SORTER_CONFIG = {
  // AI categorization settings
  CHECK_INTERVAL_MINUTES: 1,
  MAX_GEMINI_CALLS_PER_MINUTE: 15,
  ENABLE_DYNAMIC_CATEGORIES: true,

  // Default categories
  DEFAULT_CATEGORIES: {
    finance: "Finance",
    shopping: "Shopping",
    social: "Social",
    travel: "Travel",
    work: "Work",
    newsletters: "Newsletters",
    personal: "Personal",
    other: "Other",
  },
};

// Job Finder Configuration
const JOB_FINDER_CONFIG = {
  // Gmail labels
  SOURCE_LABEL: "📬 JobAlerts",
  PROCESSED_LABEL: "📬 JobAlerts/Processed",
  RATE_LIMIT_LABEL: "📬 JobAlerts/RateLimitQueue",

  // Google Sheet details
  ACTIVE_SHEET_NAME: "Job Listings",
  BACKUP_SHEET_NAME: "Duplicate Listings",

  // API rate limiting
  MAX_CALLS_PER_MINUTE: 15,

  // Notification settings
  NOTIFICATION_EMAIL: Session.getActiveUser().getEmail(),

  // Spreadsheet columns
  SHEET_COLUMNS: [
    "Company",
    "Company Description",
    "Job Title",
    "Location",
    "Minimum Salary",
    "Maximum Salary",
    "Salary Period",
    "Job URL",
    "URL Status",
    "Careers URL",
    "Careers URL Status",
    "Email Received Date",
    "Email Source",
    "Date Added",
    "Interest",
    "Email Title",
    "Jobs Found In Email"
  ],
};


// API Service Configuration
const API_SERVICE_CONFIG = {
  GEMINI_API_ENDPOINT:
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000, // Initial retry delay in milliseconds
  CACHE_DURATION_SECONDS: 3600, // 1 hour cache for API responses
};

/**
 * Gets the API key from script properties.
 * @returns {string} The API key or null if not set.
 */
function getApiKey() {
  return PropertiesService.getScriptProperties().getProperty(
    PROPERTY_KEYS.API_KEY
  );
}

/**
 * Gets the Spreadsheet ID from script properties or returns the default.
 * @returns {string} The spreadsheet ID.
 */
function getSpreadsheetId() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PROPERTY_KEYS.SPREADSHEET_ID
    ) || ""
  );
}

/**
 * Sets the Spreadsheet ID in script properties.
 * @param {string} spreadsheetId - The spreadsheet ID to store.
 * @returns {boolean} True if successful, false otherwise.
 */
function setSpreadsheetId(spreadsheetId) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.SPREADSHEET_ID,
      spreadsheetId
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting spreadsheet ID: ${error}`);
    return false;
  }
}

/**
 * Gets whether dynamic categories are enabled.
 * @returns {boolean} True if dynamic categories are enabled.
 */
function isDynamicCategoriesEnabled() {
  const value = PropertiesService.getScriptProperties().getProperty(
    PROPERTY_KEYS.ENABLE_DYNAMIC_CATEGORIES
  );
  return value === "true";
}

/**
 * Sets whether dynamic categories are enabled.
 * @param {boolean} enabled - Whether to enable dynamic categories.
 * @returns {boolean} True if successful, false otherwise.
 */
function setDynamicCategoriesEnabled(enabled) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.ENABLE_DYNAMIC_CATEGORIES,
      enabled.toString()
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting dynamic categories setting: ${error}`);
    return false;
  }
}

/**
 * Gets the cache file ID.
 * @returns {string} The cache file ID.
 */
function getCacheFileId() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PROPERTY_KEYS.CACHE_FILE_ID
    ) || ""
  );
}

/**
 * Sets the cache file ID.
 * @param {string} fileId - The cache file ID to store.
 * @returns {boolean} True if successful, false otherwise.
 */
function setCacheFileId(fileId) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.CACHE_FILE_ID,
      fileId
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting cache file ID: ${error}`);
    return false;
  }
}

/**
 * Gets the categories file ID.
 * @returns {string} The categories file ID.
 */
function getCategoriesFileId() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PROPERTY_KEYS.CATEGORIES_FILE_ID
    ) || ""
  );
}

/**
 * Sets the categories file ID.
 * @param {string} fileId - The categories file ID to store.
 * @returns {boolean} True if successful, false otherwise.
 */
function setCategoriesFileId(fileId) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.CATEGORIES_FILE_ID,
      fileId
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting categories file ID: ${error}`);
    return false;
  }
}

/**
 * Checks if an API key is set.
 *
 * @returns {boolean} True if API key is set, false otherwise
 */
function isApiKeySet() {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty(
      PROPERTY_KEYS.API_KEY
    );
    return Boolean(apiKey);
  } catch (error) {
    Logger.log(`Error checking API key: ${error}`);
    return false;
  }
}

/**
 * Sets the Gemini API key in script properties.
 * This should be called from the UI when the user enters their API key.
 *
 * @param {string} apiKey - The API key to store
 * @returns {string} Success message
 */
function setApiKey(apiKey) {
  if (!apiKey || apiKey.trim() === "") {
    Logger.log("Error: Empty API key provided");
    return "Error: Please provide a valid API key";
  }

  try {
    // Store it in script properties (trim whitespace)
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.API_KEY,
      apiKey.trim()
    );

    Logger.log("API key has been set");
    return "API key set successfully";
  } catch (error) {
    Logger.log(`Error setting API key: ${error}`);
    return `Error setting API key: ${error.toString()}`;
  }
}

/**
 * Set API key from the web app.
 * This is an alias for setApiKey to maintain backward compatibility.
 *
 * @param {string} apiKey - The API key to save
 * @returns {string} Success message
 */
function setApiKeyFromWebApp(apiKey) {
  return setApiKey(apiKey);
}


/**
 * Test the API key by making a simple API call
 * 
 * @returns {Object} Test results
 */
function testGeminiApiKey() {
  try {
    const apiKey = getApiKey();
    
    if (!apiKey) {
      return {
        success: false,
        message: "No API key found"
      };
    }
    
    // Simple test prompt
    const testPrompt = "Respond with 'API key is working' if you receive this message.";
    
    // Prepare the payload
    const payload = {
      contents: [{
        parts: [{
          text: testPrompt
        }]
      }]
    };
    
    // Set up the request options
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: {
        "x-goog-api-key": apiKey
      },
      muteHttpExceptions: true
    };
    
    // Make the API call
    const response = UrlFetchApp.fetch(API_SERVICE_CONFIG.GEMINI_API_ENDPOINT, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      return {
        success: false,
        message: `API returned status ${responseCode}`,
        status: responseCode
      };
    }
    
    const responseText = response.getContentText();
    const jsonResponse = JSON.parse(responseText);
    
    if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {
      return {
        success: true,
        message: "API key is valid and working",
        response: jsonResponse.candidates[0].content.parts[0].text.substring(0, 100)
      };
    } else if (jsonResponse.error) {
      return {
        success: false,
        message: `Gemini API Error: ${jsonResponse.error.message}`
      };
    } else {
      return {
        success: false,
        message: "Unexpected response format"
      };
    }
  } catch (error) {
    Logger.log(`Error testing API key: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`
    };
  }
}


/**
 * UI wrapper to test the API key connection
 * 
 * @returns {string} User-friendly response
 */
function testApiKeyConnection() {
  try {
    const result = testGeminiApiKey();
    
    if (result.success) {
      return `✅ API connection successful!\n\nGemini API responded correctly. Your email categorization should work properly.`;
    } else {
      return `❌ API connection failed: ${result.message}\n\nPlease check your API key and try again.`;
    }
  } catch (error) {
    return `Error testing API connection: ${error.toString()}`;
  }
}

/**
 * Save API key from Gmail add-on
 * 
 * @param {Object} e - Event object from form submission
 * @returns {ActionResponse} Card response
 */
function saveApiKeyFromAddon(e) {
  try {
    const apiKey = e.formInput.apiKey;
    
    if (!apiKey || apiKey.trim() === "") {
      return CardService.newActionResponseBuilder()
        .setNotification(CardService.newNotification()
          .setText("Error: API key cannot be empty"))
        .build();
    }
    
    setApiKey(apiKey.trim());
    
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText("API key saved successfully"))
      .setNavigation(CardService.newNavigation().popToRoot())
      .build();
  } catch (error) {
    Logger.log(`Error saving API key: ${error}`);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText(`Error: ${error.toString()}`))
      .build();
  }
}

/**
 * Test API key from Gmail add-on
 * 
 * @returns {ActionResponse} Card response
 */
function testApiKeyFromAddon() {
  try {
    const testResult = testGeminiApiKey();
    
    const message = testResult.success 
      ? "API connection successful! Gemini API is working correctly."
      : `API test failed: ${testResult.message}`;
    
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText(message))
      .build();
  } catch (error) {
    Logger.log(`Error testing API key: ${error}`);
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText(`Error: ${error.toString()}`))
      .build();
  }
}

/**
 * Gets the Gmail label used as the source for job alert emails.
 * @returns {string} The label name.
 */
function getJobFinderSourceLabel() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PROPERTY_KEYS.JOB_FINDER_SOURCE_LABEL
    ) || JOB_FINDER_CONFIG.SOURCE_LABEL
  );
}

/**
 * Sets the Gmail label used as the source for job alert emails.
 * @param {string} label - The label name to store.
 * @returns {boolean} True if successful, false otherwise.
 */
function setJobFinderSourceLabel(label) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.JOB_FINDER_SOURCE_LABEL,
      label
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting job finder source label: ${error}`);
    return false;
  }
}

/**
 * Gets the Gmail label applied to processed job alert emails.
 * @returns {string} The label name.
 */
function getJobFinderProcessedLabel() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PROPERTY_KEYS.JOB_FINDER_PROCESSED_LABEL
    ) || JOB_FINDER_CONFIG.PROCESSED_LABEL
  );
}

/**
 * Sets the Gmail label applied to processed job alert emails.
 * @param {string} label - The label name to store.
 * @returns {boolean} True if successful, false otherwise.
 */
function setJobFinderProcessedLabel(label) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.JOB_FINDER_PROCESSED_LABEL,
      label
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting job finder processed label: ${error}`);
    return false;
  }
}

/**
 * Gets the Gmail label used to queue rate-limited job alert emails.
 * @returns {string} The label name.
 */
function getJobFinderRateLimitLabel() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PROPERTY_KEYS.JOB_FINDER_RATE_LIMIT_LABEL
    ) || JOB_FINDER_CONFIG.RATE_LIMIT_LABEL
  );
}

/**
 * Sets the Gmail label used to queue rate-limited job alert emails.
 * @param {string} label - The label name to store.
 * @returns {boolean} True if successful, false otherwise.
 */
function setJobFinderRateLimitLabel(label) {
  try {
    PropertiesService.getScriptProperties().setProperty(
      PROPERTY_KEYS.JOB_FINDER_RATE_LIMIT_LABEL,
      label
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting job finder rate limit label: ${error}`);
    return false;
  }
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getApiKey,
    getSpreadsheetId,
    setSpreadsheetId,
    isDynamicCategoriesEnabled,
    setDynamicCategoriesEnabled,
    getCacheFileId,
    setCacheFileId,
    getCategoriesFileId,
    setCategoriesFileId,
    isApiKeySet,
    setApiKey,
    setApiKeyFromWebApp,
    testGeminiApiKey,
    testApiKeyConnection,
    saveApiKeyFromAddon,
    testApiKeyFromAddon,
    getJobFinderSourceLabel,
    setJobFinderSourceLabel,
    getJobFinderProcessedLabel,
    setJobFinderProcessedLabel,
    getJobFinderRateLimitLabel,
    setJobFinderRateLimitLabel,
    PROPERTY_KEYS,
    EMAIL_SORTER_CONFIG,
    JOB_FINDER_CONFIG,
    API_SERVICE_CONFIG
  };
}
