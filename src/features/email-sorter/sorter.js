/**
 * Email Sorter
 * Platform access (Gmail, Properties) is routed exclusively through
 * src/core/services ports via the serviceFactory (hexagonal-ports-refactor).
 */

/** Resolve the shared serviceFactory singleton (global in Apps Script, required in Node). */
function _esServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  /* istanbul ignore else -- in Node `require` is always defined; the else (defensive throw) is unreachable in both Node and GAS. */
  if (typeof require !== 'undefined') {
    return require('../../core/services/index.js').serviceFactory;
  } else {
    throw new Error('serviceFactory is not available');
  }
}

function _esGmail() {
  return _esServiceFactory().getGmailAdapter();
}

function _esProps() {
  return _esServiceFactory().getPropertiesAdapter();
}

/**
 * Call the Gemini API to determine a category for an email
 *
 * @param {string} emailAddress - The sender's email address
 * @param {string} domain - The sender's email domain
 * @param {string} subject - The email subject
 * @returns {Object|null} Category information or null if rate limited
 */
function queryGeminiForCategory(emailAddress, domain, subject) {
  try {
    // Build prompt for Gemini
    const prompt = buildGeminiPrompt(emailAddress, domain, subject);
    const response = callGeminiWithRateLimiting(prompt, 'email_categorization');

    // Extract a proper JSON response
    const category = extractCategoryFromResponse(response);

    // If we got a valid category, return it
    /* istanbul ignore else -- extractCategoryFromResponse never returns a falsy value (it returns "other" as its floor), so the else/default-fallback below is defensive and unreachable. */
    if (category) {
      return {
        category: category,
        explanation: "Category determined by Gemini",
      };
    }

    /* istanbul ignore next -- unreachable: extractCategoryFromResponse always returns a non-empty string. */
    // Default fallback
    return {
      category: "other",
      explanation: "Could not determine a specific category",
    };
  } catch (error) {
    // Check if this is a rate limit error
    if (error.message === "RATE_LIMIT_REACHED") {
      // Return null to indicate rate limiting
      Logger.log(
        `Rate limit reached when processing email from ${emailAddress}`
      );
      return null;
    }

    Logger.log(`Error querying Gemini: ${error}`);
    return {
      category: "other",
      explanation: "Error occurred, defaulted to 'other'",
    };
  }
}

/**
 * Build the prompt for the Gemini API
 *
 * @param {string} emailAddress - The sender's email address
 * @param {string} domain - The sender's email domain
 * @param {string} subject - The email subject
 * @returns {string} The formatted prompt
 */
function buildGeminiPrompt(emailAddress, domain, subject) {
  // Get existing categories from data layer but remove "other" from the list
  const categories = getAllCategories();
  const categoryList = Object.keys(categories)
    .filter((cat) => cat !== "other")
    .join(", ");

  return `TASK: Categorize this email into EXACTLY ONE category from this list: ${categoryList}

EMAIL:
From: ${emailAddress}
Domain: ${domain}
Subject: ${subject}

RULES:
- You MUST choose exactly one category from the list provided above
- Only use "other" if absolutely nothing else fits
- Reply with ONLY a JSON object in this format: {"category":"chosen_category"}
- Do not include any explanation or additional text
- The category must be lowercase and match exactly one from the list

EXAMPLE RESPONSE:
{"category":"finance"}`;
}

/**
 * Extract category name from the Gemini API response
 *
 * @param {string} response - The raw API response
 * @returns {string} The extracted category name
 */
function extractCategoryFromResponse(response) {
  try {
    // Log the response for debugging
    Logger.log(`Raw response: ${response}`);

    // Method 1: Direct JSON parsing
    try {
      // Clean up the response first
      let cleanJson = response.trim();

      // Remove any markdown code block syntax
      if (cleanJson.includes("```")) {
        cleanJson = cleanJson.replace(/```json|```/g, "").trim();
      }

      const parsed = JSON.parse(cleanJson);
      if (parsed && parsed.category) {
        return sanitizeCategoryName(parsed.category);
      }
    } catch (e) {
      Logger.log(`JSON parse error: ${e.message}`);
    }

    // Method 2: Extract with regex - try several patterns
    const patterns = [
      /"category"\s*:\s*"([^"]+)"/i,
      /category\s*:\s*"?([a-z0-9_]+)"?/i,
      /{"category":"([^"]+)"}/i,
      /'category'\s*:\s*'([^']+)'/i,
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        return sanitizeCategoryName(match[1]);
      }
    }

    // Method 3: Look for exact category names in the response
    const allCategories = Object.keys(getAllCategories());
    for (const cat of allCategories) {
      // Look for the category name as a whole word
      const catPattern = new RegExp(`\\b${cat}\\b`, "i");
      if (catPattern.test(response)) {
        return cat;
      }
    }

    // If all methods fail, log this
    Logger.log("Failed to extract category: defaulting to 'other'");
    return "other";
  } catch (error) {
    Logger.log(`Error in extraction: ${error}`);
    return "other";
  }
}


/**
 * Helper function to clean and validate a label name.
 * Based on Gmail label naming restrictions.
 *
 * @param {string} name - The raw label name
 * @returns {string} The cleaned label name
 */
function cleanLabelName(name) {
  if (!name) return "Other";

  // Convert to string if not already
  name = String(name);

  // Trim whitespace
  let cleanName = name.trim();

  // Gmail doesn't allow labels to start/end with spaces
  // or contain certain characters like ( ) { } % * " / \
  cleanName = cleanName
    .replace(/[(){}\[\]%*"\\]/g, "") // Remove most illegal characters, keep /
    .replace(/^[. /]+|[. /]+$/g, ""); // Remove leading/trailing dots, spaces, and slashes

  // If after cleaning we have an empty string, return "Other"
  if (!cleanName) return "Other";

  // Ensure the name isn't too long (Gmail has a limit)
  if (cleanName.length > 40) {
    cleanName = cleanName.substring(0, 40);
  }

  return cleanName;
}

/**
 * Sanitize a category name to ensure it's valid and clean.
 *
 * @param {string} category - The raw category name
 * @returns {string} The sanitized category name
 */
function sanitizeCategoryName(category) {
  if (!category) return "other";

  // Convert to string and lowercase
  let cleanCategory = String(category).toLowerCase().trim();

  // Remove any special characters, keep only letters, numbers, and underscores
  cleanCategory = cleanCategory.replace(/[^a-z0-9_]/g, "_");

  // Collapse multiple consecutive underscores into a single one
  cleanCategory = cleanCategory.replace(/_+/g, "_");

  // Remove leading and trailing underscores
  cleanCategory = cleanCategory.replace(/^_+|_+$/g, "");

  // If we end up with an empty string or just underscores, return "other"
  if (!cleanCategory || cleanCategory === "_") {
    return "other";
  }

  // Keep it reasonably short (max 20 chars for category names)
  if (cleanCategory.length > 20) {
    cleanCategory = cleanCategory.substring(0, 20);

    // Make sure we don't end with an underscore
    cleanCategory = cleanCategory.replace(/_+$/g, "");
  }

  return cleanCategory;
}

/**
 * Add a file locking check to the categorizeEmails function to avoid conflicts
 */
function checkLockBeforeProcessing() {
  const scriptProperties = _esProps();
  const currentLock = scriptProperties.getProperty("EMAIL_SORTER_LOCK");

  if (currentLock) {
    // Check if the lock is recent (less than 30 seconds old)
    const lockTime = parseInt(currentLock.split("_").pop());
    const currentTime = new Date().getTime();

    if (currentTime - lockTime < 30000) {
      // Lock is still valid, someone is editing categories
      Logger.log("Category manager is active. Skipping this run.");
      return {
        lockActive: true,
        message: "Category manager is active. Operation postponed.",
      };
    }
  }

  return {
    lockActive: false,
  };
}


/**
 * Set up a time-based trigger to run the script automatically.
 *
 * @returns {string} Success message
 */
function setupEmailSorterTrigger() {
  // Delete any existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === "categorizeEmails") {
      ScriptApp.deleteTrigger(trigger);
    }
  }

  // Create a new trigger to run every minute or as configured
  ScriptApp.newTrigger("categorizeEmails")
    .timeBased()
    .everyMinutes(EMAIL_SORTER_CONFIG.CHECK_INTERVAL_MINUTES)
    .create();

  const message = `Trigger set up to run categorizeEmails every ${EMAIL_SORTER_CONFIG.CHECK_INTERVAL_MINUTES} minute(s)`;
  Logger.log(message);
  return message;
}

/**
 * Main function to categorize emails.
 * Automatically triggered to process unread emails.
 *
 * @returns {Object} Results with counts of processed and categorized emails
 */
function categorizeEmails() {
  // Check if manager is currently editing categories
  const lockCheck = checkLockBeforeProcessing();
  if (lockCheck.lockActive) {
    return {
      processedThreads: 0,
      message: "Category manager is active. Processing postponed.",
    };
  }

  try {
    // Load categories from the data layer
    const categories = getAllCategories();

    // Counter to track Gemini API calls in this execution
    let geminiCallsCount = 0;
    const maxCalls = EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE;

    // Get unread emails from inbox
    const threads = _esGmail().getInboxThreads(0, 50);

    // Track results
    const results = {
      processedThreads: 0,
      categorizedThreads: 0,
      fromAPI: 0,
      newCategories: 0,
      errors: 0,
      skippedDueToRateLimit: 0,
    };

    for (const thread of threads) {
      try {
        // Skip if thread is read
        if (!thread.isUnread()) continue;

        // Process only the latest message in the thread
        const messages = thread.getMessages();
        const latestMessage = messages[messages.length - 1];

        // Skip if message is already read
        if (!latestMessage.isUnread()) continue;

        results.processedThreads++;

        // Get sender email and subject
        const from = latestMessage.getFrom();
        const subject = latestMessage.getSubject();

        // Extract full email address and domain
        // Bugfix (full-test-coverage leg): the fallback pattern previously used
        // `[^<\\s]` (a literal backslash + 's'), which excluded the letter 's' from
        // bare addresses and truncated e.g. "plainsender@x" to "ender@x". Use `\s`
        // so it correctly means "any non-whitespace". The angle-bracket form is tried
        // first and was unaffected, which masked the bug.
        const emailMatch =
          from.match(/<([^>]+)>/) || from.match(/([^<\s]+@[^>\s]+)/);
        const emailAddress = emailMatch ? emailMatch[1] : from;
        const domain = emailAddress.split("@")[1];

        // Log the email being categorized
        Logger.log(`Categorizing email: ${emailAddress} | Subject: ${subject}`);

        // First check if the email address is already in the cache
        let category = getCategoryForEmail(emailAddress);

        // If not found for the specific email, check the domain
        if (!category && domain) {
          category = getCategoryForDomain(domain);
        }

        // If we found a category in the cache, use it
        if (category) {
          Logger.log(`Found in cache: category = ${category}`);

          // Get the folder name, handling different possible formats
          let folderName;
          if (typeof categories[category] === "string") {
            folderName = categories[category];
          } else if (
            categories[category] &&
            typeof categories[category] === "object"
          ) {
            folderName =
              categories[category].label || // Prioritize label
              categories[category].displayName || // Fallback to displayName
              category;
          } else {
            // If we can't determine the folder name, use the category itself
            folderName = category.charAt(0).toUpperCase() + category.slice(1);
          }

          Logger.log(`Using folder name: ${folderName}`);

          // Move email to appropriate folder
          const result = moveEmailToFolder(thread, folderName);
          if (result) {
            Logger.log(
              `Moved email from ${emailAddress} to ${folderName} folder based on cache`
            );
            results.categorizedThreads++;

            // Record the email processing for API monitoring
            if (
              typeof API_MONITOR !== "undefined" &&
              API_MONITOR.recordEmailProcessed
            ) {
              API_MONITOR.recordEmailProcessed(category);
            }
          } else {
            Logger.log(
              `Failed to move email from ${emailAddress} to ${folderName} folder`
            );
            results.errors++;
          }

          continue; // Skip to next email since we've handled this one
        }

        // If not in cache, use the API for categorization
        if (geminiCallsCount < maxCalls) {
          Logger.log(
            `Querying Gemini for category: ${emailAddress}, ${subject}`
          );
          try {
            const geminiResponse = queryGeminiForCategory(
              emailAddress,
              domain,
              subject
            );
            geminiCallsCount++;
            results.fromAPI++;

            // Check if we hit the rate limit
            if (geminiResponse === null) {
              // Skip this email - don't process it
              Logger.log(`Skipping email due to rate limiting: ${subject}`);
              results.skippedDueToRateLimit++;
              continue; // Skip to the next email in the loop
            }

            /* istanbul ignore else -- queryGeminiForCategory returns null (handled above) or an object that always carries a truthy `category`; the false branch is unreachable defensive code. */
            if (geminiResponse && geminiResponse.category) {
              category = geminiResponse.category;
              Logger.log(`Gemini suggested category: ${category}`);

              // Handle new category creation if enabled
              if (
                isDynamicCategoriesEnabled() &&
                !Object.keys(categories).includes(category) &&
                category !== "other"
              ) {
                // Create new category
                const folderName = createNewCategory(
                  category,
                  emailAddress,
                  domain,
                  subject
                );

                // Update the cache with this new categorization
                updateCategoryForEmail(emailAddress, category);
                if (domain) {
                  updateCategoryForDomain(domain, category);
                }

                if (folderName) {
                  results.newCategories++;
                }
              } else {
                // Update cache with the determined category
                updateCategoryForEmail(emailAddress, category);
                if (domain) {
                  updateCategoryForDomain(domain, category);
                }
              }

              // Move email to appropriate folder if category was determined
              if (category && categories[category]) {
                // Get the folder name, handling different possible formats
                let folderName;
                if (typeof categories[category] === "string") {
                  folderName = categories[category];
                } else if (
                  categories[category] &&
                  typeof categories[category] === "object"
                ) {
                  folderName =
                    categories[category].label || // Prioritize label
                    categories[category].displayName || // Fallback to displayName
                    category;
                } else {
                  // If we can't determine the folder name, use the category itself
                  folderName =
                    category.charAt(0).toUpperCase() + category.slice(1);
                }

                Logger.log(`Using folder name: ${folderName}`);

                const result = moveEmailToFolder(thread, folderName);
                if (result) {
                  Logger.log(
                    `Moved email from ${emailAddress} to ${folderName} folder`
                  );
                  results.categorizedThreads++;

                  // Record the email processing for API monitoring
                  if (
                    typeof API_MONITOR !== "undefined" &&
                    API_MONITOR.recordEmailProcessed
                  ) {
                    API_MONITOR.recordEmailProcessed(category);
                  }
                } else {
                  Logger.log(
                    `Failed to move email from ${emailAddress} to ${folderName} folder`
                  );
                  results.errors++;
                }
              }
            }
          } catch (aiError) {
            Logger.log(`Error querying Gemini: ${aiError}`);
            // Continue with other emails
          }
        } else {
          // We've already hit our maximum allowed calls
          Logger.log(`Maximum API calls reached, skipping email: ${subject}`);
          results.skippedDueToRateLimit++;
          continue; // Skip to the next email
        }
      } catch (threadError) {
        // Log the error but continue processing other threads
        Logger.log(`Error processing thread: ${threadError}`);
        results.errors++;
        continue;
      }
    }

    return results;
  } catch (error) {
    Logger.log(`Error in categorizeEmails: ${error}`);
    throw error;
  }
}

/**
 * Move an email thread to a specific Gmail folder (label).
 *
 * @param {GmailThread} thread - The thread to move
 * @param {string} folderName - The destination folder name
 * @returns {boolean} True if successful, false otherwise
 */
function moveEmailToFolder(thread, folderName) {
  // Validate folderName - ensure it's a string and not empty or invalid
  if (!folderName || typeof folderName !== "string") {
    Logger.log("Error: Attempted to use empty or invalid folder name");
    return false;
  }

  // Clean the folder name to ensure it's valid
  const cleanFolderName = cleanLabelName(folderName);

  // If the cleaned folder name is invalid, don't process the email
  /* istanbul ignore next -- defensive: cleanLabelName never returns an empty/whitespace string (it floors to "Other"), so this guard is unreachable. */
  if (!cleanFolderName || cleanFolderName.trim() === "") {
    Logger.log(
      `Invalid folder name "${folderName}" - email will remain unprocessed`
    );
    return false;
  }

  // Get or create the label
  let label = _esGmail().getUserLabelByName(cleanFolderName);
  if (!label) {
    try {
      label = _esGmail().createLabel(cleanFolderName);
      Logger.log(`Created new label: ${cleanFolderName}`);
    } catch (error) {
      Logger.log(`Failed to create label "${cleanFolderName}": ${error}`);
      // Return false to indicate failure - email will remain unprocessed
      return false;
    }
  }

  // Apply the label
  label.addToThread(thread);

  // Remove from inbox (optional - comment out if you want to keep in inbox too)
  thread.moveToArchive();

  return true;
}

/**
 * Create a new category with proper handling.
 *
 * @param {string} category - The category name
 * @param {string} emailAddress - The email address that triggered the category creation
 * @param {string} domain - The email domain
 * @param {string} subject - The email subject
 * @returns {string} The folder name or null if creation failed
 */
function createNewCategory(category, emailAddress, domain, subject) {
  // Capitalize and clean the folder name
  let folderName = category.charAt(0).toUpperCase() + category.slice(1);
  folderName = cleanLabelName(folderName);

  // Validate folder name
  /* istanbul ignore next -- defensive: cleanLabelName never returns an empty string (it floors to "Other"), so this guard is unreachable. */
  if (!folderName || folderName === "") {
    Logger.log(`Invalid category name: ${category}`);
    return null;
  }

  // Create the category using the data layer
  const result = addCategory(category, folderName);

  if (!result.success) {
    Logger.log(`Failed to add category: ${result.message}`);
    return null;
  }

  // Create Gmail label if needed
  if (!_esGmail().getUserLabelByName(folderName)) {
    try {
      _esGmail().createLabel(folderName);
      Logger.log(`Created new label: ${folderName}`);
    } catch (labelError) {
      Logger.log(`Failed to create label "${folderName}": ${labelError}`);
      return null;
    }
  }

  // Send notification email
  sendNewCategoryNotification(category, folderName, emailAddress, subject);

  return folderName;
}

/**
 * Send a notification about a newly created category
 * @param {string} category - The category key
 * @param {string} folderName - The Gmail label/folder name
 * @param {string} emailAddress - The sender email that triggered creation
 * @param {string} subject - The email subject
 */
function sendNewCategoryNotification(category, folderName, emailAddress, subject) {
  Logger.log(`New category created: ${category} (${folderName}) from email by ${emailAddress} | Subject: ${subject}`);
}

/**
 * One-time setup function to initialize the script environment.
 * Run this function ONCE to set up the script properly.
 *
 * @returns {string} Setup results message
 */
function setupEmailSorter() {
  try {
    Logger.log("Starting Gmail automation initialization...");

    // Initialize the categorizer cache
    initializeCategorizerCache();
    Logger.log("Initialized email categorizer cache");

    // Get categories from the cache system
    const categories = getAllCategories();

    // Create labels if they don't exist
    for (const [categoryKey, categoryValue] of Object.entries(categories)) {
      try {
        // Extract the display name/label name
        let folderName;
        if (typeof categoryValue === "string") {
          folderName = categoryValue;
        } else if (categoryValue && typeof categoryValue === "object") {
          folderName = // Prioritize label
            categoryValue.label || categoryValue.displayName || categoryKey;
        } else {
          folderName =
            categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
        }

        if (!_esGmail().getUserLabelByName(folderName)) {
          _esGmail().createLabel(folderName);
          Logger.log(`Created label: ${folderName}`);
        }
      } catch (labelError) {
        Logger.log(`Error creating label for ${categoryKey}: ${labelError}`);
      }
    }

    // Set up the trigger
    setupEmailSorterTrigger();

    // Set dynamic categories setting
    setDynamicCategoriesEnabled(EMAIL_SORTER_CONFIG.ENABLE_DYNAMIC_CATEGORIES);

    // Verify setup
    const status = `====== EMAIL SORTER SETUP COMPLETE ======
Categories initialized in data layer
Dynamic Categories: ${isDynamicCategoriesEnabled() ? "Enabled" : "Disabled"}
Check Interval: ${EMAIL_SORTER_CONFIG.CHECK_INTERVAL_MINUTES} minute(s)
These settings have been saved to script properties and will be used automatically.`;

    Logger.log(status);
    return status;
  } catch (error) {
    const errorMessage = `ERROR DURING SETUP: ${error.toString()}`;
    Logger.log(errorMessage);
    return errorMessage;
  }
}

/**
 * Toggle dynamic category creation.
 *
 * @returns {boolean} The new state (true if enabled, false if disabled)
 */
function toggleDynamicCategories() {
  // Get the current value from the cache system
  const currentValue = isDynamicCategoriesEnabled();
  const newValue = !currentValue;

  // Update the setting in the cache system
  setDynamicCategoriesEnabled(newValue);
  Logger.log(`Dynamic categories ${newValue ? "enabled" : "disabled"}`);

  return newValue;
}

// Conditional exports for testing (works in both Node.js and Apps Script)
/* istanbul ignore next -- the `typeof module` guard is always true under Node/Jest and always false in GAS; the false branch is never taken in the test runtime. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    queryGeminiForCategory,
    buildGeminiPrompt,
    extractCategoryFromResponse,
    cleanLabelName,
    sanitizeCategoryName,
    checkLockBeforeProcessing,
    setupEmailSorterTrigger,
    categorizeEmails,
    moveEmailToFolder,
    createNewCategory,
    setupEmailSorter,
    toggleDynamicCategories
  };
}
