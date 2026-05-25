/**
 * Email Retention Manager
 *
 * A configurable system for automatically deleting old emails based on Gmail labels
 * and user-defined retention periods.
 */

// RETENTION_RULES is declared centrally in src/core/config.js to eliminate
// dangerous load-order dependencies (ARCH-BLOCK-01).

/**
 * Initialize the retention manager by loading saved rules
 */
function initializeRetentionManager() {
  try {
    // Load saved rules from properties
    const savedRules = PropertiesService.getScriptProperties().getProperty(
      "EMAIL_RETENTION_RULES"
    );

    if (savedRules) {
      RETENTION_RULES = JSON.parse(savedRules);
      Logger.log(`Loaded ${RETENTION_RULES.length} retention rules`);
    } else {
      Logger.log(
        "No saved retention rules found. Creating default configuration."
      );
      // Set up default rules if none exist
      setupDefaultRetentionRules();
    }

    return {
      success: true,
      message: `Retention manager initialized with ${RETENTION_RULES.length} rules`,
      rules: RETENTION_RULES,
    };
  } catch (error) {
    Logger.log(`Error initializing retention manager: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}


/**
 * Get a single retention rule by ID
 *
 * @param {string} ruleId - ID of the rule to get
 * @returns {Object} The rule or null if not found
 */
function getRetentionRule(ruleId) {
  try {
    // Get all retention rules
    const result = getRetentionRules();
    if (!result.success) {
      return null;
    }

    // Find the rule by ID
    return result.rules.find((rule) => rule.id === ruleId) || null;
  } catch (error) {
    Logger.log(`Error getting retention rule ${ruleId}: ${error}`);
    return null;
  }
}

/**
 * Add a new retention rule
 *
 * @param {string} labelName - The name of the Gmail label to target
 * @param {number} retentionDays - Number of days to keep emails before deletion
 * @param {string} description - Optional description of the rule
 * @param {boolean} enabled - Whether the rule is initially enabled
 * @param {string} action - Action to take after retention period (delete or archive)
 * @param {string} targetLabel - Target label for archive action
 *
 * @returns {Object} Result of the operation
 */
function addRetentionRule(
  labelName,
  retentionDays,
  description = "",
  enabled = true,
  action = "delete",
  targetLabel = ""
) {
  try {
    // Validate inputs
    if (!labelName) {
      throw new Error("Label name is required");
    }

    retentionDays = parseInt(retentionDays);
    if (isNaN(retentionDays) || retentionDays <= 0) {
      throw new Error("Retention days must be a positive number");
    }

    // Check if the label exists
    let labelExists = false;
    try {
      const label = GmailApp.getUserLabelByName(labelName);
      labelExists = !!label;
    } catch (e) {
      labelExists = false;
    }

    if (!labelExists) {
      return {
        success: false,
        message: `Label "${labelName}" not found. Please create this label first.`,
      };
    }

    // Check if this label already has a rule
    const existingRule = RETENTION_RULES.find(
      (rule) => rule.labelName === labelName
    );
    if (existingRule) {
      return {
        success: false,
        message: `A rule already exists for label "${labelName}"`,
        existingRule: existingRule,
      };
    }

    // Create new rule
    const newRule = {
      id: generateRuleId(),
      labelName: labelName,
      retentionDays: retentionDays,
      action: action,
      targetLabel: targetLabel,
      enabled: !!enabled,
      description:
        description ||
        `Auto-delete emails with label "${labelName}" after ${retentionDays} days`,
      lastRun: null,
      nextRun: null,
    };

    // Add to rules array
    RETENTION_RULES.push(newRule);

    // Save updated rules
    saveRetentionRules();

    return {
      success: true,
      message: `Created new retention rule for "${labelName}" (${retentionDays} days)`,
      rule: newRule,
    };
  } catch (error) {
    Logger.log(`Error adding retention rule: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Update or create a retention rule for a label
 *
 * @param {string} labelName - The name of the label
 * @param {number} retentionDays - Number of days to keep emails
 * @param {string} action - Action to take (delete or archive)
 * @param {string} targetLabel - Target label for archive action (optional)
 * @returns {Object} Result with success status
 */
function updateRetentionRule(labelName, retentionDays, action, targetLabel) {
  try {
    // Initialize if needed
    if (!RETENTION_RULES) {
      initializeRetentionManager();
    }
    
    // Validate inputs
    if (!labelName) {
      return {
        success: false,
        message: "Label name is required"
      };
    }
    
    retentionDays = parseInt(retentionDays);
    if (isNaN(retentionDays) || retentionDays <= 0) {
      return {
        success: false,
        message: "Retention days must be a positive number"
      };
    }
    
    // Find the rule for this label
    const existingRuleIndex = RETENTION_RULES.findIndex(
      (rule) => rule.labelName === labelName
    );
    
    // Prepare the updates
    const updates = {
      retentionDays: retentionDays,
      action: action || "delete"
    };
    
    // Only include targetLabel for archive action
    if (action === "archive" && targetLabel) {
      updates.targetLabel = targetLabel;
    }
    
    if (existingRuleIndex >= 0) {
      // Update existing rule
      const rule = RETENTION_RULES[existingRuleIndex];
      Object.assign(rule, updates);
      
      // Save updated rules
      saveRetentionRules();
      
      return {
        success: true,
        message: `Updated retention rule for "${labelName}"`,
        rule: rule
      };
    } else {
      // Create new rule
      return addRetentionRule(
        labelName,
        retentionDays,
        `Retention rule for ${labelName}`,
        true,
        action,
        targetLabel
      );
    }
  } catch (error) {
    Logger.log(`Error updating retention rule for ${labelName}: ${error}`);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * Delete a retention rule by label name
 * 
 * @param {string} labelName - Name of the label 
 * @returns {Object} Result of the operation
 */
function deleteRetentionRuleByLabel(labelName) {
  try {
    // Initialize if needed
    if (!RETENTION_RULES) {
      initializeRetentionManager();
    }
    
    // Find the rule index
    const ruleIndex = RETENTION_RULES.findIndex(rule => rule.labelName === labelName);
    
    if (ruleIndex === -1) {
      return {
        success: false,
        message: `No retention rule found for label "${labelName}"`
      };
    }
    
    // Get the rule before we delete it
    const deletedRule = RETENTION_RULES[ruleIndex];
    
    // Remove the rule
    RETENTION_RULES.splice(ruleIndex, 1);
    
    // Save changes
    saveRetentionRules();
    
    return {
      success: true,
      message: `Deleted retention rule for label "${labelName}"`,
      rule: deletedRule
    };
  } catch (error) {
    Logger.log(`Error deleting retention rule for label ${labelName}: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`
    };
  }
}

/**
 * Enable or disable a retention rule
 *
 * @param {string} ruleId - ID of the rule to update
 * @param {boolean} enabled - Whether to enable (true) or disable (false) the rule
 * @returns {Object} Result of the operation
 */
function setRuleEnabled(ruleId, enabled) {
  try {
    // Initialize if needed
    if (!RETENTION_RULES) {
      initializeRetentionManager();
    }
    
    // Find the rule index
    const ruleIndex = RETENTION_RULES.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex === -1) {
      return {
        success: false,
        message: `Rule with ID "${ruleId}" not found`
      };
    }
    
    // Update the enabled state
    RETENTION_RULES[ruleIndex].enabled = !!enabled;
    
    // Save changes
    saveRetentionRules();
    
    return {
      success: true,
      message: `Rule for "${RETENTION_RULES[ruleIndex].labelName}" is now ${enabled ? "enabled" : "disabled"}`,
      rule: RETENTION_RULES[ruleIndex]
    };
  } catch (error) {
    Logger.log(`Error setting rule enabled state: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`
    };
  }
}

/**
 * Save retention rules to storage
 * 
 * @returns {boolean} Success status
 */
function saveRetentionRules() {
  try {
    // Ensure we have an initialized array
    if (!RETENTION_RULES) {
      RETENTION_RULES = [];
    }
    
    // Save to script properties
    PropertiesService.getScriptProperties().setProperty(
      "EMAIL_RETENTION_RULES",
      JSON.stringify(RETENTION_RULES)
    );
    
    // Also save to unified cache for consistency
    UnifiedCacheService.retentionRules.update(RETENTION_RULES);
    
    Logger.log(`Saved ${RETENTION_RULES.length} retention rules`);
    return true;
  } catch (error) {
    Logger.log(`Error saving retention rules: ${error}`);
    return false;
  }
}

/**
 * Get all retention rules
 *
 * @returns {Object} Result with success flag and rules array
 */
function getRetentionRules() {
  try {
    // Initialize if needed
    if (RETENTION_RULES === null) {
      initializeRetentionManager();
    }

    // Return the rules array
    return {
      success: true,
      rules: RETENTION_RULES || [],
      count: RETENTION_RULES ? RETENTION_RULES.length : 0,
    };
  } catch (error) {
    Logger.log(`Error getting retention rules: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
      rules: [],
      count: 0,
    };
  }
}

/**
 * Run a specific retention rule by ID
 *
 * @param {string} ruleId - ID of the rule to run
 * @returns {Object} Results of the operation
 */
function runRetentionRule(ruleId) {
  try {
    // Initialize if not already done
    if (!RETENTION_RULES || RETENTION_RULES.length === 0) {
      initializeRetentionManager();
    }

    // Find the rule
    const rule = RETENTION_RULES.find((r) => r.id === ruleId);

    if (!rule) {
      return {
        success: false,
        message: `Rule with ID "${ruleId}" not found`,
      };
    }

    // Process the rule
    return processRetentionRule(rule);
  } catch (error) {
    Logger.log(`Error running retention rule: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Process a single retention rule
 *
 * @param {Object} rule - Retention rule object
 * @returns {Object} Results of the operation
 */
function processRetentionRule(rule) {
  try {
    Logger.log(`Processing retention rule for "${rule.labelName}"...`);
    
    // Skip disabled rules
    if (!rule.enabled) {
      Logger.log(`Rule for "${rule.labelName}" is disabled, skipping`);
      return {
        success: true,
        skipped: true,
        reason: "Rule is disabled",
        labelName: rule.labelName,
        ruleId: rule.id,
        affectedCount: 0
      };
    }
    
    // Get the Gmail label
    const label = GmailApp.getUserLabelByName(rule.labelName);
    
    if (!label) {
      Logger.log(`Label "${rule.labelName}" not found, skipping rule`);
      return {
        success: false,
        skipped: true,
        reason: "Label not found",
        labelName: rule.labelName,
        ruleId: rule.id,
        affectedCount: 0
      };
    }
    
    // Calculate the cutoff date based on retention days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - rule.retentionDays);
    
    // Create a search query for emails older than cutoff date
    const query = `label:${rule.labelName} before:${formatDateForQuery(cutoffDate)}`;
    Logger.log(`Searching for emails with query: ${query}`);
    
    // Get all threads matching the query
    const threads = GmailApp.search(query, 0, 500);  // Limit to 500 threads at a time
    
    if (threads.length === 0) {
      Logger.log(`No emails found for "${rule.labelName}" older than ${rule.retentionDays} days`);
      
      // Update last run time
      rule.lastRun = new Date().toISOString();
      saveRetentionRules();
      
      return {
        success: true,
        message: `No emails found older than ${rule.retentionDays} days`,
        labelName: rule.labelName,
        ruleId: rule.id,
        affectedCount: 0
      };
    }
    
    Logger.log(`Found ${threads.length} threads for "${rule.labelName}" older than ${rule.retentionDays} days`);
    
    // Process threads based on action
    let affectedCount = 0;
    
    for (const thread of threads) {
      try {
        switch (rule.action) {
          case "delete":
            // Delete the thread
            thread.moveToTrash();
            Logger.log(`Deleted thread: ${thread.getFirstMessageSubject()}`);
            affectedCount++;
            break;
            
          case "archive":
            // If target label is specified, add it
            if (rule.targetLabel) {
              const targetLabel = GmailApp.getUserLabelByName(rule.targetLabel);
              if (targetLabel) {
                thread.addLabel(targetLabel);
                Logger.log(`Added label "${rule.targetLabel}" to thread: ${thread.getFirstMessageSubject()}`);
              }
            }
            
            // Remove current label
            thread.removeLabel(label);
            Logger.log(`Removed label "${rule.labelName}" from thread: ${thread.getFirstMessageSubject()}`);
            affectedCount++;
            break;
            
          default:
            Logger.log(`Unknown action "${rule.action}" for rule: ${rule.id}`);
            break;
        }
      } catch (threadError) {
        Logger.log(`Error processing thread: ${threadError}`);
        // Continue with next thread
      }
    }
    
    // Update last run time
    rule.lastRun = new Date().toISOString();
    saveRetentionRules();
    
    Logger.log(`Processed ${affectedCount} threads for "${rule.labelName}"`);
    
    return {
      success: true,
      message: `Processed ${affectedCount} emails for "${rule.labelName}"`,
      labelName: rule.labelName,
      ruleId: rule.id,
      affectedCount: affectedCount
    };
    
  } catch (error) {
    Logger.log(`Error processing retention rule: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
      labelName: rule.labelName,
      ruleId: rule.id,
      affectedCount: 0
    };
  }
}

/**
 * Format date for Gmail query
 *
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string (YYYY/MM/DD)
 */
function formatDateForQuery(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}/${month}/${day}`;
}

/**
 * Run all retention rules
 *
 * @returns {Object} Result of running all rules
 */
function runAllRetentionRules() {
  try {
    // Initialize if needed
    if (!RETENTION_RULES) {
      initializeRetentionManager();
    }
    
    Logger.log(`Starting to run ${RETENTION_RULES.length} retention rules...`);
    
    // Process each rule
    const results = [];
    let totalAffected = 0;
    let processedRules = 0;
    
    for (const rule of RETENTION_RULES) {
      try {
        const result = processRetentionRule(rule);
        results.push(result);
        
        if (!result.skipped) {
          processedRules++;
          totalAffected += result.affectedCount || 0;
        }
        
        // Brief pause between rules to avoid hitting quotas
        Utilities.sleep(100);
      } catch (ruleError) {
        Logger.log(`Error processing rule ${rule.id}: ${ruleError}`);
        results.push({
          success: false,
          message: `Error: ${ruleError.toString()}`,
          labelName: rule.labelName,
          ruleId: rule.id,
          affectedCount: 0
        });
      }
    }
    
    // Record the execution in script properties
    PropertiesService.getScriptProperties().setProperty(
      "LAST_RUN_runAllRetentionRules",
      new Date().toISOString()
    );
    
    Logger.log(`Completed running retention rules. Affected ${totalAffected} emails.`);
    
    return {
      success: true,
      message: `Processed ${processedRules} rules affecting ${totalAffected} emails`,
      processedRules: processedRules,
      totalProcessed: RETENTION_RULES.length,
      totalAffected: totalAffected,
      ruleResults: results
    };
  } catch (error) {
    Logger.log(`Error running all retention rules: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
      processedRules: 0,
      totalProcessed: 0,
      totalAffected: 0,
      ruleResults: []
    };
  }
}

/**
 * UI wrapper for runAllRetentionRules - provides a user-friendly response
 *
 * @returns {string} A user-friendly result message
 */
function runAllRetentionRulesFromUI() {
  try {
    // Show a loading message
    const startTime = new Date();

    // Execute the rules
    const results = runAllRetentionRules();

    // Calculate duration
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // in seconds

    // Log this activity
    logRetentionActivity(
      `Manually ran all retention rules: ${results.totalAffected} emails affected`
    );

    // Format results for UI
    if (!results.success) {
      return {
        success: false,
        message: `Error: ${results.message}`,
      };
    }

    let message = `✅ Email retention cleanup complete:\n\n`;
    message += `• Processed: ${results.processedRules} rules\n`;
    message += `• Affected: ${results.totalAffected} emails\n`;

    if (results.ruleResults && results.ruleResults.length > 0) {
      message += `\nRule details:\n`;

      for (const result of results.ruleResults) {
        if (result.skipped) {
          message += `• "${result.labelName}": Skipped (${result.reason})\n`;
        } else if (!result.success) {
          message += `• "${result.labelName}": Failed (${result.message})\n`;
        } else if (result.affectedCount > 0) {
          message += `• "${result.labelName}": Processed ${result.affectedCount} emails\n`;
        } else {
          message += `• "${result.labelName}": No emails to process\n`;
        }
      }
    }

    message += `\nOperation completed in ${duration.toFixed(1)} seconds.`;

    return {
      success: true,
      message: message,
      duration: duration.toFixed(1),
      results: results,
    };
  } catch (error) {
    logRetentionActivity(`Error running retention rules: ${error.toString()}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * UI wrapper for running a single retention rule by label name
 *
 * @param {string} labelName - Name of the label to run the rule for
 * @returns {string} A user-friendly result message
 */
function runRetentionRuleByLabel(labelName) {
  try {
    if (!labelName) {
      return {
        success: false,
        message: "Error: Label name is required",
      };
    }

    // Show a loading message
    const startTime = new Date();

    // Find the rule details
    const rule = RETENTION_RULES.find((r) => r.labelName === labelName);
    if (!rule) {
      return {
        success: false,
        message: `Error: Retention rule for label "${labelName}" not found`,
      };
    }

    // Execute the rule
    const result = processRetentionRule(rule);

    // Calculate duration
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // in seconds

    // Log this activity
    logRetentionActivity(
      `Manually ran retention rule for "${labelName}": ${
        result.affectedCount || 0
      } emails affected`,
      rule.id
    );

    // Format result for UI
    if (!result.success) {
      return {
        success: false,
        message: `Error processing rule for "${labelName}": ${result.message}`,
      };
    }

    let message = `✅ Email retention cleanup for "${labelName}" complete:\n\n`;

    if (result.affectedCount > 0) {
      message += `• Processed: ${result.affectedCount} emails\n`;
    } else {
      message += `• No emails found older than ${rule.retentionDays} days\n`;
    }

    message += `\nOperation completed in ${duration.toFixed(1)} seconds.`;

    return {
      success: true,
      message: message,
      duration: duration.toFixed(1),
      result: result,
    };
  } catch (error) {
    logRetentionActivity(`Error running retention rule: ${error.toString()}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * UI wrapper for running a single retention rule by ID
 *
 * @param {string} ruleId - ID of the rule to run
 * @returns {string} A user-friendly result message
 */
function runRetentionRuleFromUI(ruleId) {
  try {
    if (!ruleId) {
      return {
        success: false,
        message: "Error: Rule ID is required",
      };
    }

    // Show a loading message
    const startTime = new Date();

    // Find the rule details
    const rule = RETENTION_RULES.find((r) => r.id === ruleId);
    if (!rule) {
      return {
        success: false,
        message: `Error: Rule with ID "${ruleId}" not found`,
      };
    }

    // Execute the rule
    const result = runRetentionRule(ruleId);

    // Calculate duration
    const endTime = new Date();
    const duration = (endTime - startTime) / 1000; // in seconds

    // Log this activity
    logRetentionActivity(
      `Manually ran retention rule for "${rule.labelName}": ${
        result.affectedCount || 0
      } emails affected`,
      ruleId
    );

    // Format result for UI
    if (!result.success) {
      return {
        success: false,
        message: `Error processing rule for "${rule.labelName}": ${result.message}`,
      };
    }

    let message = `✅ Email retention cleanup for "${rule.labelName}" complete:\n\n`;

    if (result.affectedCount > 0) {
      message += `• Processed: ${result.affectedCount} emails\n`;
    } else {
      message += `• No emails found older than ${rule.retentionDays} days\n`;
    }

    message += `\nOperation completed in ${duration.toFixed(1)} seconds.`;

    return {
      success: true,
      message: message,
      duration: duration.toFixed(1),
      result: result,
    };
  } catch (error) {
    logRetentionActivity(`Error running retention rule: ${error.toString()}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Get retention rules for specified labels
 *
 * @param {string[]} labelNames - Array of label names
 * @returns {Object[]} Array of retention rules
 */
function getRetentionForLabels(labelNames) {
  try {
    // Get all retention rules
    const result = getRetentionRules();
    if (!result.success) {
      return [];
    }

    const rules = result.rules;

    // Filter rules for the specified labels
    return rules.filter((rule) => labelNames.includes(rule.labelName));
  } catch (error) {
    Logger.log(`Error getting retention for labels: ${error}`);
    return [];
  }
}

/**
 * Get all Gmail labels for UI display
 *
 * @returns {Object[]} Array of label objects with name, path and count
 */
function getAllGmailLabels() {
  try {
    // Use the Gmail Service instead of getGmailLabels to avoid dependency
    const gmailLabels = GmailService.labels.getAllLabels();

    const labelInfo = [];

    for (const label of gmailLabels) {
      // Skip system labels if needed
      if (label.type === 'system') {
        continue;
      }

      // Don't make API calls to count threads
      const labelObj = {
        name: label.name,
        path: label.name.includes("/") ? label.name.split("/") : [label.name],
        count: "?", // Don't count threads to avoid API calls
      };

      labelInfo.push(labelObj);
    }

    // Sort by name
    labelInfo.sort((a, b) => a.name.localeCompare(b.name));

    return {
      success: true,
      labels: labelInfo,
    };
  } catch (error) {
    Logger.log(`Error getting Gmail labels: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
      labels: [],
    };
  }
}

/**
 * Set up a scheduled trigger for retention rules
 *
 * @param {string} frequency - How often to run ("daily" or "weekly")
 * @param {string} time - Time of day to run (24-hour format "HH:MM")
 * @returns {Object} Result with success status
 */
function setupRetentionTrigger(frequency, time = "03:00") {
  try {
    Logger.log(`Setting up retention trigger: frequency=${frequency}, time=${time}`);
    
    // Delete any existing retention triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === "runAllRetentionRules") {
        ScriptApp.deleteTrigger(trigger);
        Logger.log("Deleted existing retention trigger");
      }
    }
    
    // Parse the time
    const [hours, minutes] = time.split(":").map(part => parseInt(part, 10));
    
    // Create a new trigger based on the frequency
    let newTrigger;
    
    if (frequency === "daily") {
      newTrigger = ScriptApp.newTrigger("runAllRetentionRules")
        .timeBased()
        .atHour(hours)
        .nearMinute(minutes)
        .everyDays(1)
        .create();
      
      Logger.log(`Created daily retention trigger at ${hours}:${minutes}`);
    } 
    else if (frequency === "weekly") {
      // Run weekly on Sundays
      newTrigger = ScriptApp.newTrigger("runAllRetentionRules")
        .timeBased()
        .onWeekDay(ScriptApp.WeekDay.SUNDAY)
        .atHour(hours)
        .nearMinute(minutes)
        .create();
      
      Logger.log(`Created weekly retention trigger (Sundays at ${hours}:${minutes})`);
    }
    else {
      // Default to daily at 3 AM if frequency is not recognized
      newTrigger = ScriptApp.newTrigger("runAllRetentionRules")
        .timeBased()
        .atHour(3)
        .nearMinute(0)
        .everyDays(1)
        .create();
      
      Logger.log("Created default daily retention trigger at 03:00");
    }
    
    return {
      success: true,
      message: `Retention trigger set to run ${frequency} at ${time}`,
      trigger: newTrigger ? newTrigger.getUniqueId() : null
    };
  } catch (error) {
    Logger.log(`Error setting up retention trigger: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`
    };
  }
}

/**
 * Setup default retention rules if none exist
 * 
 * @returns {boolean} Success status
 */
function setupDefaultRetentionRules() {
  try {
    // Only proceed if RETENTION_RULES is empty
    if (RETENTION_RULES && RETENTION_RULES.length > 0) {
      Logger.log("Retention rules already exist, skipping default setup");
      return true;
    }
    
    // Create an empty array if needed
    if (!RETENTION_RULES) {
      RETENTION_RULES = [];
    }
    
    // Sample rule for newsletters (only if the label exists)
    try {
      const newsletterLabel = GmailApp.getUserLabelByName("Newsletters");
      if (newsletterLabel) {
        addRetentionRule(
          "Newsletters",
          30,
          "Auto-delete newsletters after 30 days",
          true,
          "delete"
        );
      }
    } catch (e) {
      // Label doesn't exist, skip
      Logger.log("Newsletters label not found, skipping default rule");
    }
    
    // Sample rule for promotions (only if the label exists)
    try {
      const promotionsLabel = GmailApp.getUserLabelByName("Promotions");
      if (promotionsLabel) {
        addRetentionRule(
          "Promotions",
          45,
          "Auto-delete promotions after 45 days",
          true,
          "delete"
        );
      }
    } catch (e) {
      // Label doesn't exist, skip
      Logger.log("Promotions label not found, skipping default rule");
    }
    
    // Save the rules
    saveRetentionRules();
    
    Logger.log(`Created ${RETENTION_RULES.length} default retention rules`);
    return true;
  } catch (error) {
    Logger.log(`Error setting up default retention rules: ${error}`);
    return false;
  }
}

/**
 * Log a retention activity
 *
 * @param {string} message - The log message
 * @param {string} ruleId - ID of the rule (optional)
 * @returns {boolean} True if successful
 */
function logRetentionActivity(message, ruleId = null) {
  try {
    // Get existing log
    const logJson = PropertiesService.getScriptProperties().getProperty(
      "RETENTION_ACTIVITY_LOG"
    );
    let log = logJson ? JSON.parse(logJson) : [];

    // Add new entry
    log.push({
      timestamp: new Date().toISOString(),
      message: message,
      ruleId: ruleId,
    });

    // Keep only last 50 entries to stay well under the 500KB total limit.
    // TODO: Consider migrating to Drive-based logging (e.g. append to a
    // Sheets log or Drive text file) if retention history must grow beyond
    // 50 entries without loss.
    if (log.length > 50) {
      log = log.slice(-50);
    }

    const serialized = JSON.stringify(log);

    // Guard: if this single property is already > 100KB, aggressively
    // truncate oldest entries to avoid silent truncation by PropertiesService.
    if (serialized.length > 100000) {
      Logger.log(
        `WARN: RETENTION_ACTIVITY_LOG exceeded 100KB (${serialized.length} bytes). Truncating to last 10 entries.`
      );
      log = log.slice(-10);
    }

    // Save updated log
    PropertiesService.getScriptProperties().setProperty(
      "RETENTION_ACTIVITY_LOG",
      JSON.stringify(log)
    );

    return true;
  } catch (error) {
    Logger.log(`Error logging retention activity: ${error}`);
    return false;
  }
}

/**
 * Get retention activity log
 *
 * @param {number} maxEntries - Maximum number of log entries to return
 * @returns {Object[]} Array of log entries
 */
function getRetentionActivityLog(maxEntries = 50) {
  try {
    // Try to get the log from properties
    const logJson = PropertiesService.getScriptProperties().getProperty(
      "RETENTION_ACTIVITY_LOG"
    );

    if (!logJson) {
      return [];
    }

    const log = JSON.parse(logJson);

    // Sort by timestamp (newest first) and limit entries
    return log
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, maxEntries);
  } catch (error) {
    Logger.log(`Error getting retention activity log: ${error}`);
    return [];
  }
}

/**
 * Get diagnostics for the retention manager system
 * This is helpful for debugging issues with the retention manager
 * 
 * @returns {Object} Diagnostic information
 */
function getRetentionManagerDiagnostics() {
  try {
    const diagnostics = {
      retentionRulesStatus: "unknown",
      retentionRulesCount: 0,
      retentionRules: null,
      triggerStatus: "unknown",
      triggers: [],
      lastRun: null,
      storageStatus: {
        properties: false,
        cache: false
      },
      variableStatus: RETENTION_RULES ? "initialized" : "not initialized"
    };
    
    // Check RETENTION_RULES global variable
    if (RETENTION_RULES !== null && Array.isArray(RETENTION_RULES)) {
      diagnostics.retentionRulesStatus = "initialized";
      diagnostics.retentionRulesCount = RETENTION_RULES.length;
      diagnostics.retentionRules = RETENTION_RULES;
    } else {
      // Try to initialize
      try {
        initializeRetentionManager();
        if (RETENTION_RULES !== null && Array.isArray(RETENTION_RULES)) {
          diagnostics.retentionRulesStatus = "initialized via function call";
          diagnostics.retentionRulesCount = RETENTION_RULES.length;
          diagnostics.retentionRules = RETENTION_RULES;
        } else {
          diagnostics.retentionRulesStatus = "failed to initialize";
        }
      } catch (initError) {
        diagnostics.retentionRulesStatus = "error during initialization";
        diagnostics.initializationError = initError.toString();
      }
    }
    
    // Check triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === "runAllRetentionRules") {
        diagnostics.triggers.push({
          id: trigger.getUniqueId(),
          type: trigger.getEventType(),
          handler: trigger.getHandlerFunction()
        });
      }
    }
    diagnostics.triggerStatus = diagnostics.triggers.length > 0 ? "active" : "not found";
    
    // Check last run
    try {
      const lastRun = PropertiesService.getScriptProperties().getProperty("LAST_RUN_runAllRetentionRules");
      diagnostics.lastRun = lastRun;
    } catch (e) {
      diagnostics.lastRunError = e.toString();
    }
    
    // Check storage
    try {
      // Check properties
      const propRules = PropertiesService.getScriptProperties().getProperty("EMAIL_RETENTION_RULES");
      diagnostics.storageStatus.properties = propRules !== null;
      
      // Check cache
      const cacheRules = UnifiedCacheService.retentionRules.getAll();
      diagnostics.storageStatus.cache = Array.isArray(cacheRules) && cacheRules.length > 0;
    } catch (storageError) {
      diagnostics.storageError = storageError.toString();
    }
    
    return {
      success: true,
      message: "Retention manager diagnostics completed",
      diagnostics: diagnostics
    };
  } catch (error) {
    Logger.log(`Error getting retention manager diagnostics: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`
    };
  }
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeRetentionManager,
    getRetentionRule,
    addRetentionRule,
    updateRetentionRule,
    deleteRetentionRuleByLabel,
    setRuleEnabled,
    saveRetentionRules,
    getRetentionRules,
    runRetentionRule,
    processRetentionRule,
    formatDateForQuery,
    runAllRetentionRules,
    runAllRetentionRulesFromUI,
    runRetentionRuleByLabel,
    runRetentionRuleFromUI,
    getRetentionForLabels,
    getAllGmailLabels,
    setupRetentionTrigger,
    setupDefaultRetentionRules,
    logRetentionActivity,
    getRetentionActivityLog,
    getRetentionManagerDiagnostics
  };
}
