/**
 * Gmail Automation - Setup Script
 *
 * This script initializes the Gmail automation system and ensures
 * all required functions and resources are available.
 */

/**
 * One-time setup function to initialize the entire system
 * Run this function once after deployment
 *
 * @returns {Object} Setup results
 */
function initializeEmailAutomation() {
  try {
    Logger.log("Starting Gmail automation initialization...");

    // Test core functions
    let coreStatus = testCoreFunctions();
    if (!coreStatus.success) {
      return {
        success: false,
        message: `Core functions error: ${coreStatus.message}`,
        step: "core_functions",
      };
    }

    // Set up email sorter
    let sorterStatus = setupEmailSorter();
    Logger.log(`Email sorter setup: ${sorterStatus}`);

    // Set up email categorization trigger (scheduled task)
    let triggerStatus = setupEmailCategorizationTrigger();
    Logger.log(`Trigger setup: ${triggerStatus}`);

    // Initialize retention manager
    try {
      initializeRetentionManager();
      Logger.log("Initialized retention manager");
      
      // Setup retention trigger (daily at 3 AM)
      let retentionTriggerStatus = setupRetentionTrigger("daily", "03:00");
      Logger.log(`Retention trigger setup: ${JSON.stringify(retentionTriggerStatus)}`);
    } catch (retentionError) {
      Logger.log(`Warning: Could not set up retention manager: ${retentionError}`);
    }

    // Verify API key exists
    const apiKey =
      PropertiesService.getScriptProperties().getProperty("API_KEY");
    if (!apiKey) {
      return {
        success: false,
        message:
          "API key not found. Please set the API key using setApiKey(key).",
        step: "api_key",
      };
    }

    // Return success
    return {
      success: true,
      message: "Gmail automation system initialized successfully",
      apiStatus: apiKey ? "API key is set" : "API key is missing",
      categoriesStatus: coreStatus.categoriesCount + " categories configured",
      triggerStatus: triggerStatus,
    };
  } catch (error) {
    Logger.log(`Error in initializeEmailAutomation: ${error}`);
    return {
      success: false,
      message: `Initialization error: ${error.message || error}`,
      step: "unknown",
    };
  }
}

/**
 * Set the Gemini API key
 *
 * @param {string} key - The API key to store
 * @returns {Object} Result of setting the key
 */
function setApiKey(key) {
  try {
    if (!key || key.trim() === "") {
      return {
        success: false,
        message: "API key cannot be empty",
      };
    }

    PropertiesService.getScriptProperties().setProperty("API_KEY", key);
    Logger.log("API key set successfully");

    return {
      success: true,
      message: "API key set successfully",
    };
  } catch (error) {
    Logger.log(`Error setting API key: ${error}`);
    return {
      success: false,
      message: `Error: ${error.message || error}`,
    };
  }
}

/**
 * Test core functions to ensure they're working
 *
 * @returns {Object} Test results
 */
function testCoreFunctions() {
  try {
    // Test loadCategories function
    if (typeof loadCategories !== "function") {
      return {
        success: false,
        message: "loadCategories function is not defined",
      };
    }

    const categories = loadCategories();
    if (!categories || typeof categories !== "object") {
      return {
        success: false,
        message: "loadCategories did not return valid categories",
        categoriesResult: categories,
      };
    }

    // Test saveCategories function
    if (typeof saveCategories !== "function") {
      return {
        success: false,
        message: "saveCategories function is not defined",
      };
    }

    const savedResult = saveCategories(categories);
    if (savedResult !== true) {
      return {
        success: false,
        message: "saveCategories failed to save categories",
        saveResult: savedResult,
      };
    }

    // Test loadCache function
    if (typeof loadCache !== "function") {
      return {
        success: false,
        message: "loadCache function is not defined",
      };
    }

    const cache = loadCache();
    if (!cache || typeof cache !== "object") {
      return {
        success: false,
        message: "loadCache did not return valid cache",
        cacheResult: cache,
      };
    }

    // Test saveCache function
    if (typeof saveCache !== "function") {
      return {
        success: false,
        message: "saveCache function is not defined",
      };
    }

    const savedCacheResult = saveCache(cache);
    if (savedCacheResult !== true) {
      return {
        success: false,
        message: "saveCache failed to save cache",
        saveCacheResult: savedCacheResult,
      };
    }

    // All tests passed
    return {
      success: true,
      message: "All core functions are working correctly",
      categoriesCount: Object.keys(categories).length,
      cacheCount: Object.keys(cache).length,
    };
  } catch (error) {
    Logger.log(`Error testing core functions: ${error}`);
    return {
      success: false,
      message: `Test error: ${error.message || error}`,
    };
  }
}

/**
 * Test the retention manager functionality
 * 
 * @returns {Object} Status of the retention manager components
 */
function testRetentionManager() {
  try {
    const results = {
      initializeRetentionManager: false,
      getRetentionRules: false,
      setupRetentionTrigger: false,
      triggers: [],
      retentionRulesCount: 0
    };
    
    // Test initialization
    try {
      const initResult = initializeRetentionManager();
      results.initializeRetentionManager = initResult.success;
    } catch (error) {
      Logger.log(`Error testing initializeRetentionManager: ${error}`);
      results.initializeRetentionManagerError = error.toString();
    }
    
    // Test get rules
    try {
      const rulesResult = getRetentionRules();
      results.getRetentionRules = rulesResult.success;
      results.retentionRulesCount = rulesResult.rules ? rulesResult.rules.length : 0;
    } catch (error) {
      Logger.log(`Error testing getRetentionRules: ${error}`);
      results.getRetentionRulesError = error.toString();
    }
    
    // Test trigger setup
    try {
      const triggerResult = setupRetentionTrigger('daily', '03:00');
      results.setupRetentionTrigger = triggerResult.success;
    } catch (error) {
      Logger.log(`Error testing setupRetentionTrigger: ${error}`);
      results.setupRetentionTriggerError = error.toString();
    }
    
    // Check for existing triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === 'runAllRetentionRules') {
        results.triggers.push({
          id: trigger.getUniqueId(),
          type: trigger.getEventType(),
          handler: trigger.getHandlerFunction()
        });
      }
    }
    
    return {
      success: true,
      message: "Retention manager test completed",
      results: results
    };
  } catch (error) {
    Logger.log(`Error in testRetentionManager: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`
    };
  }
}

