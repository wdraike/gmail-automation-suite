/**
 * Gmail Automation - API Service
 *
 * Handles external API communications with proper:
 * - Rate limiting
 * - Error handling
 * - Caching
 * - Retry logic
 */

// API monitoring system
const API_MONITOR = {
  status: "unknown", // "up", "down", "rate_limited", "unknown"
  lastCheck: null,
  lastResetTime: Date.now(),
  requestCount: 0,
  totalCalls: 0,
  successfulCalls: 0,
  failedCalls: 0,
  rateLimitHits: 0,

  // Record a successful API call
  recordSuccess: function () {
    this.status = "up";
    this.lastCheck = new Date();
    this.totalCalls++;
    this.successfulCalls++;
  },

  // Record a failed API call
  recordFailure: function (error) {
    this.totalCalls++;
    this.failedCalls++;
    this.lastCheck = new Date();

    // Track rate limiting specifically
    if (error && error.message === "RATE_LIMIT_REACHED") {
      this.status = "rate_limited";
      this.rateLimitHits++;
    } else {
      this.status = "down";
    }
  },

  // Record an email being processed (for UI tracking)
  recordEmailProcessed: function (category) {
    // Just log the category - can be expanded if needed
    Logger.log(`Email processed and categorized as: ${category}`);
  },

  // Get the status for the UI
  getStatus: function () {
    return {
      apiStatus: this.status,
      lastCheck: this.lastCheck ? this.lastCheck.toISOString() : null,
      stats: {
        totalCalls: this.totalCalls,
        successRate:
          this.totalCalls > 0
            ? Math.round((this.successfulCalls / this.totalCalls) * 100)
            : 0,
        rateLimitHits: this.rateLimitHits,
      },
    };
  },
};
// Global state for rate limiting
const API_STATE = {
  consecutiveFailures: 0,
  maxConsecutiveFailures: 3,
  backoffTime: 5 * 60 * 1000, // Initial 5-minute backoff
  lastApiCalls: [],
};

/**
 * Call the Gemini API with proper handling and response parsing
 * @param {string} prompt - The prompt text to send to Gemini
 * @param {string} operationType - Type of operation being performed (for logging)
 * @returns {Object} Processed API response
 */
function callGeminiApi(prompt, operationType) {
  try {
    // Make the API call with rate limiting (logging happens inside)
    const response = callGeminiWithRateLimiting(prompt, operationType);
    
    // Process the response based on operation type
    if (operationType === "job_extraction") {
      try {
        // For job extraction, try to parse JSON from the response
        const cleanedJson = cleanGeminiResponse(response);
        const jobs = JSON.parse(cleanedJson);
        
        // Return processed results
        return {
          success: true,
          response: response,
          jobs: jobs
        };
      } catch (parseError) {
        // Handle parsing errors
        Logger.log(`Error parsing job extraction response: ${parseError}`);
        return {
          success: true,
          response: response,
          jobs: [],
          parseError: parseError.toString()
        };
      }
    } else if (operationType === "test_categorization") {
      try {
        // For categorization, extract categories from response
        let categories = [];
        
        // Try to extract JSON array
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          categories = JSON.parse(jsonMatch[0]);
        } else {
          // Fallback: extract categories as simple strings
          categories = response
            .split('\n')
            .filter(line => line.trim().length > 0)
            .map(line => {
              // Remove bullet points, numbers, quotes
              return line.replace(/^[\s•\-\d\.\[\]\(\)"']+/, '').trim();
            })
            .filter(category => category.length > 0);
        }
        
        // Record success
        API_MONITOR.recordSuccess();
        
        return {
          success: true,
          response: response,
          categories: categories
        };
      } catch (parseError) {
        Logger.log(`Error parsing categorization response: ${parseError}`);
        return {
          success: true,
          response: response,
          categories: [],
          parseError: parseError.toString()
        };
      }
    } else {
      // Generic response for other operation types
      API_MONITOR.recordSuccess();
      
      return {
        success: true,
        response: response
      };
    }
    
  } catch (error) {
    // Record and handle errors
    API_MONITOR.recordFailure(error);
    logGeminiInteraction("error", { 
      operationType: operationType,
      error: error.toString()
    });
    
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Calls the Gemini API with the given prompt.
 * Includes rate limiting and error handling.
 *
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {string} The API response text
 * @throws {Error} If the API call fails or is rate limited
 */
function callGeminiWithRateLimiting(prompt, operationType = 'categorization') {
  const startTime = new Date().toISOString();
  const safeTimestamp = startTime.replace(/:/g, '-').replace(/\./g, '-');

  try {
    // Check if we're rate limited
    const rateLimitStatus = checkRateLimit();

    if (rateLimitStatus.rateLimited) {
      // If we're rate limited, wait or throw an error.
      // Cap the in-process pre-wait (fix-processjobemails-timeout): sleeping out a
      // long rate-limit window INSIDE the run burns the Apps Script 6-min budget for
      // no work. If the wait exceeds MAX_INPROCESS_WAIT_MS, surface RATE_LIMIT_REACHED
      // so the email is queued for a later run instead of stalling here.
      if (rateLimitStatus.waitTime > API_SERVICE_CONFIG.MAX_INPROCESS_WAIT_MS) {
        API_STATE.consecutiveFailures++;
        throw new Error("RATE_LIMIT_REACHED");
      } else {
        // If wait time is within the cap, actually wait.
        Utilities.sleep(rateLimitStatus.waitTime + 100);
      }
    }

    // Call the API with retry logic
    let response = null;
    let retries = 0;

    while (retries <= API_SERVICE_CONFIG.MAX_RETRIES) {
      try {
        response = callGemini(prompt);
        break; // Success, exit the retry loop
      } catch (error) {
        // Rate-limit errors are NOT retryable here: each retry burns another
        // request against the per-minute Gemini quota and immediately 429s
        // again. Re-throw so the outer catch sets the 300s backoff and the
        // caller can queue the email. Only transient/non-rate-limit errors
        // (network/5xx-other/parse) consume the exponential-backoff retries.
        if (error.message === "RATE_LIMIT_REACHED") {
          throw error;
        }

        retries++;

        // If we've hit max retries, throw the error
        if (retries > API_SERVICE_CONFIG.MAX_RETRIES) {
          throw error;
        }

        // Exponential backoff for retries.
        const backoffTime =
          API_SERVICE_CONFIG.RETRY_DELAY_MS * Math.pow(2, retries - 1);

        // Cap the in-process backoff sleep (fix-processjobemails-timeout): a single
        // retry must not sleep for minutes inside the run and blow the Apps Script
        // 6-min budget. If the computed backoff exceeds MAX_INPROCESS_WAIT_MS, bail
        // with RATE_LIMIT_REACHED so the email is queued for a later run instead.
        if (backoffTime > API_SERVICE_CONFIG.MAX_INPROCESS_WAIT_MS) {
          Logger.log(
            `Backoff ${backoffTime}ms exceeds in-process cap ` +
            `(${API_SERVICE_CONFIG.MAX_INPROCESS_WAIT_MS}ms); deferring to next run`
          );
          throw new Error("RATE_LIMIT_REACHED");
        }

        Logger.log(
          `API call failed, retrying in ${backoffTime}ms (attempt ${retries}/${API_SERVICE_CONFIG.MAX_RETRIES})`
        );
        Utilities.sleep(backoffTime);
      }
    }

    // Reset failure counter on success
    API_STATE.consecutiveFailures = 0;

    // Log only metadata (no prompt content for security)
    Logger.log(`Gemini API call completed | Operation: ${operationType} | Timestamp: ${startTime} | Response length: ${response ? response.length : 0} chars`);

    return response;
  } catch (error) {
    // If rate limited, track consecutive failures for exponential backoff
    if (error.message === "RATE_LIMIT_REACHED") {
      const backoffTime = Math.min(
        API_STATE.backoffTime * Math.pow(2, API_STATE.consecutiveFailures),
        30 * 60 * 1000 // Max 30 minute backoff
      );

      // Store next run time
      const nextRunTime = Date.now() + backoffTime;
      PropertiesService.getScriptProperties().setProperty(
        PROPERTY_KEYS.RATE_LIMIT_NEXT_RUN,
        nextRunTime.toString()
      );

      Logger.log(
        `Rate limited. Setting backoff for ${backoffTime / 1000} seconds`
      );
    }

    throw error; // Re-throw the error to let caller handle it
  }
}
/**
 * Check if the API is currently rate limited.
 *
 * @returns {Object} Rate limit status with rateLimited boolean and waitTime in ms
 */
function checkRateLimit() {
  try {
    const now = Date.now();

    // Filter to keep only calls within the last minute
    API_STATE.lastApiCalls = API_STATE.lastApiCalls.filter(
      (timestamp) => now - timestamp < 60000
    );

    // Check if we've reached the limit
    if (
      API_STATE.lastApiCalls.length >= JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE
    ) {
      // Calculate wait time until next available slot
      const oldestCall = Math.min(...API_STATE.lastApiCalls);
      const waitTime = 60000 - (now - oldestCall);

      Logger.log(
        `Rate limit reached. Need to wait ${Math.ceil(
          waitTime / 1000
        )} seconds.`
      );
      return {
        rateLimited: true,
        waitTime: waitTime,
      };
    }

    // Add current timestamp to the list for future rate limiting
    API_STATE.lastApiCalls.push(now);

    return {
      rateLimited: false,
      waitTime: 0,
    };
  } catch (error) {
    Logger.log(`Error checking rate limit: ${error}`);
    return {
      rateLimited: false, // Default to not rate limited on error
      waitTime: 0,
    };
  }
}

/**
 * Clean Gemini API response to extract JSON
 *
 * @param {string} response - The raw response from Gemini
 * @returns {string} Cleaned JSON string (can be object or array)
 */
function cleanGeminiResponse(response) {
  if (!response) return '';

  let cleaned = response;

  // Remove markdown code blocks
  cleaned = cleaned
    .replace(/```json\n?/g, '')
    .replace(/```javascript\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Remove trailing commas
  cleaned = cleaned
    .replace(/,(\s*})/g, '}')    // Objects
    .replace(/,(\s*\])/g, ']');  // Arrays

  // Validate JSON
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (error) {
    Logger.log(`Invalid JSON after cleaning: ${error}`);

    // Try to extract first JSON object (most common case)
    const objectMatch = cleaned.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (objectMatch) {
      try {
        JSON.parse(objectMatch[0]);
        return objectMatch[0];
      } catch (e) {
        // Continue to next attempt
      }
    }

    // Try to extract JSON array
    const arrayMatch = cleaned.match(/\[.*\]/s);
    if (arrayMatch) {
      try {
        JSON.parse(arrayMatch[0]);
        return arrayMatch[0];
      } catch (e) {
        // Continue to next attempt
      }
    }

    return '[]';  // Fallback
  }
}

/**
 * Calls the Gemini API directly.
 * Fixed version that handles API key correctly and errors gracefully
 *
 * @param {string} prompt - The prompt to send to Gemini
 * @returns {string} The API response text
 * @throws {Error} If the API call fails
 */
function callGemini(prompt) {
  // Get API key (prefers git-ignored local secret override, else Script Property)
  const API_KEY = getApiKey();

  if (!prompt) {
    throw new Error("Empty prompt provided");
  }

  // Check if API key exists
  if (!API_KEY) {
    throw new Error("API key is missing. Check your script properties.");
  }

  // Log API key details (not the actual key) for debugging
  Logger.log(`API key length: ${API_KEY.length}`);

  const payload = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  };

  // Setup headers with API key as a simple string
  const headers = {};
  headers["x-goog-api-key"] = API_KEY;

  const options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: headers,
    muteHttpExceptions: true,
  };

  Logger.log("Sending request to Gemini API...");
  const response = UrlFetchApp.fetch(
    API_SERVICE_CONFIG.GEMINI_API_ENDPOINT,
    options
  );
  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();

  // Log response info (without full text for privacy)
  Logger.log(`Response Code: ${responseCode}`);

  if (responseCode !== 200) {
    // 429 (rate limit) and 503 (overloaded/unavailable) are transient throttling
    // signals. Surface them as RATE_LIMIT_REACHED so the backoff tracker in
    // callGeminiWithRateLimiting fires and callers queue the email for retry
    // instead of treating it as a hard failure (which silently drops emails).
    if (responseCode === 429 || responseCode === 503) {
      // Diagnostic: log the raw body so we can identify which Gemini quota was hit
      // (RESOURCE_EXHAUSTED carries the quota metric — e.g. PerDay vs PerMinute —
      // plus a retryDelay, distinguishing RPD / RPM / zero-quota exhaustion).
      Logger.log("Gemini 429 body: " + responseText.substring(0, 500));
      throw new Error("RATE_LIMIT_REACHED");
    }
    throw new Error(`API returned status ${responseCode}: ${responseText.substring(0, 200)}`);
  }

  const jsonResponse = JSON.parse(responseText);

  // Surface the candidate finishReason so output truncation is visible in logs.
  // fix-nojobs-output-truncation: a MAX_TOKENS finishReason means Gemini ran out
  // of output budget and the JSON array is cut off mid-record (no closing `]`).
  // The job-finder parser salvages the complete records, but logging this here
  // makes future truncation occurrences diagnosable from the execution logs.
  if (jsonResponse.candidates && jsonResponse.candidates.length > 0) {
    const finishReason = jsonResponse.candidates[0].finishReason;
    Logger.log(`Gemini finishReason: ${finishReason}`);
    if (finishReason === 'MAX_TOKENS') {
      Logger.log(
        'WARNING: Gemini output was truncated (finishReason=MAX_TOKENS). ' +
        'The response may be cut off mid-record; downstream salvage will apply.'
      );
    }
  }

  // Extract text from JSON response
  if (
    jsonResponse.candidates &&
    jsonResponse.candidates.length > 0 &&
    jsonResponse.candidates[0].content &&
    jsonResponse.candidates[0].content.parts &&
    jsonResponse.candidates[0].content.parts.length > 0
  ) {
    const text = jsonResponse.candidates[0].content.parts[0].text;
    return text; // Return raw text, let caller parse
  } else if (jsonResponse.error) {
    // A 200 status can still carry a quota/rate-limit error in the body.
    // Detect it and surface RATE_LIMIT_REACHED so backoff fires and the
    // email is queued for retry rather than silently dropped.
    if (
      jsonResponse.error.code === 429 ||
      jsonResponse.error.status === "RESOURCE_EXHAUSTED"
    ) {
      throw new Error("RATE_LIMIT_REACHED");
    }
    throw new Error(`Gemini API Error - ${jsonResponse.error.message}`);
  } else {
    throw new Error("Unexpected response format from Gemini API");
  }
}

/**
 * Log Gemini API interaction
 * @param {string} type - Type of interaction (request, response, error)
 * @param {Object} content - Content to log
 */
function logGeminiInteraction(type, content) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp: timestamp,
      type: type,
      content: content
    };

    // Log to console
    Logger.log(`Gemini ${type}: ${JSON.stringify(logEntry)}`);

    // Save to Drive
    if (type === "request" || type === "response") {
      saveGeminiInteractionToDrive(type, content, timestamp);
    }

    // Store errors for later analysis
    if (type === "error") {
      const errors = PropertiesService.getScriptProperties().getProperty("GEMINI_ERRORS");
      const errorList = errors ? JSON.parse(errors) : [];
      errorList.push(logEntry);

      // Keep only last 10 errors
      if (errorList.length > 10) {
        errorList.shift();
      }

      PropertiesService.getScriptProperties().setProperty(
        "GEMINI_ERRORS",
        JSON.stringify(errorList)
      );
    }
  } catch (error) {
    Logger.log(`Error logging Gemini interaction: ${error}`);
  }
}

/**
 * Save Gemini API interactions to Google Drive
 * Request creates a new file, response appends to the same file
 * @param {string} type - "request" or "response"
 * @param {Object} content - Interaction content
 * @param {string} timestamp - ISO timestamp
 */
function saveGeminiInteractionToDrive(type, content, timestamp) {
  try {
    const folderName = "Gemini API Debug Logs";
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    const safeTimestamp = timestamp.replace(/:/g, '-').replace(/\./g, '-');
    const baseFileName = `gemini_${content.operationType || 'unknown'}_${safeTimestamp}`;

    if (type === "request") {
      // Create new file for request
      let fileContent = `=== GEMINI API INTERACTION ===\n`;
      fileContent += `Timestamp: ${timestamp}\n`;
      fileContent += `Operation: ${content.operationType || 'unknown'}\n`;
      fileContent += `\n${'='.repeat(60)}\n\n`;
      fileContent += `PROMPT:\n\n${content.prompt || JSON.stringify(content, null, 2)}\n\n`;
      fileContent += `${'='.repeat(60)}\n\n`;
      fileContent += `RESPONSE:\n\n(waiting for response...)\n`;

      const file = folder.createFile(`${baseFileName}.txt`, fileContent);
      Logger.log(`Created interaction file: ${file.getUrl()}`);

      // Store file ID for response to append to
      PropertiesService.getScriptProperties().setProperty(`GEMINI_FILE_${safeTimestamp}`, file.getId());

    } else if (type === "response") {
      // Find and update the existing file
      const fileId = PropertiesService.getScriptProperties().getProperty(`GEMINI_FILE_${safeTimestamp}`);

      if (fileId) {
        const file = DriveApp.getFileById(fileId);
        const currentContent = file.getBlob().getDataAsString();

        // Replace the "(waiting for response...)" with actual response
        const updatedContent = currentContent.replace(
          '(waiting for response...)',
          `LENGTH: ${content.responseLength || 'unknown'} chars\n\n${content.responseText || 'Response text not available'}`
        );

        file.setContent(updatedContent);
        Logger.log(`Updated interaction file with response: ${file.getUrl()}`);

        // Clean up property
        PropertiesService.getScriptProperties().deleteProperty(`GEMINI_FILE_${safeTimestamp}`);
      } else {
        Logger.log(`Warning: No request file found for timestamp ${safeTimestamp}`);
      }
    }
  } catch (error) {
    Logger.log(`Error saving to Drive: ${error}`);
  }
}

// ===== Additional API Monitoring Functions =====

/**
 * Parse category from Gemini API response
 * @param {string} responseText - Raw response text
 * @returns {string} Category name or 'other'
 */
function parseGeminiCategory(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return 'other';
  }

  try {
    // Remove markdown code blocks
    let cleaned = responseText
      .replace(/```json\n?/g, '')
      .replace(/```javascript\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Remove trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    // Parse JSON
    const data = JSON.parse(cleaned);

    // Extract category (handle both {category: "work"} and nested structures)
    const category = data.category || data.result?.category || 'other';

    // Normalize: lowercase and trim
    return String(category).toLowerCase().trim();

  } catch (error) {
    Logger.log(`Error parsing Gemini category: ${error}`);
    return 'other';
  }
}

/**
 * Check if we can make an API call without exceeding rate limit
 * @returns {boolean} True if we can make a call
 */
function canMakeApiCall() {
  // If no monitor exists, allow calls
  if (typeof API_MONITOR === 'undefined' || !API_MONITOR) {
    return true;
  }

  const now = Date.now();
  const elapsed = now - API_MONITOR.lastResetTime;

  // Reset if more than 60 seconds have passed
  if (elapsed > 60000) {
    resetApiMonitor();
    return true;
  }

  // Check if under rate limit
  const maxCalls = EMAIL_SORTER_CONFIG?.MAX_GEMINI_CALLS_PER_MINUTE || 15;
  return API_MONITOR.requestCount < maxCalls;
}

/**
 * Reset the API call monitor
 */
function resetApiMonitor() {
  if (typeof API_MONITOR !== 'undefined' && API_MONITOR) {
    API_MONITOR.requestCount = 0;
    API_MONITOR.lastResetTime = Date.now();
    Logger.log('API monitor reset');
  }
}

/**
 * Increment API call count
 */
function incrementApiCallCount() {
  if (typeof API_MONITOR !== 'undefined' && API_MONITOR) {
    API_MONITOR.requestCount = (API_MONITOR.requestCount || 0) + 1;
  }
}

/**
 * Get remaining API calls in current window
 * @returns {number} Number of remaining calls
 */
function getRemainingApiCalls() {
  if (typeof API_MONITOR === 'undefined' || !API_MONITOR) {
    return EMAIL_SORTER_CONFIG?.MAX_GEMINI_CALLS_PER_MINUTE || 15;
  }

  const maxCalls = EMAIL_SORTER_CONFIG?.MAX_GEMINI_CALLS_PER_MINUTE || 15;
  const remaining = maxCalls - (API_MONITOR.requestCount || 0);
  return Math.max(0, remaining);
}

/**
 * Get API call statistics
 * @returns {object} Statistics object
 */
function getApiCallStats() {
  if (typeof API_MONITOR === 'undefined' || !API_MONITOR) {
    return {
      totalCalls: 0,
      successCount: 0,
      failureCount: 0,
      currentPeriodCalls: 0,
      resetTime: null
    };
  }

  return {
    totalCalls: API_MONITOR.totalCalls || API_MONITOR.requestCount || 0,
    successCount: API_MONITOR.successCount || 0,
    failureCount: API_MONITOR.failureCount || 0,
    currentPeriodCalls: API_MONITOR.requestCount || 0,
    resetTime: API_MONITOR.lastResetTime ? new Date(API_MONITOR.lastResetTime) : null
  };
}

/**
 * Log API call for monitoring
 * @param {string} endpoint - API endpoint called
 * @param {string} status - 'success' or 'error'
 * @param {number} statusCode - HTTP status code
 * @param {object} metadata - Additional metadata
 * @returns {boolean} True if logged successfully
 */
function logApiCall(endpoint, status, statusCode, metadata = {}) {
  try {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: endpoint,
      status: status,
      statusCode: statusCode,
      ...metadata
    };

    Logger.log(`API Call: ${JSON.stringify(logEntry)}`);

    // Update monitor stats if available
    if (typeof API_MONITOR !== 'undefined' && API_MONITOR) {
      if (status === 'success') {
        API_MONITOR.successCount = (API_MONITOR.successCount || 0) + 1;
      } else {
        API_MONITOR.failureCount = (API_MONITOR.failureCount || 0) + 1;
      }
      API_MONITOR.totalCalls = (API_MONITOR.totalCalls || 0) + 1;
    }

    return true;
  } catch (error) {
    Logger.log(`Error logging API call: ${error}`);
    return false;
  }
}

/**
 * Determine if an error is retryable
 * @param {object} error - Error object with code and message
 * @returns {boolean} True if error should be retried
 */
function isRetryableError(error) {
  if (!error) return false;

  const retryableCodes = [
    429,  // Rate limit
    500,  // Internal server error
    502,  // Bad gateway
    503,  // Service unavailable
    504   // Gateway timeout
  ];

  // Check if error has a code property
  if (error.code && retryableCodes.includes(error.code)) {
    return true;
  }

  // Check status code if available
  if (error.statusCode && retryableCodes.includes(error.statusCode)) {
    return true;
  }

  // Check message for retryable errors
  const message = (error.message || '').toLowerCase();
  const retryableMessages = [
    'timeout',
    'network',
    'connection',
    'rate limit',
    'unavailable'
  ];

  return retryableMessages.some(msg => message.includes(msg));
}

/**
 * Handle and format API errors
 * @param {object|Error} error - Error object
 * @returns {string} Formatted error message
 */
function handleApiError(error) {
  if (!error) {
    return 'Unknown error occurred';
  }

  let message = 'API Error: ';

  // Extract error code if available
  const code = error.code || error.statusCode || 'UNKNOWN';
  message += `[${code}] `;

  // Extract error message
  if (error.message) {
    message += error.message;
  } else if (typeof error === 'string') {
    message += error;
  } else {
    message += 'An error occurred';
  }

  // Add specific handling for common errors
  if (code === 401 || message.toLowerCase().includes('api key')) {
    message += ' - Please check your API key configuration';
  } else if (code === 429 || message.toLowerCase().includes('rate limit')) {
    message += ' - Rate limit exceeded, please wait before retrying';
  }

  // Log the error
  Logger.log(message);

  return message;
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    callGeminiApi,
    callGeminiWithRateLimiting,
    checkRateLimit,
    cleanGeminiResponse,
    callGemini,
    logGeminiInteraction,
    saveGeminiInteractionToDrive,
    parseGeminiCategory,
    canMakeApiCall,
    resetApiMonitor,
    incrementApiCallCount,
    getRemainingApiCalls,
    getApiCallStats,
    logApiCall,
    isRetryableError,
    handleApiError,
    API_MONITOR,
    API_STATE
  };
}
