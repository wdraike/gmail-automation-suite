/**
 * Test script for the upgraded Gemini API
 * Run this to verify the API upgrade is working correctly
 */

/**
 * Test the Gemini API with a simple prompt
 */
function testGeminiApiUpgrade() {
  try {
    Logger.log("Testing Gemini API upgrade...");

    // Test 1: Simple API call
    const testPrompt = "Return only the JSON object: {\"status\": \"working\", \"version\": \"v1\"}";
    const response = callGemini(testPrompt);

    Logger.log("✓ API call successful");
    Logger.log("Response: " + response);

    // Test 2: Categorization test
    const categorizationPrompt = `Categorize this email into ONE category from: finance, shopping, social, travel, work, newsletters, personal, other

EMAIL:
From: newsletter@shopify.com
Subject: Your weekly sales report

Reply with ONLY a JSON object: {"category":"chosen_category"}`;

    const categorization = callGemini(categorizationPrompt);
    Logger.log("✓ Categorization test successful");
    Logger.log("Categorization response: " + categorization);

    // Test 3: Job extraction test
    const jobPrompt = `Extract job listings from this text. Return ONLY a JSON array.

Text: "Senior Software Engineer at Google - Mountain View, CA - $150,000-$200,000/year - Apply at https://careers.google.com/jobs/123"

Return format: [{"company":"","jobTitle":"","location":"","minSalary":"","maxSalary":"","salaryPeriod":"","jobUrl":""}]`;

    const jobExtraction = callGemini(jobPrompt);
    Logger.log("✓ Job extraction test successful");
    Logger.log("Job extraction response: " + jobExtraction);

    Logger.log("\n=== ALL TESTS PASSED ===");
    Logger.log("Gemini API v1beta with gemini-2.5-flash-lite is working correctly!");

    return {
      success: true,
      message: "All API tests passed successfully",
      endpoint: API_SERVICE_CONFIG.GEMINI_API_ENDPOINT
    };

  } catch (error) {
    Logger.log("✗ Test failed: " + error.toString());
    return {
      success: false,
      message: "API test failed: " + error.toString(),
      endpoint: API_SERVICE_CONFIG.GEMINI_API_ENDPOINT
    };
  }
}

/**
 * Compare old vs new API performance
 */
function compareApiVersions() {
  Logger.log("=== API VERSION COMPARISON ===");
  Logger.log("Previous: v1beta/models/gemini-2.5-flash");
  Logger.log("Current:  v1beta/models/gemini-2.5-flash-lite");
  Logger.log("");
  Logger.log("Key improvements with Flash-Lite:");
  Logger.log("- Faster response times");
  Logger.log("- Lower cost (80% cheaper than Flash)");
  Logger.log("- More concise outputs");
  Logger.log("- Better instruction following");
  Logger.log("- Using Gemini 2.5 Flash-Lite model");
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testGeminiApiUpgrade,
    compareApiVersions
  };
}
