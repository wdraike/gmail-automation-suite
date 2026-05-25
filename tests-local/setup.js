/**
 * Jest Setup File for Google Apps Script Testing
 * Mocks Google Apps Script global objects and services
 */

// Mock Logger
global.Logger = {
  log: jest.fn((...args) => {
    if (process.env.DEBUG) {
      console.log('[Logger]', ...args);
    }
  })
};

// Mock PropertiesService
const mockProperties = new Map();

global.PropertiesService = {
  getScriptProperties: jest.fn(() => ({
    getProperty: jest.fn((key) => mockProperties.get(key) || null),
    setProperty: jest.fn((key, value) => mockProperties.set(key, value)),
    deleteProperty: jest.fn((key) => mockProperties.delete(key)),
    deleteAllProperties: jest.fn(() => mockProperties.clear()),
    getProperties: jest.fn(() => Object.fromEntries(mockProperties))
  })),
  getUserProperties: jest.fn(() => ({
    getProperty: jest.fn(),
    setProperty: jest.fn(),
    deleteProperty: jest.fn()
  }))
};

// Mock CacheService
const mockCache = new Map();
const mockCacheWithExpiry = new Map();

global.CacheService = {
  getScriptCache: jest.fn(() => ({
    get: jest.fn((key) => {
      const entry = mockCacheWithExpiry.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiry) {
        mockCacheWithExpiry.delete(key);
        return null;
      }
      return entry.value;
    }),
    put: jest.fn((key, value, expirationInSeconds = 600) => {
      mockCacheWithExpiry.set(key, {
        value,
        expiry: Date.now() + (expirationInSeconds * 1000)
      });
    }),
    remove: jest.fn((key) => mockCacheWithExpiry.delete(key)),
    removeAll: jest.fn(() => mockCacheWithExpiry.clear())
  })),
  getUserCache: jest.fn(() => ({
    get: jest.fn(),
    put: jest.fn(),
    remove: jest.fn()
  }))
};

// Mock DriveApp
global.DriveApp = {
  createFile: jest.fn((name, content, mimeType) => ({
    getId: jest.fn(() => 'mock-file-id-' + Date.now()),
    getName: jest.fn(() => name),
    getUrl: jest.fn(() => 'https://drive.google.com/file/mock')
  })),
  getFileById: jest.fn((id) => ({
    getId: jest.fn(() => id),
    getBlob: jest.fn(() => ({
      getDataAsString: jest.fn(() => '{}')
    })),
    setContent: jest.fn()
  })),
  getFolderById: jest.fn(),
  getRootFolder: jest.fn()
};

// Mock SpreadsheetApp
global.SpreadsheetApp = {
  openById: jest.fn((id) => ({
    getId: jest.fn(() => id),
    getSheetByName: jest.fn((name) => ({
      getName: jest.fn(() => name),
      getRange: jest.fn(),
      appendRow: jest.fn(),
      getDataRange: jest.fn(() => ({
        getValues: jest.fn(() => [])
      }))
    })),
    insertSheet: jest.fn()
  })),
  create: jest.fn(),
  getActiveSpreadsheet: jest.fn()
};

// Mock GmailApp
global.GmailApp = {
  search: jest.fn(() => []),
  getUserLabelByName: jest.fn((name) => ({
    getName: jest.fn(() => name),
    addToThread: jest.fn(),
    removeFromThread: jest.fn()
  })),
  createLabel: jest.fn((name) => ({
    getName: jest.fn(() => name)
  })),
  getUserLabels: jest.fn(() => []),
  getInboxThreads: jest.fn(() => []),
  getStarredThreads: jest.fn(() => [])
};

// Mock ScriptApp
global.ScriptApp = {
  getScriptId: jest.fn(() => 'mock-script-id'),
  getService: jest.fn(() => ({
    getUrl: jest.fn(() => 'https://script.google.com/macros/mock')
  })),
  newTrigger: jest.fn(() => ({
    timeBased: jest.fn(() => ({
      everyHours: jest.fn(() => ({
        create: jest.fn()
      })),
      everyDays: jest.fn(() => ({
        atHour: jest.fn(() => ({
          create: jest.fn()
        }))
      }))
    }))
  })),
  getProjectTriggers: jest.fn(() => []),
  deleteTrigger: jest.fn()
};

// Mock UrlFetchApp
global.UrlFetchApp = {
  fetch: jest.fn((url, options) => {
    // Mock successful API response
    const mockResponse = {
      candidates: [{
        content: {
          parts: [{
            text: '{"category": "other"}'
          }]
        }
      }]
    };

    return {
      getResponseCode: jest.fn(() => 200),
      getContentText: jest.fn(() => JSON.stringify(mockResponse))
    };
  })
};

// Mock Utilities
global.Utilities = {
  sleep: jest.fn((ms) => {
    // Don't actually sleep in tests
  }),
  getUuid: jest.fn(() => 'mock-uuid-' + Date.now()),
  formatDate: jest.fn((date) => date.toISOString()),
  jsonStringify: jest.fn((obj) => JSON.stringify(obj)),
  jsonParse: jest.fn((str) => JSON.parse(str)),
  base64Encode: jest.fn((str) => Buffer.from(str).toString('base64')),
  base64Decode: jest.fn((str) => Buffer.from(str, 'base64').toString())
};

// Mock Session
global.Session = {
  getActiveUser: jest.fn(() => ({
    getEmail: jest.fn(() => 'test@example.com')
  })),
  getEffectiveUser: jest.fn(() => ({
    getEmail: jest.fn(() => 'test@example.com')
  }))
};

// Mock HtmlService
global.HtmlService = {
  createHtmlOutput: jest.fn((html) => ({
    setTitle: jest.fn().mockReturnThis(),
    setWidth: jest.fn().mockReturnThis(),
    setHeight: jest.fn().mockReturnThis(),
    getContent: jest.fn(() => html)
  })),
  createHtmlOutputFromFile: jest.fn((filename) => ({
    getContent: jest.fn(() => `<div>Mock content from ${filename}</div>`)
  })),
  createTemplateFromFile: jest.fn((filename) => ({
    evaluate: jest.fn(() => ({
      setTitle: jest.fn().mockReturnThis(),
      setFaviconUrl: jest.fn().mockReturnThis()
    }))
  }))
};

// Mock CardService
global.CardService = {
  newCardBuilder: jest.fn(() => ({
    build: jest.fn()
  })),
  newActionResponseBuilder: jest.fn(() => ({
    setNotification: jest.fn().mockReturnThis(),
    setNavigation: jest.fn().mockReturnThis(),
    build: jest.fn()
  })),
  newNotification: jest.fn(() => ({
    setText: jest.fn().mockReturnThis()
  })),
  newNavigation: jest.fn(() => ({
    popToRoot: jest.fn().mockReturnThis()
  }))
};

// Mock MimeType
global.MimeType = {
  PLAIN_TEXT: 'text/plain',
  HTML: 'text/html',
  JSON: 'application/json'
};

// Helper to reset all mocks
global.resetAllMocks = () => {
  mockProperties.clear();
  mockCache.clear();
  mockCacheWithExpiry.clear();
  jest.clearAllMocks();
};

// Run before each test
beforeEach(() => {
  // Don't clear mocks automatically - let tests control this
});

// Run after each test
afterEach(() => {
  // Optional: Clear mocks after each test
  // global.resetAllMocks();
});
