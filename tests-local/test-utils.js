/**
 * Test Utilities and Helpers
 * Reusable testing functions and mock factories
 */

/**
 * Load a Google Apps Script file for testing
 * Handles const declarations by making them global
 *
 * @param {string} filename - Name of the .js file (e.g., 'config.js')
 * @returns {object} Exported constants and functions
 */
function loadGasModule(filename) {
  const fs = require('fs');
  const path = require('path');

  const code = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');

  // Extract all const declarations
  const constPattern = /^const\s+([A-Z_][A-Z0-9_]*)\s*=/gm;
  const constants = [];
  let match;

  while ((match = constPattern.exec(code)) !== null) {
    constants.push(match[1]);
  }

  // Replace const with global for each constant
  let modifiedCode = code;
  constants.forEach(constName => {
    modifiedCode = modifiedCode.replace(
      new RegExp(`^const ${constName}`, 'm'),
      `global.${constName}`
    );
  });

  // Execute the code
  eval(modifiedCode);

  // Return the constants as an object
  const exports = {};
  constants.forEach(constName => {
    exports[constName] = global[constName];
  });

  return exports;
}

/**
 * Create a mock Gemini API response
 *
 * @param {string} category - Category to return
 * @param {object} options - Additional options
 * @returns {object} Mock API response
 */
function createMockGeminiResponse(category = 'other', options = {}) {
  const {
    confidence = 0.95,
    useMarkdown = false,
    includeTrailingComma = false,
    malformed = false
  } = options;

  if (malformed) {
    return {
      candidates: [{ content: { parts: [{ text: 'Not valid JSON' }] } }]
    };
  }

  let jsonText = `{"category": "${category}", "confidence": ${confidence}`;

  if (includeTrailingComma) {
    jsonText += ',}';
  } else {
    jsonText += '}';
  }

  if (useMarkdown) {
    jsonText = `\`\`\`json\n${jsonText}\n\`\`\``;
  }

  return {
    candidates: [{
      content: {
        parts: [{
          text: jsonText
        }]
      }
    }]
  };
}

/**
 * Create a mock error response from Gemini API
 *
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @returns {object} Mock error response
 */
function createMockGeminiError(statusCode = 500, message = 'Internal server error') {
  return {
    error: {
      code: statusCode,
      message: message,
      status: statusCode === 429 ? 'RESOURCE_EXHAUSTED' : 'INTERNAL'
    }
  };
}

/**
 * Mock UrlFetchApp for Gemini API calls
 *
 * @param {string|object} response - Response to return (category string or full response object)
 * @param {number} statusCode - HTTP status code
 * @returns {jest.Mock} Mocked fetch function
 */
function mockGeminiApi(response = 'other', statusCode = 200) {
  let responseObj;

  if (typeof response === 'string') {
    responseObj = createMockGeminiResponse(response);
  } else {
    responseObj = response;
  }

  UrlFetchApp.fetch = jest.fn(() => ({
    getResponseCode: jest.fn(() => statusCode),
    getContentText: jest.fn(() => JSON.stringify(responseObj))
  }));

  return UrlFetchApp.fetch;
}

/**
 * Mock UrlFetchApp to throw an error
 *
 * @param {string} errorMessage - Error message
 * @returns {jest.Mock} Mocked fetch function
 */
function mockGeminiApiError(errorMessage = 'Network error') {
  UrlFetchApp.fetch = jest.fn(() => {
    throw new Error(errorMessage);
  });

  return UrlFetchApp.fetch;
}

/**
 * Create a mock Gmail thread
 *
 * @param {object} options - Thread options
 * @returns {object} Mock thread
 */
function createMockGmailThread(options = {}) {
  const {
    from = 'sender@example.com',
    subject = 'Test Email',
    body = 'Test email body',
    isUnread = true,
    labels = [],
    date = new Date()
  } = options;

  return {
    getId: jest.fn(() => 'thread-id-' + Date.now()),
    isUnread: jest.fn(() => isUnread),
    getMessages: jest.fn(() => [createMockGmailMessage({ from, subject, body, date })]),
    getLabels: jest.fn(() => labels.map(name => ({ getName: () => name }))),
    addLabel: jest.fn(),
    removeLabel: jest.fn(),
    markRead: jest.fn(),
    moveToTrash: jest.fn(),
    moveToArchive: jest.fn()
  };
}

/**
 * Create a mock Gmail message
 *
 * @param {object} options - Message options
 * @returns {object} Mock message
 */
function createMockGmailMessage(options = {}) {
  const {
    from = 'sender@example.com',
    to = 'recipient@example.com',
    subject = 'Test Subject',
    body = 'Test body content',
    date = new Date(),
    isUnread = true
  } = options;

  return {
    getId: jest.fn(() => 'msg-id-' + Date.now()),
    getFrom: jest.fn(() => from),
    getTo: jest.fn(() => to),
    getSubject: jest.fn(() => subject),
    getPlainBody: jest.fn(() => body),
    getDate: jest.fn(() => date),
    isUnread: jest.fn(() => isUnread),
    getThread: jest.fn(() => createMockGmailThread(options))
  };
}

/**
 * Create a mock spreadsheet
 *
 * @param {array} data - Initial data
 * @returns {object} Mock spreadsheet
 */
function createMockSpreadsheet(data = []) {
  const sheetData = [...data];

  return {
    getId: jest.fn(() => 'spreadsheet-id-123'),
    getName: jest.fn(() => 'Test Spreadsheet'),
    getSheetByName: jest.fn((name) => ({
      getName: jest.fn(() => name),
      getRange: jest.fn(() => ({
        getValues: jest.fn(() => sheetData),
        setValues: jest.fn((values) => { sheetData.push(...values); })
      })),
      appendRow: jest.fn((row) => { sheetData.push(row); }),
      getLastRow: jest.fn(() => sheetData.length),
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => sheetData)
      }))
    })),
    insertSheet: jest.fn((name) => ({
      getName: jest.fn(() => name)
    }))
  };
}

/**
 * Wait for async operations in tests
 *
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after ms
 */
function waitFor(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Run a test multiple times with different inputs
 *
 * @param {string} description - Test description
 * @param {array} testCases - Array of [input, expected] pairs
 * @param {function} testFn - Test function (input, expected) => void
 */
function runParameterizedTest(description, testCases, testFn) {
  describe(description, () => {
    testCases.forEach(([input, expected], index) => {
      it(`case ${index + 1}: ${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
        testFn(input, expected);
      });
    });
  });
}

/**
 * Assert that a function logs a specific message
 *
 * @param {function} fn - Function to test
 * @param {string|RegExp} expectedMessage - Expected log message
 */
function expectToLog(fn, expectedMessage) {
  const mockLogger = jest.spyOn(Logger, 'log');

  fn();

  if (expectedMessage instanceof RegExp) {
    const calls = mockLogger.mock.calls.flat();
    const found = calls.some(call => expectedMessage.test(String(call)));
    expect(found).toBe(true);
  } else {
    expect(mockLogger).toHaveBeenCalledWith(expect.stringContaining(expectedMessage));
  }

  mockLogger.mockRestore();
}

/**
 * Reset all PropertiesService data
 */
function resetPropertiesService() {
  PropertiesService.getScriptProperties().deleteAllProperties();
}

/**
 * Reset all CacheService data
 */
function resetCacheService() {
  CacheService.getScriptCache().removeAll();
}

/**
 * Reset all test state
 */
function resetAllTestState() {
  jest.clearAllMocks();
  resetPropertiesService();
  resetCacheService();

  // Reset API monitor if it exists
  if (typeof API_MONITOR !== 'undefined') {
    API_MONITOR.requestCount = 0;
    API_MONITOR.lastResetTime = Date.now();
  }
}

/**
 * Create a spy on a global function
 *
 * @param {string} functionName - Name of the global function
 * @returns {jest.SpyInstance} Spy instance
 */
function spyOnGlobal(functionName) {
  const original = global[functionName];
  const spy = jest.fn(original);
  global[functionName] = spy;

  return {
    spy,
    restore: () => { global[functionName] = original; }
  };
}

/**
 * Time a function execution
 *
 * @param {function} fn - Function to time
 * @returns {object} { result, duration }
 */
function timeExecution(fn) {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;

  return { result, duration };
}

/**
 * Assert that execution takes less than a certain time
 *
 * @param {function} fn - Function to test
 * @param {number} maxMs - Maximum milliseconds
 */
function expectFastExecution(fn, maxMs = 100) {
  const { duration } = timeExecution(fn);
  expect(duration).toBeLessThan(maxMs);
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadGasModule,
    createMockGeminiResponse,
    createMockGeminiError,
    mockGeminiApi,
    mockGeminiApiError,
    createMockGmailThread,
    createMockGmailMessage,
    createMockSpreadsheet,
    waitFor,
    runParameterizedTest,
    expectToLog,
    resetPropertiesService,
    resetCacheService,
    resetAllTestState,
    spyOnGlobal,
    timeExecution,
    expectFastExecution
  };
}
