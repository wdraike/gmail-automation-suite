/**
 * Mock Google Apps Script Services - Main Export
 * Provides complete mock environment for testing
 */

const { MockGmailApp, MockGmailThread, MockGmailMessage, MockGmailLabel } = require('./gmail.mock');
const { MockSpreadsheetApp, MockSpreadsheet, MockSheet, MockRange } = require('./spreadsheet.mock');
const { MockDriveApp, MockFolder, MockFile } = require('./drive.mock');
const { MockUtilities } = require('./utilities.mock');
const { MockPropertiesService } = require('./properties.mock');
const { MockLogger, mockLogger } = require('./logger.mock');

/**
 * Setup global mock environment for Google Apps Script
 * Call this in test setup to inject all mocks into global scope
 */
function setupGoogleMocks() {
  // Create mock instances
  global.GmailApp = new MockGmailApp();
  global.SpreadsheetApp = new MockSpreadsheetApp();
  global.DriveApp = new MockDriveApp();
  global.PropertiesService = new MockPropertiesService();
  global.Logger = mockLogger;
  global.Utilities = MockUtilities;

  // Mock console to use Logger
  global.console = {
    log: (...args) => mockLogger.log(...args),
    info: (...args) => mockLogger.info(...args),
    warn: (...args) => mockLogger.warning(...args),
    error: (...args) => mockLogger.error(...args)
  };
}

/**
 * Reset all mocks to initial state
 * Call this in afterEach or beforeEach to ensure clean state
 */
function resetAllMocks() {
  if (global.GmailApp) global.GmailApp.reset();
  if (global.SpreadsheetApp) global.SpreadsheetApp.reset();
  if (global.DriveApp) global.DriveApp.reset();
  if (global.PropertiesService) global.PropertiesService.reset();
  if (global.Logger) global.Logger.reset();
  if (global.Utilities) global.Utilities.reset();
}

/**
 * Clear all mocks from global scope
 * Call this in test cleanup if needed
 */
function clearGoogleMocks() {
  delete global.GmailApp;
  delete global.SpreadsheetApp;
  delete global.DriveApp;
  delete global.PropertiesService;
  delete global.Logger;
  delete global.Utilities;
  delete global.console;
}

module.exports = {
  // Setup functions
  setupGoogleMocks,
  resetAllMocks,
  clearGoogleMocks,

  // Gmail mocks
  MockGmailApp,
  MockGmailThread,
  MockGmailMessage,
  MockGmailLabel,

  // Spreadsheet mocks
  MockSpreadsheetApp,
  MockSpreadsheet,
  MockSheet,
  MockRange,

  // Drive mocks
  MockDriveApp,
  MockFolder,
  MockFile,

  // Utilities mock
  MockUtilities,

  // Properties mock
  MockPropertiesService,

  // Logger mock
  MockLogger,
  mockLogger
};
