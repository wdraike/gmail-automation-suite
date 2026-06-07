/**
 * Gmail Automation - Centralized Configuration
 *
 * This file contains all configuration settings for the Gmail automation scripts.
 * All sensitive data (API keys, etc.) should be stored in ScriptProperties.
 *
 * Platform access (Properties for config reads/writes, Http for the API-key test)
 * is routed through src/core/services ports via the serviceFactory seam. The seam
 * resolves the factory lazily at call time, so config.js can load first in the
 * GAS concatenation order without a circular dependency
 * (full-hexagonal-conversion, Wave 3 / D4).
 */

/**
 * Resolve the shared serviceFactory singleton (lazy, call-time).
 */
function _cfgServiceFactory() {
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

function _cfgProps() {
  return _cfgServiceFactory().getPropertiesAdapter();
}

function _cfgHttp() {
  return _cfgServiceFactory().getHttpAdapter();
}

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
  JOB_FINDER_NO_JOBS_LABEL: "JOB_FINDER_NO_JOBS_LABEL",
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
  NO_JOBS_LABEL: "📬 JobAlerts/NoJobs",

  // Google Sheet details
  ACTIVE_SHEET_NAME: "Job Listings",

  // API rate limiting
  MAX_CALLS_PER_MINUTE: 15,

  // Max email threads processed per run. Bumped to 10 (drop-precheck-bump-throughput)
  // now that the Gemini key is billing-enabled (no free-tier wall). Single source of
  // truth — referenced by getEmailThreadsToProcess in src/features/job-finder/main.js.
  MAX_EMAILS_PER_RUN: 10,

  // Wall-clock execution budget for one processJobEmailsMain run, in milliseconds.
  // Apps Script consumer time-based triggers are killed at a 6-min (360s) hard cap
  // ("Exceeded maximum execution time"). 290000ms (~4m50s) leaves margin for the
  // in-flight email + label/archive writes + cleanup before the cap. The per-email
  // loop in processEmailBatch (src/features/job-finder/main.js) checks Date.now()
  // before starting each thread and stops once this budget is reached, deferring the
  // unprocessed threads to the next hourly run (they keep their 📬 JobAlerts source
  // label and are naturally re-picked-up). Single source of truth — read in main.js.
  EXECUTION_BUDGET_MS: 290000,

  // (Notification settings) — the former NOTIFICATION_EMAIL property was removed
  // in the full-hexagonal conversion (Wave 3 / D4). It was evaluated at
  // module-load time via Session.getActiveUser().getEmail() — the only
  // module-load platform-SDK call in config.js — and had zero consumers. Removing
  // it eliminates the load-time SDK reference entirely (no documented exception
  // needed). Code that needs the user's email uses
  // serviceFactory.getGmailAdapter().getUserEmailAddress().

  // Spreadsheet columns
  SHEET_COLUMNS: [
    "Company",
    "Company Description",
    "Job Title",
    "Employment Type",
    "Work Arrangement",
    "Experience Level",
    "Location",
    "Minimum Salary",
    "Maximum Salary",
    "Salary Period",
    "Job URL",
    "URL Status",
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

  // Cap on any single in-process Utilities.sleep inside callGeminiWithRateLimiting
  // (rate-limit pre-wait + exponential backoff), in milliseconds. Apps Script
  // consumer triggers are killed at a 6-min hard cap; sleeping out a full
  // rate-limit window (up to 60s) or a multi-minute backoff INSIDE the run burns
  // that budget for no work. When the computed wait/backoff exceeds this cap, the
  // call surfaces RATE_LIMIT_REACHED instead so the email is queued for a later
  // run. 20000ms (20s) keeps short, useful waits while preventing long stalls.
  MAX_INPROCESS_WAIT_MS: 20000,
};

/**
 * Gets the API key.
 * Prefers the git-ignored local secret override (src/core/local-secrets.js,
 * pulled from GCP Secret Manager and pushed via clasp); falls back to the
 * API_KEY Script Property when the override is absent (e.g. fresh clone / tests).
 * @returns {string} The API key or null if not set.
 */
function getApiKey() {
  if (typeof GEMINI_API_KEY_OVERRIDE !== 'undefined' && GEMINI_API_KEY_OVERRIDE) {
    return GEMINI_API_KEY_OVERRIDE;
  }
  return _cfgProps().getProperty(
    PROPERTY_KEYS.API_KEY
  );
}

/**
 * Gets the Spreadsheet ID from script properties or returns the default.
 * @returns {string} The spreadsheet ID.
 */
function getSpreadsheetId() {
  return (
    _cfgProps().getProperty(
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
    _cfgProps().setProperty(
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
  const value = _cfgProps().getProperty(
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
    _cfgProps().setProperty(
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
    _cfgProps().getProperty(
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
    _cfgProps().setProperty(
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
    _cfgProps().getProperty(
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
    _cfgProps().setProperty(
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
    const apiKey = _cfgProps().getProperty(
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
    _cfgProps().setProperty(
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
    
    // Make the API call (via HttpAdapter port)
    const response = _cfgHttp().fetch(API_SERVICE_CONFIG.GEMINI_API_ENDPOINT, options);
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
    /* istanbul ignore next -- unreachable: testGeminiApiKey() has its own try/catch and always returns a result object (never throws), so this wrapper catch cannot be reached. Defensive guard only. */
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
    _cfgProps().getProperty(
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
    _cfgProps().setProperty(
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
    _cfgProps().getProperty(
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
    _cfgProps().setProperty(
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
    _cfgProps().getProperty(
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
    _cfgProps().setProperty(
      PROPERTY_KEYS.JOB_FINDER_RATE_LIMIT_LABEL,
      label
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting job finder rate limit label: ${error}`);
    return false;
  }
}

/**
 * Gets the Gmail label applied to emails where no jobs were found.
 * @returns {string} The label name.
 */
function getJobFinderNoJobsLabel() {
  return (
    _cfgProps().getProperty(
      PROPERTY_KEYS.JOB_FINDER_NO_JOBS_LABEL
    ) || JOB_FINDER_CONFIG.NO_JOBS_LABEL
  );
}

/**
 * Sets the Gmail label applied to emails where no jobs were found.
 * @param {string} label - The label name to store.
 * @returns {boolean} True if successful, false otherwise.
 */
function setJobFinderNoJobsLabel(label) {
  try {
    _cfgProps().setProperty(
      PROPERTY_KEYS.JOB_FINDER_NO_JOBS_LABEL,
      label
    );
    return true;
  } catch (error) {
    Logger.log(`Error setting job finder no-jobs label: ${error}`);
    return false;
  }
}

// Conditional exports for testing (works in both Node.js and Apps Script)
/* istanbul ignore next -- the `typeof module` guard is always true under Node/Jest and always false in GAS; the false branch is never taken in the test runtime. */
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
    getJobFinderNoJobsLabel,
    setJobFinderNoJobsLabel,
    PROPERTY_KEYS,
    EMAIL_SORTER_CONFIG,
    JOB_FINDER_CONFIG,
    API_SERVICE_CONFIG
  };
}
