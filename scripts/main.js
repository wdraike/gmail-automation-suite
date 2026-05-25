/**
 * Helper function to include HTML templates
 * @param {string} filename - Name of the HTML file to include
 * @returns {string} - Content of the HTML file
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Handle HTTP GET requests to serve the web app
 *
 * @param {Object} e - The event object containing request parameters
 * @returns {HtmlOutput} The HTML page to serve
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.page) {
    switch (e.parameter.page.toLowerCase()) {
      case "dashboard":
        // New dashboard page using template approach
        return HtmlService.createTemplateFromFile("DashboardMain")
          .evaluate()
          .setTitle("Gmail Automation Dashboard")
          .setFaviconUrl(
            "https://www.google.com/gmail/about/static/images/logo_gmail_lockup_dark_1x_r5.png"
          );
      default:
        // Default to dashboard for unspecified pages
        return HtmlService.createTemplateFromFile("DashboardMain")
          .evaluate()
          .setTitle("Gmail Automation Dashboard")
          .setFaviconUrl(
            "https://www.google.com/gmail/about/static/images/logo_gmail_lockup_dark_1x_r5.png"
          );
    }
  }

  // Default to dashboard when no page parameter is specified
  return HtmlService.createTemplateFromFile("DashboardMain")
    .evaluate()
    .setTitle("Gmail Automation Dashboard")
    .setFaviconUrl(
      "https://www.google.com/gmail/about/static/images/logo_gmail_lockup_dark_1x_r5.png"
    );
}

/**
 * Save the web app URL
 */
function saveWebAppUrl() {
  try {
    const url = ScriptApp.getService().getUrl();

    // Check if we got a valid URL
    if (url && url.startsWith("http")) {
      PropertiesService.getScriptProperties().setProperty("WEB_APP_URL", url);
      console.log("Web app URL saved: " + url);
      return "Saved URL: " + url;
    } else {
      console.log("Invalid URL generated: " + url);
      return "Failed to get valid URL";
    }
  } catch (error) {
    console.log("Error saving web app URL: " + error);
    return "Error: " + error.toString();
  }
}

/**
 * Initialize web app URL - call this after deploying
 * This ensures the URL is available for the Gmail add-on
 */
function initializeWebAppUrl() {
  const result = saveWebAppUrl();
  
  // Also try to get the deployment ID if available
  try {
    const deploymentId = ScriptApp.getService().getDeploymentId();
    if (deploymentId) {
      PropertiesService.getScriptProperties().setProperty("DEPLOYMENT_ID", deploymentId);
      return result + "\nDeployment ID: " + deploymentId;
    }
  } catch (e) {
    // Deployment ID might not be available in all contexts
  }
  
  return result;
}

/**
 * Manually set the web app URL - use this if automatic detection fails
 * @param {string} url - The full URL of your deployed web app
 */
function setWebAppUrlManually(url) {
  if (!url || !url.startsWith("https://script.google.com/macros/")) {
    return "Error: Please provide a valid web app URL that starts with https://script.google.com/macros/";
  }
  
  PropertiesService.getScriptProperties().setProperty("WEB_APP_URL", url);
  return "Web app URL set successfully: " + url;
}

/**
 * Get the current stored web app URL
 */
function getCurrentWebAppUrl() {
  const url = PropertiesService.getScriptProperties().getProperty("WEB_APP_URL");
  const scriptId = ScriptApp.getScriptId();
  
  return {
    storedUrl: url || "Not set",
    scriptId: scriptId,
    suggestedUrl: `https://script.google.com/macros/s/${scriptId}/exec`,
    instructions: "If the stored URL is 'Not set', deploy your script as a web app and then either:\n" +
                  "1. Run initializeWebAppUrl() after deployment\n" +
                  "2. Or manually set it using setWebAppUrlManually() with your deployment URL"
  };
}

/**
 * Set up a simple trigger to save the URL
 */
function createTriggers() {
  try {
    // First save the URL manually right now
    const saveResult = saveWebAppUrl();
    console.log(saveResult);

    // Then clear any existing triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === "saveWebAppUrl") {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Create a daily trigger
    ScriptApp.newTrigger("saveWebAppUrl")
      .timeBased()
      .everyDays(1)
      .atHour(1) // Run at 1 AM
      .create();

    return "Trigger created successfully";
  } catch (error) {
    console.log("Error creating trigger: " + error);
    return "Error: " + error.toString();
  }
}

/**
 * Get the web app URL from properties
 */
function getWebAppUrl() {
  // First try to get from properties
  let url = PropertiesService.getScriptProperties().getProperty("WEB_APP_URL");

  // If we have a valid URL, return it
  if (url && url.startsWith("http")) {
    return url;
  }

  // Try to get the URL directly from ScriptApp (only works after deployment)
  try {
    url = ScriptApp.getService().getUrl();
    
    // If we got a valid URL, save it and return it
    if (url && url.startsWith("http")) {
      PropertiesService.getScriptProperties().setProperty("WEB_APP_URL", url);
      console.log("Web app URL retrieved and saved: " + url);
      return url;
    }
  } catch (error) {
    console.log("Error getting web app URL: " + error);
  }

  // If we can't get the URL automatically, provide instructions
  const scriptId = ScriptApp.getScriptId();
  console.log("Web app URL not found. Script ID: " + scriptId);
  console.log("Please run getCurrentWebAppUrl() for instructions on setting the URL");
  
  // Return a placeholder that will show the issue
  return "https://script.google.com/macros/d/" + scriptId + "/edit";
}
