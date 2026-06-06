/**
 * ==============================================================================
 * SERVER-SIDE vs CLIENT-SIDE FUNCTION DOCUMENTATION (ARCH-BLOCK-02)
 * ==============================================================================
 * This file is consumed by Google Apps Script HtmlService. It contains BOTH
 * server-side GAS API functions and client-side DOM event handlers.
 *
 * SERVER-SIDE functions (GmailApp, PropertiesService, DriveApp, etc.):
 *   getAllLabelsAndCategories, createLabel, saveSettings,
 *   forceClearLabelCategoryMappings, moveGmailLabel, createLabelHierarchy,
 *   createLabelHierarchyForMove, renameGmailLabel, getNestedLabelsHierarchy,
 *   getThreadCount, moveCategoryBetweenLabels, checkStorageUpdated,
 *   getCategoryAssignments, moveItemToCategory, removeCategoryAssignment,
 *   getCategoriesAndAssignments, processBatchedChanges, generateRuleId
 *
 * CLIENT-SIDE functions (document.querySelectorAll, e.dataTransfer, DOM):
 *   setupCategoryDropZones, createCategoryPill
 *
 * The client-side functions rely on global HTML/DOM state (allCategories,
 * labelCategories) and should ideally be extracted into a separate
 * dashboard-events.html template in the future.
 *
 * Platform access (Gmail, Properties, Drive, Utilities) is routed exclusively
 * through src/core/services ports via the serviceFactory seam. No direct Google
 * SDK references live in the server-side functions of this file
 * (full-hexagonal-conversion, Wave 2). The client-side DOM handlers
 * (setupCategoryDropZones, createCategoryPill) run in the browser and use
 * document/console, which are not platform SDKs.
 * ==============================================================================
 */

/**
 * Resolve the shared serviceFactory singleton.
 */
function _dcServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  if (typeof require !== 'undefined') {
    return require('../core/services/index.js').serviceFactory;
  }
  throw new Error('serviceFactory is not available');
}

function _dcGmail() {
  return _dcServiceFactory().getGmailAdapter();
}

function _dcProps() {
  return _dcServiceFactory().getPropertiesAdapter();
}

function _dcDrive() {
  return _dcServiceFactory().getDriveAdapter();
}

function _dcUtils() {
  return _dcServiceFactory().getUtilitiesAdapter();
}

/**
 * Function to retrieve all labels, categories, and their associations
 * @returns {Object} - Object containing labels, categories, and their associations
 */
function getAllLabelsAndCategories() {
  try {
    // Initialize the categorizer cache first
    initializeCategorizerCache();
    
    // Use the Gmail adapter for labels
    const gmailLabels = _dcGmail().getAllLabels();

    // Get all categories from the email categorizer data
    const categories = getCategoryDefinitions();

    // Build label-category associations from the category data
    const allCategoriesData = getAllCategories();
    const labelCategories = {};
    
    // Build reverse mapping: label -> [categoryKeys]
    for (const [categoryKey, categoryData] of Object.entries(allCategoriesData)) {
      if (categoryData && categoryData.label) {
        const labelName = categoryData.label;
        if (!labelCategories[labelName]) {
          labelCategories[labelName] = [];
        }
        labelCategories[labelName].push(categoryKey);
      }
    }

    // Get retention rules using unified cache service
    const retentionRules = UnifiedCacheService.retentionRules.getAll();

    Logger.log(`Found ${gmailLabels.length} labels, ${Object.keys(categories).length} categories, ${Object.keys(labelCategories).length} label associations`);
    Logger.log('Built labelCategories mapping:', labelCategories);
    Logger.log('Sample category data used for mapping:', Object.entries(allCategoriesData).slice(0, 2));

    return {
      success: true,
      labels: gmailLabels,
      categories: categories,
      labelCategories: labelCategories,
      retentionRules: retentionRules,
    };
  } catch (error) {
    Logger.log(`Error getting labels and categories: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Create a new Gmail label
 *
 * @param {string} labelName - The name of the label to create
 * @returns {Object} Result with success status
 */
function createLabel(labelName) {
  try {
    // Check if label already exists
    if (_dcGmail().getUserLabelByName(labelName)) {
      return {
        success: false,
        message: `Label "${labelName}" already exists`,
      };
    }

    // Create the label (handles nested paths automatically)
    if (labelName.includes("/")) {
      // This should call your existing createLabelHierarchy function
      createLabelHierarchy(labelName);
    } else {
      _dcGmail().createLabel(labelName);
    }

    return {
      success: true,
      message: `Created label "${labelName}"`,
    };
  } catch (error) {
    Logger.log(`Error creating label: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Save application settings
 *
 * @param {Object} settings - The settings to save
 * @returns {Object} Result with success status
 */
function saveSettings(settings) {
  try {
    // Store settings in script properties (via PropertiesAdapter)
    const scriptProperties = _dcProps();

    // Save each setting
    scriptProperties.setProperty(
      "CATEGORIZATION_FREQUENCY",
      settings.categorizationFrequency.toString()
    );
    scriptProperties.setProperty(
      "RETENTION_FREQUENCY",
      settings.retentionFrequency
    );
    scriptProperties.setProperty(
      "CLEANUP_TIME",
      settings.cleanupTime.toString()
    );

    // Update triggers if needed
    if (settings.categorizationFrequency) {
      // Update your email categorization trigger
      setupEmailCategorizationTrigger(settings.categorizationFrequency);
    }

    if (settings.retentionFrequency && settings.cleanupTime) {
      // Update your retention check trigger
      setupRetentionTrigger(settings.retentionFrequency, settings.cleanupTime);
    }

    return {
      success: true,
      message: "Settings saved successfully",
    };
  } catch (error) {
    Logger.log(`Error saving settings: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Force clear the label-category mappings and rebuild from scratch
 *
 * @returns {Object} Result of the operation
 */
function forceClearLabelCategoryMappings() {
  try {
    const scriptProperties = _dcProps();

    // Delete existing mapping property
    scriptProperties.deleteProperty("LABEL_CATEGORIES_MAP");
    Logger.log("Deleted existing LABEL_CATEGORIES_MAP property");

    // Also check for any alternate property names that might be used
    scriptProperties.deleteProperty("labelCategories");
    scriptProperties.deleteProperty("LABEL_CATEGORIES");
    scriptProperties.deleteProperty("EMAIL_LABEL_CATEGORIES");

    // Delete and recreate the categories cache
    if (typeof DATA_LAYER !== "undefined") {
      DATA_LAYER.categories = null;
      DATA_LAYER.lastLoaded.categories = null;
    }

    // Force reload categories
    const categories = getCategoryDefinitions(true);
    Logger.log(
      `Reloaded ${Object.keys(categories).length} categories from storage`
    );

    // Create a new empty mapping
    const labelCategories = {};

    // Save the empty mapping
    scriptProperties.setProperty(
      "LABEL_CATEGORIES_MAP",
      JSON.stringify(labelCategories)
    );

    Logger.log("Reset all label-category mappings");

    return {
      success: true,
      message: "All label-category mappings have been reset",
    };
  } catch (error) {
    Logger.log(`Error resetting label-category mappings: ${error}`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
    };
  }
}

/**
 * Move a Gmail label to a new path
 *
 * @param {string} currentPath - Current label path
 * @param {string} newPath - New label path
 * @returns {Object} Result with success status
 */
function moveGmailLabel(currentPath, newPath) {
  try {
    // Input validation
    if (!currentPath || !newPath) {
      return {
        success: false,
        message: "Both current and new paths are required",
      };
    }

    // Check if the source label exists
    const sourceLabel = _dcGmail().getUserLabelByName(currentPath);
    if (!sourceLabel) {
      return {
        success: false,
        message: `Label "${currentPath}" not found`,
      };
    }

    // Check if the target path already exists to avoid conflicts
    const targetLabel = _dcGmail().getUserLabelByName(newPath);
    if (targetLabel) {
      return {
        success: false,
        message: `Label "${newPath}" already exists`,
      };
    }

    // Create the target label hierarchy if needed
    if (newPath.includes("/")) {
      try {
        createLabelHierarchy(newPath);
      } catch (hierarchyError) {
        return {
          success: false,
          message: `Error creating label hierarchy: ${hierarchyError.toString()}`,
        };
      }
    }

    // Get all threads with the source label
    const threads = sourceLabel.getThreads(0, 1000);
    Logger.log(`Found ${threads.length} threads with label "${currentPath}"`);

    // Get or create the target label
    const newLabel =
      _dcGmail().getUserLabelByName(newPath) || _dcGmail().createLabel(newPath);

    // Apply the new label to all threads
    for (const thread of threads) {
      newLabel.addToThread(thread);
    }

    // Remove the old label from all threads
    for (const thread of threads) {
      sourceLabel.removeFromThread(thread);
    }

    // Delete the old label if it's now empty
    try {
      sourceLabel.deleteLabel();
      Logger.log(`Deleted label "${currentPath}" after moving contents`);
    } catch (deleteError) {
      Logger.log(`Warning: Could not delete old label: ${deleteError}`);
      // This is not a critical error, as the contents were still moved
    }

    return {
      success: true,
      message: `Successfully moved label "${currentPath}" to "${newPath}"`,
      threadsAffected: threads.length,
    };
  } catch (error) {
    Logger.log(`Error moving Gmail label: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Create a nested label hierarchy
 * @param {string} labelPath - Full label path (e.g., "Parent/Child")
 * @returns {GmailLabel} The created or existing label
 */
function createLabelHierarchy(labelPath) {
  const parts = labelPath.split("/");
  let currentPath = "";
  const gmail = _dcGmail();
  for (let i = 0; i < parts.length; i++) {
    currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
    if (!gmail.getUserLabelByName(currentPath)) {
      gmail.createLabel(currentPath);
    }
  }
  return gmail.getUserLabelByName(labelPath);
}

/**
 * Create a label hierarchy if needed - this version specifically handles
 * the case where we're creating a new path for moving labels
 *
 * @param {string} labelPath - Full path of the new label
 * @returns {GmailLabel} The created label
 */
function createLabelHierarchyForMove(labelPath) {
  try {
    // Split the path into components
    const parts = labelPath.split("/");

    // Get just the parent path (everything except the last part)
    const parentPath = parts.slice(0, -1).join("/");

    const gmail = _dcGmail();

    // First ensure the parent path exists
    if (parentPath) {
      let currentPath = "";
      const parentParts = parentPath.split("/");

      // Create each level of the parent hierarchy
      for (let i = 0; i < parentParts.length; i++) {
        currentPath =
          i === 0 ? parentParts[0] : `${currentPath}/${parentParts[i]}`;

        // Create this level if it doesn't exist
        if (!gmail.getUserLabelByName(currentPath)) {
          gmail.createLabel(currentPath);
          Logger.log(`Created parent label: ${currentPath}`);
        }
      }
    }

    // Now the full path can be created since the parent exists
    if (!gmail.getUserLabelByName(labelPath)) {
      return gmail.createLabel(labelPath);
    } else {
      return gmail.getUserLabelByName(labelPath);
    }
  } catch (error) {
    Logger.log(`Error creating label hierarchy for move: ${error}`);
    throw error;
  }
}

/**
 * Rename a Gmail label
 *
 * @param {string} currentName - Current label name
 * @param {string} newName - New label name
 * @returns {Object} Result with success status
 */
function renameGmailLabel(currentName, newName) {
  try {
    // Input validation
    if (!currentName || !newName) {
      return {
        success: false,
        message: "Both current and new names are required",
      };
    }

    // Check if the source label exists
    const label = _dcGmail().getUserLabelByName(currentName);
    if (!label) {
      return {
        success: false,
        message: `Label "${currentName}" not found`,
      };
    }

    // Check if the target name already exists to avoid conflicts
    const existingLabel = _dcGmail().getUserLabelByName(newName);
    if (existingLabel) {
      return {
        success: false,
        message: `Label "${newName}" already exists`,
      };
    }

    // Rename the label
    label.setName(newName);

    return {
      success: true,
      message: `Successfully renamed label "${currentName}" to "${newName}"`,
    };
  } catch (error) {
    Logger.log(`Error renaming Gmail label: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Get a nested hierarchical structure of all Gmail labels
 *
 * @returns {Object} Hierarchical structure of labels
 */
function getNestedLabelsHierarchy() {
  try {
    // Get all Gmail labels
    const labels = getGmailLabels(false);

    // Create a hierarchy object
    const hierarchy = {
      root: {
        children: {},
        labels: [],
      },
    };

    // First pass: organize labels into hierarchy
    labels.forEach((label) => {
      const name = label.getName();
      const parts = name.split("/");

      if (parts.length === 1) {
        // Top-level label
        hierarchy.root.labels.push({
          name: name,
          label: label,
          count: getThreadCount(label),
        });
      } else {
        // Nested label
        let currentLevel = hierarchy.root;
        let currentPath = "";

        // Create the path step by step
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

          if (!currentLevel.children[parts[i]]) {
            currentLevel.children[parts[i]] = {
              name: parts[i],
              path: currentPath,
              children: {},
              labels: [],
            };
          }

          currentLevel = currentLevel.children[parts[i]];
        }

        // Add the leaf label
        currentLevel.labels.push({
          name: parts[parts.length - 1],
          fullName: name,
          label: label,
          count: getThreadCount(label),
        });
      }
    });

    return {
      success: true,
      hierarchy: hierarchy,
    };
  } catch (error) {
    Logger.log(`Error getting nested labels hierarchy: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Helper function to get thread count for a label
 *
 * @param {GmailLabel} label - The Gmail label
 * @returns {string} Thread count as a string (e.g., "15" or "100+")
 */
function getThreadCount(label) {
  try {
    // Get up to 100 threads to determine the count
    const threads = label.getThreads(0, 100);

    // If we have 100 threads, there might be more
    if (threads.length === 100) {
      return "100+";
    }

    // Otherwise, return the exact count
    return threads.length.toString();
  } catch (error) {
    Logger.log(`Error getting thread count: ${error}`);
    return "0";
  }
}

// In the setupCategoryDropZones function in dashboard-labels.html

function setupCategoryDropZones() {
  // Find all label drop zones
  const dropZones = document.querySelectorAll(".drop-zone[data-label]");

  dropZones.forEach((zone) => {
    zone.addEventListener("dragover", function (e) {
      e.preventDefault();
      this.classList.add("highlight");
    });

    zone.addEventListener("dragleave", function () {
      this.classList.remove("highlight");
    });

    zone.addEventListener("drop", function (e) {
      e.preventDefault();
      this.classList.remove("highlight");

      try {
        const data = JSON.parse(e.dataTransfer.getData("text/plain"));

        if (data.type === "category") {
          const categoryKey = data.categoryKey;
          const labelName = this.getAttribute("data-label");

          // If this is a category pill being moved from another label
          if (data.sourceLabel && data.sourceLabel !== labelName) {
            // Move category between labels
            moveCategoryBetweenLabels(categoryKey, data.sourceLabel, labelName);
            return;
          }

          // Check if this category is already assigned to this label
          const existingCategories = labelCategories[labelName] || [];

          if (!existingCategories.includes(categoryKey)) {
            // Add category to label
            addCategoryToLabel(labelName, categoryKey);
          }
        }
      } catch (error) {
        console.error("Error handling drop:", error);
      }
    });
  });
}

// Add a function to create a category pill that also knows its source label
function createCategoryPill(categoryKey, labelName) {
  const pill = document.createElement("div");
  pill.className = "category-pill";
  pill.setAttribute("draggable", "true");
  pill.setAttribute("data-category", categoryKey);
  pill.setAttribute("data-label", labelName);

  // Get display name
  let displayName = categoryKey;
  if (allCategories[categoryKey]) {
    if (typeof allCategories[categoryKey] === "string") {
      displayName = allCategories[categoryKey];
    } else if (allCategories[categoryKey].displayName) {
      displayName = allCategories[categoryKey].displayName;
    }
  }

  pill.innerHTML = `
      <svg class="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
      ${displayName}
      <button class="ml-1 text-blue-400 hover:text-red-500" onclick="removeCategoryFromLabel('${labelName}', '${categoryKey}')">
        <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
          <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" />
        </svg>
      </button>
    `;

  // Add dragstart event handler to include the source label
  pill.addEventListener("dragstart", function (e) {
    e.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        type: "category",
        categoryKey: categoryKey,
        sourceLabel: labelName,
      })
    );
    this.classList.add("opacity-50");
  });

  pill.addEventListener("dragend", function () {
    this.classList.remove("opacity-50");
  });

  return pill;
}


// In dashboardController.js
// Update the moveCategoryBetweenLabels function

function moveCategoryBetweenLabels(categoryKey, sourceLabel, targetLabel) {
  try {
    Logger.log(`=== START moveCategoryBetweenLabels ===`);
    Logger.log(
      `Parameters: categoryKey=${categoryKey}, sourceLabel=${sourceLabel}, targetLabel=${targetLabel}`
    );

    // Don't do anything if source and target are the same
    if (sourceLabel === targetLabel) {
      Logger.log("Source and target labels are the same. No action needed.");
      return {
        success: true,
        message: "Category already in target label",
        changed: false
      };
    }

    // Log initial state
    const initialLabelCategories = getAllLabelCategories();
    Logger.log(
      `Initial state of sourceLabel ${sourceLabel}: ${JSON.stringify(
        initialLabelCategories[sourceLabel] || []
      )}`
    );
    Logger.log(
      `Initial state of targetLabel ${targetLabel}: ${JSON.stringify(
        initialLabelCategories[targetLabel] || []
      )}`
    );

    // Step 1: First remove from source label
    Logger.log(
      `Removing category ${categoryKey} from source label ${sourceLabel}...`
    );
    const removeResult = removeCategoryFromLabel(sourceLabel, categoryKey);

    if (!removeResult.success) {
      Logger.log(`Error removing from source: ${removeResult.message}`);
      return removeResult;
    }

    Logger.log(
      `Successfully removed from source. Result: ${JSON.stringify(
        removeResult
      )}`
    );

    // Step 2: Then add to target label
    Logger.log(
      `Adding category ${categoryKey} to target label ${targetLabel}...`
    );
    const addResult = addCategoryToLabel(targetLabel, categoryKey);

    Logger.log(`Add result: ${JSON.stringify(addResult)}`);

    if (!addResult.success) {
      Logger.log(`Error adding to target: ${addResult.message}`);
      return {
        success: false,
        message: `Successfully removed from ${sourceLabel} but failed to add to ${targetLabel}: ${addResult.message}`,
        changed: true
      };
    }

    // Verify the changes
    const updatedLabelCategories = getAllLabelCategories();
    Logger.log(
      `Updated state of sourceLabel ${sourceLabel}: ${JSON.stringify(
        updatedLabelCategories[sourceLabel] || []
      )}`
    );
    Logger.log(
      `Updated state of targetLabel ${targetLabel}: ${JSON.stringify(
        updatedLabelCategories[targetLabel] || []
      )}`
    );

    // Return success
    Logger.log(`=== END moveCategoryBetweenLabels: success ===`);
    return {
      success: true,
      message: `Moved category "${categoryKey}" from "${sourceLabel}" to "${targetLabel}"`,
      changed: true,
      sourceState: updatedLabelCategories[sourceLabel] || [],
      targetState: updatedLabelCategories[targetLabel] || [],
    };
  } catch (error) {
    Logger.log(`ERROR in moveCategoryBetweenLabels: ${error}`);
    Logger.log(`Error stack: ${error.stack}`);
    Logger.log(`=== END moveCategoryBetweenLabels: error ===`);
    return {
      success: false,
      message: `Error: ${error.toString()}`,
      changed: false,
    };
  }
}

/**
 * Check if storage was updated properly
 * This is a helper function to verify that changes were persisted
 */
function checkStorageUpdated() {
  try {
    // Check file storage
    const scriptProperties = _dcProps();
    const fileId = scriptProperties.getProperty("EMAIL_CATEGORIZER_FILE_ID");

    if (fileId) {
      try {
        const file = _dcDrive().getFileById(fileId);
        const lastUpdated = file.getLastUpdated();
        return {
          success: true,
          message: "Storage check complete",
          fileExists: true,
          fileId: fileId,
          fileName: file.getName(),
          lastUpdated: lastUpdated.toISOString(),
          fileSize: file.getSize(),
        };
      } catch (fileError) {
        return {
          success: false,
          message: `Error accessing file: ${fileError.toString()}`,
          fileExists: false,
        };
      }
    } else {
      return {
        success: false,
        message: "No file ID found in properties",
        fileExists: false,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Error checking storage: ${error.toString()}`,
    };
  }
}

/**
 * Get all domains and emails assigned to categories
 *
 * @returns {Object} Map of category keys to arrays of assigned items
 */
function getCategoryAssignments() {
  try {
    // Use the proper function to get all categories with their emails and domains
    const categoryItems = getAllCategoryItems();

    Logger.log(`Found ${Object.keys(categoryItems).length} categories with items`);

    return {
      success: true,
      assignments: categoryItems,
    };
  } catch (error) {
    Logger.log(`Error getting category assignments: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Move an email or domain to a different category
 *
 * @param {string} item - The email or domain to move
 * @param {string} targetCategory - The target category
 * @param {string} itemType - 'email' or 'domain'
 * @returns {Object} Result with success status
 */
function moveItemToCategory(item, targetCategory, itemType) {
  try {
    if (itemType === "email") {
      updateCategoryForEmail(item, targetCategory);
    } else if (itemType === "domain") {
      updateCategoryForDomain(item, targetCategory);
    } else {
      return {
        success: false,
        message: `Unknown item type: ${itemType}`,
      };
    }

    return {
      success: true,
      message: `Moved ${itemType} "${item}" to category "${targetCategory}"`,
    };
  } catch (error) {
    Logger.log(`Error moving item: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

// Add this function to dashboardController.js

/**
 * Remove a category assignment for an email or domain
 *
 * @param {string} item - The email or domain to remove
 * @param {string} itemType - 'email' or 'domain'
 * @returns {Object} Result with success status
 */
function removeCategoryAssignment(item, itemType) {
  try {
    Logger.log(`Attempting to remove ${itemType} "${item}"`);
    
    // Initialize the categorizer cache to ensure it's loaded
    initializeCategorizerCache();
    
    // Remove the assignment using the new cache system
    let result = false;
    
    if (itemType === "email") {
      result = removeCategoryFromEmail(item);
      Logger.log(`removeCategoryFromEmail result:`, result);
    } else if (itemType === "domain") {
      result = removeCategoryFromDomain(item);
      Logger.log(`removeCategoryFromDomain result:`, result);
    } else {
      return {
        success: false,
        message: `Unknown item type: ${itemType}`,
      };
    }

    if (!result) {
      return {
        success: false,
        message: `Failed to remove ${itemType} "${item}" from category`,
      };
    }

    return {
      success: true,
      message: `Successfully removed ${itemType} "${item}" from its category`,
    };
  } catch (error) {
    Logger.log(`Error removing category assignment: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Get categories and their assignments without using Gmail API
 * @returns {Object} Categories and label assignments
 */
function getCategoriesAndAssignments() {
  try {
    // Load categories from the Drive JSON file
    const categories = loadCategories();

    // Load label-category assignments
    const labelCategories = getAllLabelCategories();

    return {
      success: true,
      categories: categories,
      labelCategories: labelCategories,
    };
  } catch (error) {
    Logger.log(`Error getting categories and assignments: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Process a batch of changes from the client
 * @param {Array} changes - Array of change objects
 * @returns {Object} Result of processing
 */
function processBatchedChanges(changes) {
  if (!changes || !Array.isArray(changes) || changes.length === 0) {
    return {
      success: true,
      message: "No changes to process",
      processedCount: 0,
    };
  }

  try {
    let processedCount = 0;
    let errorCount = 0;

    // Process each change
    for (const change of changes) {
      try {
        if (change.type === "moveItem") {
          // Handle item movement between categories
          const item = change.item;
          const targetCategory = change.targetCategory;
          const itemType = change.itemType;

          if (itemType === "email") {
            updateCategoryForEmail(item, targetCategory);
          } else if (itemType === "domain") {
            updateCategoryForDomain(item, targetCategory);
          }

          processedCount++;
        } else if (change.type === "moveCategory") {
          // Handle category movement between labels
          const categoryKey = change.categoryKey;
          const sourceLabel = change.sourceLabel;
          const targetLabel = change.targetLabel;

          // Remove from source
          removeCategoryFromLabel(sourceLabel, categoryKey);

          // Add to target
          addCategoryToLabel(targetLabel, categoryKey);

          processedCount++;
        }
      } catch (changeError) {
        Logger.log(
          `Error processing change: ${JSON.stringify(change)}: ${changeError}`
        );
        errorCount++;
      }
    }

    return {
      success: true,
      message: `Processed ${processedCount} changes with ${errorCount} errors`,
      processedCount: processedCount,
      errorCount: errorCount,
    };
  } catch (error) {
    Logger.log(`Error processing batched changes: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Generate a unique ID for a rule
 * Note: This function is kept here for dashboard-specific ID generation
 * The main retention logic uses email-retention-manager.js
 */
function generateRuleId() {
  return "rule_" + _dcUtils().getUuid().replace(/-/g, "").substring(0, 8);
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAllLabelsAndCategories,
    createLabel,
    saveSettings,
    forceClearLabelCategoryMappings,
    moveGmailLabel,
    createLabelHierarchyForMove,
    renameGmailLabel,
    getNestedLabelsHierarchy,
    getThreadCount,
    setupCategoryDropZones,
    createCategoryPill,
    moveCategoryBetweenLabels,
    checkStorageUpdated,
    getCategoryAssignments,
    moveItemToCategory,
    removeCategoryAssignment,
    getCategoriesAndAssignments,
    processBatchedChanges,
    generateRuleId
  };
}
