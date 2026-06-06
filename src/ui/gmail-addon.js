/**
 * Comprehensive Gmail add-on with all possible entry points
 *
 * Platform access (Gmail, Properties) is routed exclusively through
 * src/core/services ports via the serviceFactory seam. No direct Google SDK
 * references live in this file (full-hexagonal-conversion, Wave 2).
 */

/**
 * Resolve the shared serviceFactory singleton.
 * In Apps Script it is the global from src/core/services/index.js (concatenated
 * into global scope). In Node it is required for testability.
 */
function _addonServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  if (typeof require !== 'undefined') {
    return require('../core/services/index.js').serviceFactory;
  }
  throw new Error('serviceFactory is not available');
}

function _addonGmail() {
  return _addonServiceFactory().getGmailAdapter();
}

function _addonProps() {
  return _addonServiceFactory().getPropertiesAdapter();
}

/**
 * Return the deployed web app URL for the dashboard.
 * @returns {string} Web app URL
 */
function getWebAppUrl() {
  return 'https://script.google.com/macros/s/AKfycbxWLGID2AytbnJzdGzjXRHeUUlLyMH-bFPcyO4zTeFj/dev';
}

/**
 * Main entry point for Gmail add-on.
 */
function getContextualAddOn(e) {
  writeLog("getContextualAddOn called with event: " + JSON.stringify(e));
  Logger.log("getContextualAddOn called with event: " + JSON.stringify(e));
  
  try {
    // Initialize the categorizer cache
    initializeCategorizerCache();
    
    // Get the message context if available
    const hasMessage = e && e.messageMetadata && e.messageMetadata.messageId;
    
    // Create cards based on context
    if (hasMessage) {
      // Message is selected - show categorization card
      return createCategoryCard(e);
    } else {
      // No message selected - show dashboard card
      return createDashboardCard();
    }
  } catch (error) {
    writeLog("Error in getContextualAddOn: " + error.toString());
    Logger.log("Error in getContextualAddOn: " + error.toString());
    return createErrorCard("Error loading add-on: " + error.toString());
  }
}

function createCategoryCard(e) {
  try {
    // Get message details
    const messageId = e.messageMetadata.messageId;
    const message = _addonGmail().getMessageById(messageId);
    const thread = message.getThread();

    // Extract sender and subject
    const from = message.getFrom();
    const subject = message.getSubject();

    // Extract email address and domain
    const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
    const emailAddress = emailMatch ? emailMatch[1] : from;
    const domain = emailAddress.split("@")[1];

    // Get categories for email and domain
    let emailCategory = null;
    let domainCategory = null;

    try {
      emailCategory = getCategoryForEmail(emailAddress);
      if (domain) {
        domainCategory = getCategoryForDomain(domain);
      }
    } catch (catError) {
      writeLog("Error getting categories: " + catError);
    }

    // Get web app URL
    const webAppUrl = getWebAppUrl();

    // Create the card builder
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader()
        .setTitle("Email Categorizer")
        .setSubtitle("Organize your emails by category"));

    // Dashboard access section - at the top as requested
    const dashboardSection = CardService.newCardSection();
    
    dashboardSection.addWidget(
      CardService.newTextButton()
        .setText("Open Dashboard")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOpenLink(
          CardService.newOpenLink()
            .setUrl(webAppUrl)
            .setOpenAs(CardService.OpenAs.FULL_SIZE)
            .setOnClose(CardService.OnClose.RELOAD_ADD_ON)
        )
    );
    
    card.addSection(dashboardSection);

    // Email information section
    const infoSection = CardService.newCardSection()
      .setHeader("Email Information");

    infoSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel("From")
        .setContent(from)
        .setMultiline(true)
    );

    infoSection.addWidget(
      CardService.newKeyValue()
        .setTopLabel("Email Address")
        .setContent(emailAddress)
    );

    if (domain) {
      infoSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel("Domain")
          .setContent(domain)
      );
    }

    // Current category information - show both email and domain categories
    if (emailCategory) {
      infoSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel("Current Email Category")
          .setContent(getDisplayNameForCategory(emailCategory))
      );
    } else {
      infoSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel("Current Email Category")
          .setContent("Not categorized")
      );
    }

    if (domain && domainCategory) {
      infoSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel("Current Domain Category")
          .setContent(getDisplayNameForCategory(domainCategory))
      );
    } else if (domain) {
      infoSection.addWidget(
        CardService.newKeyValue()
          .setTopLabel("Current Domain Category")
          .setContent("Not categorized")
      );
    }

    card.addSection(infoSection);

    // Category selection section
    const categorySection = CardService.newCardSection()
      .setHeader("Change Category");

    // Add category selection button with improved styling
    categorySection.addWidget(
      CardService.newTextButton()
        .setText("Select New Category")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("showCategorySelector")
            .setParameters({
              messageId: messageId,
              emailAddress: emailAddress,
              domain: domain,
              emailCategory: emailCategory || "",
              domainCategory: domainCategory || ""
            })
        )
    );

    card.addSection(categorySection);

    return card.build();
  } catch (error) {
    writeLog("Error in createCategoryCard: " + error.toString());
    return createErrorCard("Error creating category card: " + error.toString());
  }
}

function applyCategory(e) {
  try {
    // Get parameters from form inputs
    const emailAddress = e.parameters.emailAddress;
    const domain = e.parameters.domain;
    const categoryKey = e.formInput.categoryKey;
    const assignmentType = e.formInput.assignmentType || "email";
    
    writeLog(`Applying category ${categoryKey} to ${assignmentType} (${emailAddress}, ${domain})`);
    
    let successMessage = "";
    let errorMessage = "";
    
    // Apply to email if needed
    if (assignmentType === "email" || assignmentType === "both") {
      try {
        const emailResult = updateCategoryForEmail(emailAddress, categoryKey);
        if (emailResult) {
          successMessage += `Email address ${emailAddress} categorized as ${categoryKey}. `;
        } else {
          errorMessage += `Failed to categorize email address. `;
          writeLog(`Email categorization failed for ${emailAddress} with category ${categoryKey}`);
        }
      } catch (emailError) {
        errorMessage += `Error with email categorization: ${emailError}. `;
        writeLog(`Exception in email categorization: ${emailError}`);
      }
    }
    
    // Apply to domain if needed
    if ((assignmentType === "domain" || assignmentType === "both") && domain) {
      try {
        const domainResult = updateCategoryForDomain(domain, categoryKey);
        if (domainResult) {
          successMessage += `Domain ${domain} categorized as ${categoryKey}. `;
        } else {
          errorMessage += `Failed to categorize domain. `;
          writeLog(`Domain categorization failed for ${domain} with category ${categoryKey}`);
        }
      } catch (domainError) {
        errorMessage += `Error with domain categorization: ${domainError}. `;
        writeLog(`Exception in domain categorization: ${domainError}`);
      }
    }
    
    // Determine message to show
    let notificationMessage = "";
    if (successMessage) {
      notificationMessage = successMessage;
      if (errorMessage) {
        notificationMessage += "Some errors occurred: " + errorMessage;
      }
    } else {
      notificationMessage = "Failed to categorize: " + errorMessage;
    }
    
    // Recreate the contextual add-on card to ensure fresh data
    const refreshedCard = getContextualAddOn({
      messageMetadata: {
        messageId: e.parameters.messageId
      }
    });

    // Return to the main Email Categorizer card with a forced refresh
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification().setText(notificationMessage))
      .setNavigation(CardService.newNavigation().pushCard(refreshedCard))
      .build();
  } catch (error) {
    writeLog("Error in applyCategory: " + error.toString());
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText("Error applying category: " + error.toString()))
      .build();
  }
}

function showCategorySelector(e) {
  const emailAddress = e.parameters.emailAddress;
  const domain = e.parameters.domain;
  const emailCategory = e.parameters.emailCategory || "";
  const domainCategory = e.parameters.domainCategory || "";

  // Retrieve categories from the cache and sort alphabetically
  const allCategories = getAllCategories();
  const categories = Object.keys(allCategories)
    .sort((a, b) => 
      (allCategories[a].displayName || allCategories[a] || a)
        .localeCompare(allCategories[b].displayName || allCategories[b] || b)
    );

  // Create a card for category selection
  const card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle("Select Category")
        .setSubtitle(emailAddress)
    );

  // Apply to selection
  const applyToSection = CardService.newCardSection()
    .setHeader("Apply Category To");
  
  const applyToInput = CardService.newSelectionInput()
    .setFieldName("assignmentType")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Select Application Type");
  
  applyToInput.addItem("Email address only", "email", true)
    .addItem("Domain only", "domain", false)
    .addItem("Both email and domain", "both", false);
  
  applyToSection.addWidget(applyToInput);
  card.addSection(applyToSection);

  // Categories section
  const categoriesSection = CardService.newCardSection()
    .setHeader("Categories");

  // Create category dropdown
  const categoryDropdown = CardService.newSelectionInput()
    .setFieldName("categoryKey")
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Select Category");

  // Populate dropdown with categories
  categories.forEach(category => {
    const isCurrentEmail = category === emailCategory;
    const isCurrentDomain = category === domainCategory;
    
    // Get display name, fallback to category key
    const displayName = allCategories[category].displayName 
      || allCategories[category] 
      || category;
    
    let displayTitle = displayName;
    if (isCurrentEmail && isCurrentDomain) {
      displayTitle += " (current)";
    } else if (isCurrentEmail) {
      displayTitle += " (email)";
    } else if (isCurrentDomain) {
      displayTitle += " (domain)";
    }

    categoryDropdown.addItem(displayTitle, category, isCurrentEmail || isCurrentDomain);
  });

  categoriesSection.addWidget(categoryDropdown);
  card.addSection(categoriesSection);

  // Action buttons section
  const actionSection = CardService.newCardSection();
  const buttonSet = CardService.newButtonSet();
  
  const applyButton = CardService.newTextButton()
    .setText("Apply")
    .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
    .setOnClickAction(
      CardService.newAction()
        .setFunctionName("applyCategory")
        .setParameters({
          emailAddress: emailAddress,
          domain: domain,
          messageId: e.parameters.messageId // Pass message ID for refresh
        })
    );
  
  const cancelButton = CardService.newTextButton()
    .setText("Cancel")
    .setTextButtonStyle(CardService.TextButtonStyle.TEXT)
    .setOnClickAction(
      CardService.newAction().setFunctionName("returnToMessageView")
    );

  buttonSet.addButton(applyButton).addButton(cancelButton);
  
  actionSection.addWidget(buttonSet);
  card.addSection(actionSection);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card.build()))
    .build();
}

// Modify the filterCategories function similarly
function filterCategories(e) {
  const searchText = e.formInput.categorySearch || "";
  const emailAddress = e.parameters.emailAddress;
  const domain = e.parameters.domain;
  const emailCategory = e.parameters.emailCategory || "";
  const domainCategory = e.parameters.domainCategory || "";

  // Retrieve categories dynamically from cache
  const allCategoriesObj = getAllCategories();
  const categoryKeys = Object.keys(allCategoriesObj)
    .sort((a, b) =>
      (allCategoriesObj[a].displayName || allCategoriesObj[a] || a)
        .localeCompare(allCategoriesObj[b].displayName || allCategoriesObj[b] || b)
    );

  // Filter categories based on search text
  const filteredCategories = categoryKeys.filter(categoryKey => {
    const displayName = allCategoriesObj[categoryKey].displayName
      || allCategoriesObj[categoryKey]
      || categoryKey;
    return displayName.toLowerCase().includes(searchText.toLowerCase()) ||
           categoryKey.toLowerCase().includes(searchText.toLowerCase());
  });

  // Rebuild the card with filtered categories
  const card = CardService.newCardBuilder()
    .setHeader(
      CardService.newCardHeader()
        .setTitle("Select Category")
        .setSubtitle(emailAddress)
    );

  // Search section (maintain current search)
  const searchSection = CardService.newCardSection();
  searchSection.addWidget(
    CardService.newTextInput()
      .setFieldName("categorySearch")
      .setTitle("Search Categories")
      .setHint("Type to filter categories")
      .setValue(searchText)
      .setOnChangeAction(
        CardService.newAction()
          .setFunctionName("filterCategories")
          .setParameters({
            emailAddress: emailAddress,
            domain: domain,
            emailCategory: emailCategory,
            domainCategory: domainCategory
          })
      )
  );
  card.addSection(searchSection);

  // Apply to selection (maintain previous selection)
  const applyToSection = CardService.newCardSection()
    .setHeader("Apply Category To");
  
  const applyToInput = CardService.newSelectionInput()
    .setFieldName("assignmentType")
    .setType(CardService.SelectionInputType.RADIO_BUTTON)
    .setTitle("Select Application Type");
  
  applyToInput.addItem("Email address only", "email", true)
    .addItem("Domain only", "domain", false)
    .addItem("Both email and domain", "both", false);
  
  applyToSection.addWidget(applyToInput);
  card.addSection(applyToSection);

  // Categories section with filtered results
  const categoriesSection = CardService.newCardSection()
    .setHeader("Categories");

  // Create a button set for filtered categories
  const categoryButtonSet = CardService.newButtonSet();

  // Populate button set with filtered categories
  filteredCategories.forEach(categoryKey => {
    const isCurrentEmail = categoryKey === emailCategory;
    const isCurrentDomain = categoryKey === domainCategory;

    const displayName = allCategoriesObj[categoryKey].displayName
      || allCategoriesObj[categoryKey]
      || categoryKey;

    let buttonTitle = displayName;
    if (isCurrentEmail && isCurrentDomain) {
      buttonTitle += " (current)";
    } else if (isCurrentEmail) {
      buttonTitle += " (email)";
    } else if (isCurrentDomain) {
      buttonTitle += " (domain)";
    }

    categoryButtonSet.addButton(
      CardService.newTextButton()
        .setText(buttonTitle)
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName("applyCategory")
            .setParameters({
              emailAddress: emailAddress,
              domain: domain,
              categoryKey: categoryKey
            })
        )
    );
  });

  categoriesSection.addWidget(categoryButtonSet);
  card.addSection(categoriesSection);

  // Cancel section
  const cancelSection = CardService.newCardSection();
  cancelSection.addWidget(
    CardService.newTextButton()
      .setText("Cancel")
      .setOnClickAction(
        CardService.newAction().setFunctionName("returnToMessageView")
      )
  );
  card.addSection(cancelSection);

  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card.build()))
    .build();
}


/**
 * Return to the message view
 * 
 * @param {Object} e - The event object
 * @returns {ActionResponse} The action response
 */
function returnToMessageView(e) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popToRoot())
    .build();
}

function createDashboardCard() {
  try {
    // Get the web app URL. Resolve via globalThis so the call is observable
    // in tests; in the Apps Script runtime getWebAppUrl is a global function,
    // so this is behavior-identical to calling getWebAppUrl() directly.
    const webAppUrl = globalThis.getWebAppUrl();
    
    // Create the card
    const card = CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle(""));
    
    // Dashboard button - centered and full-width
    const dashboardSection = CardService.newCardSection();
    
    dashboardSection.addWidget(
      CardService.newTextButton()
        .setText("Open Dashboard")
        .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        .setOpenLink(
          CardService.newOpenLink()
            .setUrl(webAppUrl)
            .setOpenAs(CardService.OpenAs.FULL_SIZE)
            .setOnClose(CardService.OnClose.RELOAD_ADD_ON)
        )
    );
    
    card.addSection(dashboardSection);
    
    return card.build();
  } catch (error) {
    writeLog("Error in createDashboardCard: " + error.toString());
    return createErrorCard("Error creating dashboard card: " + error.toString());
  }
}

/**
 * Get display name for a category
 * 
 * @param {string} categoryKey - The category key 
 * @returns {string} The display name
 */
function getDisplayNameForCategory(categoryKey) {
  try {
    if (!categoryKey) return "None";
    
    const categories = getAllCategories();
    const category = categories[categoryKey];
    
    if (!category) return categoryKey;
    
    if (typeof category === "string") {
      return category;
    } else if (category && category.displayName) {
      return category.displayName;
    }
    
    return categoryKey;
  } catch (error) {
    writeLog("Error in getDisplayNameForCategory: " + error.toString());
    return categoryKey || "Unknown";
  }
}

/**
 * Creates an error card to display when something goes wrong.
 *
 * @param {string} errorMessage - The error message to display
 * @returns {Card} A card displaying the error
 */
function createErrorCard(errorMessage) {
  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Error"))
    .addSection(
      CardService.newCardSection()
        .addWidget(CardService.newTextParagraph().setText(errorMessage))
        .addWidget(
          CardService.newButtonSet().addButton(
            CardService.newTextButton()
              .setText("Reload")
              .setOnClickAction(
                CardService.newAction().setFunctionName("reloadGmailUI")
              )
          )
        )
    )
    .build();
}

/**
 * Function to reload the Gmail UI after an error
 */
function reloadGmailUI() {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().popToRoot())
    .build();
}

/**
 * Called when the add-on is opened on the homepage.
 */
function onHomepage(e) {
  writeLog("onHomepage called");
  Logger.log("onHomepage called");
  return createDashboardCard();
}

/**
 * Called when a message is opened.
 */
function onGmailMessage(e) {
  writeLog("onGmailMessage called");
  Logger.log("onGmailMessage called");
  return getContextualAddOn(e);
}
/**
 * Write a timestamped log entry to the script properties
 * This gives us persistent logging even if the normal logs aren't being shown.
 *
 * NOTE: PropertiesService has a 500KB total limit across all properties.
 * This function truncates the ADDON_LOG to 5000 chars to stay well under the
 * limit, but heavy logging across the project can still cause silent
 * truncation. TODO: Evaluate Drive-based logging if add-on diagnostics
 * need to be retained long-term.
 */
function writeLog(message) {
  try {
    const timestamp = new Date().toISOString();
    const props = _addonProps();

    // Get existing log
    let log = props.getProperty("ADDON_LOG") || "";

    // Add new entry with timestamp
    log += timestamp + " - " + message + "\n";

    // Keep log to a reasonable size by truncating if needed.
    // 5000 chars is a conservative guard against the 500KB total limit.
    if (log.length > 5000) {
      log = log.substring(log.length - 5000);
    }

    // Extra guard: if total properties usage is approaching the 500KB limit,
    // clear older entries more aggressively before saving.
    const estimatedSize = (log || "").length + 200; // rough overhead
    if (estimatedSize > 100000) {
      log = log.substring(log.length - 2000);
    }

    // Save log
    props.setProperty("ADDON_LOG", log);
  } catch (e) {
    // Can't do much if this fails
  }
}

/**
 * Read the persisted log
 */
function readPersistedLog() {
  return _addonProps().getProperty("ADDON_LOG") || "No logs found";
}

/**
 * Clear the persisted log
 */
function clearPersistedLog() {
  _addonProps().deleteProperty("ADDON_LOG");
  return "Log cleared";
}










/**
 * Called when the add-on is installed.
 */
function onInstall(e) {
  writeLog("onInstall called");
  Logger.log("onInstall called");
  return getContextualAddOn(e);
}

/**
 * Called when a thread is opened.
 */
function onGmailThread(e) {
  writeLog("onGmailThread called");
  Logger.log("onGmailThread called");
  return getContextualAddOn(e);
}

/**
 * Called when a conversation is opened.
 */
function onGmailConversation(e) {
  writeLog("onGmailConversation called");
  Logger.log("onGmailConversation called");
  return getContextualAddOn(e);
}

/**
 * Called when an email is composed.
 */
function onGmailCompose(e) {
  writeLog("onGmailCompose called");
  Logger.log("onGmailCompose called");
  return getContextualAddOn(e);
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getContextualAddOn,
    createCategoryCard,
    applyCategory,
    showCategorySelector,
    filterCategories,
    returnToMessageView,
    createDashboardCard,
    getDisplayNameForCategory,
    createErrorCard,
    reloadGmailUI,
    onHomepage,
    onGmailMessage,
    writeLog,
    readPersistedLog,
    clearPersistedLog,
    onInstall,
    onGmailThread,
    onGmailConversation,
    onGmailCompose
  };
}
