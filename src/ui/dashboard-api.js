/**
 * Dashboard API Module
 * Clean API endpoints for dashboard client-server communication
 * All functions return JSON-serializable objects for consistent API responses
 */

/**
 * Handles GET requests for the web app.
 * Serves the dashboard HTML page.
 * @param {Object} e - Event object containing request parameters
 * @returns {HtmlOutput} The dashboard HTML page
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('ui/dashboard-html/DashboardMain')
    .evaluate()
    .setTitle('Email Tools Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Include helper function for HTML templates.
 * Allows using <?!= include('filename'); ?> in HTML files.
 * @param {string} filename - The name of the HTML file to include
 * @returns {string} The content of the HTML file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile('ui/dashboard-html/' + filename).getContent();
}

/**
 * API endpoint to get all dashboard data
 * @returns {Object} Complete dashboard data
 */
function getDashboardData() {
  try {
    // Get all labels and categories
    const labelsData = getAllLabelsAndCategories();
    
    // Get system status
    const systemStatus = getSystemStatus();
    
    // Get statistics
    const stats = getDashboardStatistics();
    
    return {
      success: true,
      data: {
        labels: labelsData.labels || [],
        categories: labelsData.categories || {},
        labelCategories: labelsData.labelCategories || {},
        retentionRules: labelsData.retentionRules || [],
        systemStatus: systemStatus,
        statistics: stats
      }
    };
  } catch (error) {
    Logger.log(`Error getting dashboard data: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to update category for an email
 * @param {string} email - Email address
 * @param {string} category - Category to assign
 * @returns {Object} Update result
 */
function updateEmailCategory(email, category) {
  try {
    if (!email) {
      return {
        success: false,
        error: "Email address is required"
      };
    }
    
    const result = updateCategoryForEmail(email, category);
    
    return {
      success: result.success,
      message: result.message,
      data: {
        email: email,
        category: category
      }
    };
  } catch (error) {
    Logger.log(`Error updating email category: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to update categories for a label
 * @param {string} labelName - Label name
 * @param {Array<string>} categories - Categories to assign
 * @returns {Object} Update result
 */
function updateLabelCategories(labelName, categories) {
  try {
    if (!labelName) {
      return {
        success: false,
        error: "Label name is required"
      };
    }
    
    const result = addCategoryToLabel(labelName, categories);
    
    return {
      success: result.success,
      message: result.message,
      data: {
        label: labelName,
        categories: categories
      }
    };
  } catch (error) {
    Logger.log(`Error updating label categories: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to create a new Gmail label
 * @param {string} labelName - Name of the label to create
 * @returns {Object} Creation result
 */
function createGmailLabel(labelName) {
  try {
    if (!labelName || labelName.trim() === "") {
      return {
        success: false,
        error: "Label name cannot be empty"
      };
    }
    
    const result = createLabel(labelName);
    
    return {
      success: result.success,
      message: result.message,
      data: {
        labelName: labelName
      }
    };
  } catch (error) {
    Logger.log(`Error creating label: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to save retention rule
 * @param {Object} ruleData - Retention rule data
 * @returns {Object} Save result
 */
function saveRetentionRule(ruleData) {
  try {
    const { labelName, retentionDays, action, targetLabel } = ruleData;
    
    if (!labelName || !retentionDays || !action) {
      return {
        success: false,
        error: "Missing required fields: labelName, retentionDays, action"
      };
    }
    
    const result = updateRetentionRule(labelName, retentionDays, action, targetLabel);
    
    return {
      success: result.success,
      message: result.message,
      data: result.rule
    };
  } catch (error) {
    Logger.log(`Error saving retention rule: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to delete retention rule
 * @param {string} labelName - Label name for the rule to delete
 * @returns {Object} Deletion result
 */
function deleteRetentionRule(labelName) {
  try {
    if (!labelName) {
      return {
        success: false,
        error: "Label name is required"
      };
    }
    
    const result = deleteRetentionRuleByLabel(labelName);
    
    return {
      success: result.success,
      message: result.message,
      data: {
        labelName: labelName
      }
    };
  } catch (error) {
    Logger.log(`Error deleting retention rule: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to run retention rules
 * @returns {Object} Execution result
 */
function executeRetentionRules() {
  try {
    const result = runAllRetentionRules();
    
    return {
      success: result.success,
      message: result.message,
      data: {
        processedRules: result.processedRules,
        totalProcessed: result.totalProcessed,
        totalAffected: result.totalAffected,
        ruleResults: result.ruleResults
      }
    };
  } catch (error) {
    Logger.log(`Error executing retention rules: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to process batch changes
 * @param {Array} changes - Array of change objects
 * @returns {Object} Processing result
 */
function processBatchChanges(changes) {
  try {
    if (!Array.isArray(changes)) {
      return {
        success: false,
        error: "Changes must be an array"
      };
    }
    
    const result = processBatchedChanges(changes);
    
    return {
      success: result.success,
      message: result.message,
      data: {
        processedCount: result.processedCount,
        errorCount: result.errorCount
      }
    };
  } catch (error) {
    Logger.log(`Error processing batch changes: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to save settings
 * @param {Object} settings - Settings object
 * @returns {Object} Save result
 */
function saveApplicationSettings(settings) {
  try {
    const result = saveSettings(settings);
    
    return {
      success: result.success,
      message: result.message,
      data: settings
    };
  } catch (error) {
    Logger.log(`Error saving settings: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to get system status
 * @returns {Object} System status
 */
function getSystemStatus() {
  try {
    const apiKeyStatus = verifyGeminiApiKey();
    const triggers = ScriptApp.getProjectTriggers();
    
    // Check email sorter trigger
    const emailSorterTrigger = triggers.find(t => 
      t.getHandlerFunction() === "categorizeEmails"
    );
    
    // Check retention trigger  
    const retentionTrigger = triggers.find(t => 
      t.getHandlerFunction() === "runAllRetentionRules"
    );
    
    // Check job finder trigger
    const jobFinderTrigger = triggers.find(t => 
      t.getHandlerFunction() === "processJobEmailsMain"
    );
    
    return {
      apiKey: {
        isSet: apiKeyStatus.valid,
        status: apiKeyStatus.valid ? "HEALTHY" : "ERROR",
        message: apiKeyStatus.message
      },
      triggers: {
        emailSorter: {
          enabled: !!emailSorterTrigger,
          frequency: emailSorterTrigger ? "Every hour" : "Not scheduled"
        },
        retention: {
          enabled: !!retentionTrigger,
          frequency: retentionTrigger ? "Daily" : "Not scheduled"
        },
        jobFinder: {
          enabled: !!jobFinderTrigger,
          frequency: jobFinderTrigger ? "Every hour" : "Not scheduled"
        }
      },
      lastRun: {
        emailSorter: getLastRunTime("categorizeEmails"),
        retention: getLastRunTime("runAllRetentionRules"),
        jobFinder: getLastRunTime("processJobEmailsMain")
      }
    };
  } catch (error) {
    Logger.log(`Error getting system status: ${error}`);
    return {
      error: error.toString()
    };
  }
}

/**
 * API endpoint to get dashboard statistics
 * @returns {Object} Statistics
 */
function getDashboardStatistics() {
  try {
    const stats = {
      labels: {
        total: 0,
        withCategories: 0
      },
      emails: {
        categorized: 0,
        domains: 0
      },
      retention: {
        activeRules: 0,
        lastRun: null
      }
    };
    
    // Get label statistics
    const labels = GmailService.labels.getAllLabels();
    stats.labels.total = labels.filter(l => l.type === 'user').length;
    
    const labelCategories = UnifiedCacheService.labelCategories.getAll();
    stats.labels.withCategories = Object.keys(labelCategories).length;
    
    // Get email statistics
    const emailCategories = UnifiedCacheService.emailCategories.getAll();
    const emails = Object.keys(emailCategories);
    stats.emails.categorized = emails.length;
    
    // Count unique domains
    const domains = new Set(emails.map(email => email.split('@')[1]));
    stats.emails.domains = domains.size;
    
    // Get retention statistics
    const retentionRules = UnifiedCacheService.retentionRules.getAll();
    stats.retention.activeRules = retentionRules.filter(r => r.enabled).length;
    
    return stats;
  } catch (error) {
    Logger.log(`Error getting dashboard statistics: ${error}`);
    return {};
  }
}

/**
 * Helper function to get last run time for a function
 * @param {string} functionName - Function name
 * @returns {string} Last run time or "Never"
 */
function getLastRunTime(functionName) {
  try {
    const lastRun = PropertiesService.getScriptProperties().getProperty(`LAST_RUN_${functionName}`);
    if (lastRun) {
      const date = new Date(lastRun);
      return Utilities.formatDate(date, Session.getScriptTimeZone(), "MMM dd, HH:mm");
    }
    return "Never";
  } catch (error) {
    return "Unknown";
  }
}

/**
 * API endpoint to test email categorization
 * @param {string} emailText - Sample email text
 * @returns {Object} Categorization result
 */
function testEmailCategorization(emailText) {
  try {
    if (!emailText) {
      return {
        success: false,
        error: "Email text is required"
      };
    }
    
    // Call the Gemini API to categorize
    const prompt = `Analyze this email and suggest appropriate categories. Return a JSON array of category names.
    
Email: ${emailText}`;
    
    const result = callGeminiApi(prompt, "test_categorization");
    
    if (result.success) {
      return {
        success: true,
        categories: result.categories || [],
        rawResponse: result.response
      };
    } else {
      return {
        success: false,
        error: result.error
      };
    }
  } catch (error) {
    Logger.log(`Error testing categorization: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * API endpoint to get email threads from a label
 * @param {string} labelName - Label name
 * @param {number} maxThreads - Maximum threads to return
 * @returns {Object} Threads data
 */
function getEmailThreads(labelName, maxThreads = 50) {
  try {
    if (!labelName) {
      return {
        success: false,
        error: "Label name is required"
      };
    }
    
    const threads = GmailService.threads.getThreadsFromLabel(labelName, 0, maxThreads);
    const threadData = threads.map(thread => GmailService.threads.getThreadMetadata(thread));
    
    return {
      success: true,
      data: {
        labelName: labelName,
        threadCount: threadData.length,
        threads: threadData
      }
    };
  } catch (error) {
    Logger.log(`Error getting email threads: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Export the Dashboard API for easy access
 */
const DashboardAPI = {
  // Data retrieval
  getDashboardData,
  getSystemStatus,
  getDashboardStatistics,
  getEmailThreads,
  
  // Category management
  updateEmailCategory,
  updateLabelCategories,
  testEmailCategorization,
  
  // Label management
  createGmailLabel,
  
  // Retention rules
  saveRetentionRule,
  deleteRetentionRule,
  executeRetentionRules,
  
  // Settings
  saveApplicationSettings,
  
  // Batch operations
  processBatchChanges
};

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getDashboardData,
    updateEmailCategory,
    updateLabelCategories,
    createGmailLabel,
    saveRetentionRule,
    deleteRetentionRule,
    executeRetentionRules,
    processBatchChanges,
    saveApplicationSettings,
    getSystemStatus,
    getDashboardStatistics,
    getLastRunTime,
    testEmailCategorization,
    getEmailThreads,
    DashboardAPI
  };
}
