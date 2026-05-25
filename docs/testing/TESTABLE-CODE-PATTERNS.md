# Testable Code Patterns for Google Apps Script

This guide shows you how to structure your code for better testability, especially when dealing with Google Apps Script's global services.

## Table of Contents

1. [The Problem with Globals](#the-problem-with-globals)
2. [Dependency Injection Pattern](#dependency-injection-pattern)
3. [Factory Pattern](#factory-pattern)
4. [Service Wrapper Pattern](#service-wrapper-pattern)
5. [Testable Function Patterns](#testable-function-patterns)
6. [Real-World Examples](#real-world-examples)

---

## The Problem with Globals

### ❌ Hard to Test

```javascript
// Hard to test - tightly coupled to GmailApp
function sendEmailNotification(to, subject, body) {
  GmailApp.sendEmail(to, subject, body);
}

// In tests: Can't easily mock GmailApp.sendEmail()
```

### ✅ Easy to Test

```javascript
// Easy to test - dependencies are explicit
function sendEmailNotification(to, subject, body, emailService = GmailApp) {
  emailService.sendEmail(to, subject, body);
}

// In tests: Can pass a mock emailService
const mockEmail = { sendEmail: jest.fn() };
sendEmailNotification('test@test.com', 'Hi', 'Hello', mockEmail);
```

---

## Dependency Injection Pattern

### Basic Dependency Injection

**Before (Hard to Test):**
```javascript
function categorizeEmail(emailText) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('API_KEY');
  const response = UrlFetchApp.fetch(API_ENDPOINT, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  return JSON.parse(response.getContentText());
}
```

**After (Easy to Test):**
```javascript
function categorizeEmail(
  emailText,
  services = {
    properties: PropertiesService,
    http: UrlFetchApp
  }
) {
  const apiKey = services.properties
    .getScriptProperties()
    .getProperty('API_KEY');

  const response = services.http.fetch(API_ENDPOINT, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });

  return JSON.parse(response.getContentText());
}

// In production: uses real services (default parameters)
categorizeEmail('Hello world');

// In tests: inject mocks
categorizeEmail('Hello world', {
  properties: mockPropertiesService,
  http: mockUrlFetchApp
});
```

### Advanced Dependency Injection

```javascript
/**
 * Service container for all dependencies
 */
const ServiceContainer = {
  gmail: GmailApp,
  properties: PropertiesService,
  cache: CacheService,
  drive: DriveApp,
  http: UrlFetchApp,
  logger: Logger,

  // Allow overriding for tests
  override: function(serviceName, mock) {
    this[serviceName] = mock;
  },

  reset: function() {
    this.gmail = GmailApp;
    this.properties = PropertiesService;
    this.cache = CacheService;
    this.drive = DriveApp;
    this.http = UrlFetchApp;
    this.logger = Logger;
  }
};

// Use in your code
function processEmails(services = ServiceContainer) {
  const threads = services.gmail.getInboxThreads(0, 10);
  // ... rest of logic
}

// In tests
ServiceContainer.override('gmail', mockGmailApp);
processEmails();
ServiceContainer.reset();
```

---

## Factory Pattern

### Service Factory

**Create a factory for service creation:**

```javascript
/**
 * Factory for creating Gmail service wrapper
 */
function createGmailService(gmailApp = GmailApp) {
  return {
    getInboxThreads: (start, max) => gmailApp.getInboxThreads(start, max),

    searchThreads: (query) => gmailApp.search(query),

    getLabelByName: (name) => gmailApp.getUserLabelByName(name),

    createLabel: (name) => gmailApp.createLabel(name),

    // Add more methods as needed
  };
}

// In production
const gmailService = createGmailService();
gmailService.getInboxThreads(0, 10);

// In tests
const mockGmail = createGmailService({
  getInboxThreads: jest.fn(() => []),
  search: jest.fn(() => []),
  getUserLabelByName: jest.fn(() => null)
});
```

### Configuration Factory

```javascript
/**
 * Factory for creating configuration object
 */
function createConfig(propertiesService = PropertiesService) {
  const props = propertiesService.getScriptProperties();

  return {
    getApiKey: () => props.getProperty('API_KEY'),
    setApiKey: (key) => props.setProperty('API_KEY', key),
    getMaxRetries: () => parseInt(props.getProperty('MAX_RETRIES') || '3'),

    // Convenience methods
    isConfigured: function() {
      return !!this.getApiKey();
    }
  };
}

// Usage
const config = createConfig();
if (!config.isConfigured()) {
  throw new Error('API key not set');
}

// Testing
const testConfig = createConfig({
  getScriptProperties: () => ({
    getProperty: jest.fn((key) => key === 'API_KEY' ? 'test-key' : null),
    setProperty: jest.fn()
  })
});
```

---

## Service Wrapper Pattern

### Wrap External Services

**Create testable wrappers around Google services:**

```javascript
/**
 * Gemini API Service Wrapper
 * Fully testable with dependency injection
 */
class GeminiApiService {
  constructor(config = {}) {
    this.httpClient = config.httpClient || UrlFetchApp;
    this.apiKey = config.apiKey || '';
    this.endpoint = config.endpoint || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite';
    this.logger = config.logger || Logger;
    this.rateLimit = config.rateLimit || 15;
    this.requestCount = 0;
    this.lastReset = Date.now();
  }

  /**
   * Call Gemini API with automatic rate limiting
   */
  async call(prompt) {
    this.enforceRateLimit();

    try {
      const response = this.httpClient.fetch(this.endpoint, {
        method: 'post',
        headers: { 'x-goog-api-key': this.apiKey },
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      this.requestCount++;

      return this.parseResponse(response);

    } catch (error) {
      this.logger.log(`Gemini API error: ${error}`);
      throw error;
    }
  }

  /**
   * Parse API response
   */
  parseResponse(response) {
    const data = JSON.parse(response.getContentText());

    if (!data.candidates || data.candidates.length === 0) {
      return { category: 'other' };
    }

    const text = data.candidates[0].content.parts[0].text;
    return this.cleanAndParse(text);
  }

  /**
   * Clean and parse JSON from response
   */
  cleanAndParse(text) {
    // Remove markdown
    let cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '');

    // Remove trailing commas
    cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

    try {
      return JSON.parse(cleaned);
    } catch {
      return { category: 'other' };
    }
  }

  /**
   * Enforce rate limiting
   */
  enforceRateLimit() {
    const elapsed = Date.now() - this.lastReset;

    if (elapsed > 60000) {
      this.requestCount = 0;
      this.lastReset = Date.now();
    }

    if (this.requestCount >= this.rateLimit) {
      const waitTime = 60000 - elapsed;
      Utilities.sleep(waitTime);
      this.requestCount = 0;
      this.lastReset = Date.now();
    }
  }

  /**
   * Get remaining calls in current window
   */
  getRemainingCalls() {
    return Math.max(0, this.rateLimit - this.requestCount);
  }
}

// Usage in production
const gemini = new GeminiApiService({
  apiKey: getApiKey()
});

const result = gemini.call('Categorize this email...');

// Usage in tests
const mockHttp = { fetch: jest.fn() };
const testGemini = new GeminiApiService({
  httpClient: mockHttp,
  apiKey: 'test-key',
  logger: { log: jest.fn() }
});

// Now easily testable!
```

---

## Testable Function Patterns

### 1. Pure Functions (Best for Testing)

```javascript
// ✅ BEST: Pure function - no side effects
function extractDomain(email) {
  if (!email || typeof email !== 'string') {
    return '';
  }

  const parts = email.split('@');
  return parts.length === 2 ? parts[1] : '';
}

// Easy to test
expect(extractDomain('user@example.com')).toBe('example.com');
expect(extractDomain('invalid')).toBe('');
```

### 2. Separate I/O from Logic

```javascript
// ❌ BAD: Mixed I/O and logic
function categorizeAndSaveEmail(emailId) {
  const email = GmailApp.getMessageById(emailId);
  const category = callGemini(email.getBody());
  PropertiesService.getScriptProperties()
    .setProperty(`category_${emailId}`, category);
  return category;
}

// ✅ GOOD: Separated I/O and logic
function categorizeEmail(emailBody) {
  // Pure logic - easy to test
  const category = determineCategory(emailBody);
  return category;
}

function saveCategory(emailId, category, storage = PropertiesService) {
  // I/O separated - can mock storage
  storage.getScriptProperties()
    .setProperty(`category_${emailId}`, category);
}

function categorizeAndSaveEmail(emailId) {
  // Orchestration - uses testable functions
  const email = GmailApp.getMessageById(emailId);
  const category = categorizeEmail(email.getBody());
  saveCategory(emailId, category);
  return category;
}
```

### 3. Function Composition

```javascript
// Break complex functions into testable pieces

// ✅ Small, testable functions
function cleanEmailBody(body) {
  return body.trim().toLowerCase();
}

function extractKeywords(cleanedBody) {
  return cleanedBody.split(/\s+/).filter(word => word.length > 3);
}

function scoreKeywords(keywords) {
  const scores = { work: 0, personal: 0, finance: 0 };

  keywords.forEach(word => {
    if (WORK_KEYWORDS.includes(word)) scores.work++;
    if (PERSONAL_KEYWORDS.includes(word)) scores.personal++;
    if (FINANCE_KEYWORDS.includes(word)) scores.finance++;
  });

  return scores;
}

function selectTopCategory(scores) {
  return Object.keys(scores)
    .reduce((a, b) => scores[a] > scores[b] ? a : b);
}

// Compose them
function categorizeEmailByKeywords(emailBody) {
  const cleaned = cleanEmailBody(emailBody);
  const keywords = extractKeywords(cleaned);
  const scores = scoreKeywords(keywords);
  return selectTopCategory(scores);
}

// Each piece is independently testable!
```

---

## Real-World Examples

### Example 1: Testable Email Processor

```javascript
/**
 * Email Processor with Dependency Injection
 */
class EmailProcessor {
  constructor(options = {}) {
    this.gmailService = options.gmailService || GmailApp;
    this.apiService = options.apiService || new GeminiApiService();
    this.storage = options.storage || PropertiesService;
    this.logger = options.logger || Logger;
  }

  /**
   * Process unread emails
   */
  processUnreadEmails(maxEmails = 50) {
    const threads = this.gmailService.search('is:unread', 0, maxEmails);

    const results = threads.map(thread => {
      try {
        return this.processThread(thread);
      } catch (error) {
        this.logger.log(`Error processing thread: ${error}`);
        return { success: false, error };
      }
    });

    return {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };
  }

  /**
   * Process a single thread
   */
  processThread(thread) {
    const messages = thread.getMessages();
    const latestMessage = messages[messages.length - 1];

    const category = this.categorizeMessage(latestMessage);
    this.applyCategory(thread, category);

    return { success: true, category };
  }

  /**
   * Categorize a message
   */
  categorizeMessage(message) {
    const from = message.getFrom();
    const body = message.getPlainBody();

    // Check cache first
    const cached = this.getCachedCategory(from);
    if (cached) {
      return cached;
    }

    // Call AI
    const category = this.apiService.call(body);

    // Cache result
    this.cacheCategory(from, category);

    return category;
  }

  /**
   * Apply category label to thread
   */
  applyCategory(thread, category) {
    const label = this.gmailService.getUserLabelByName(category);

    if (label) {
      thread.addLabel(label);
    } else {
      const newLabel = this.gmailService.createLabel(category);
      thread.addLabel(newLabel);
    }
  }

  /**
   * Get cached category
   */
  getCachedCategory(email) {
    const key = `category_${email}`;
    return this.storage.getScriptProperties().getProperty(key);
  }

  /**
   * Cache category
   */
  cacheCategory(email, category) {
    const key = `category_${email}`;
    this.storage.getScriptProperties().setProperty(key, category);
  }
}

// Production usage
const processor = new EmailProcessor();
processor.processUnreadEmails(50);

// Test usage
const testProcessor = new EmailProcessor({
  gmailService: mockGmailService,
  apiService: mockApiService,
  storage: mockStorage,
  logger: mockLogger
});

// Now fully testable!
it('should process unread emails', () => {
  const result = testProcessor.processUnreadEmails(10);
  expect(result.processed).toBe(10);
});
```

### Example 2: Testable Cache Manager

```javascript
/**
 * Cache Manager with swappable backends
 */
class CacheManager {
  constructor(backend = CacheService.getScriptCache()) {
    this.backend = backend;
  }

  get(key) {
    const value = this.backend.get(key);
    return value ? JSON.parse(value) : null;
  }

  set(key, value, expirationInSeconds = 600) {
    const serialized = JSON.stringify(value);
    this.backend.put(key, serialized, expirationInSeconds);
  }

  remove(key) {
    this.backend.remove(key);
  }

  clear() {
    this.backend.removeAll();
  }

  has(key) {
    return this.get(key) !== null;
  }
}

// Production
const cache = new CacheManager();

// Testing with in-memory backend
class InMemoryCache {
  constructor() {
    this.data = new Map();
  }

  get(key) {
    return this.data.get(key);
  }

  put(key, value) {
    this.data.set(key, value);
  }

  remove(key) {
    this.data.delete(key);
  }

  removeAll() {
    this.data.clear();
  }
}

const testCache = new CacheManager(new InMemoryCache());

// Fully testable without Google's CacheService
it('should cache values', () => {
  testCache.set('key', { value: 123 });
  expect(testCache.get('key')).toEqual({ value: 123 });
});
```

---

## Testing Checklist

When writing new code, ask:

- [ ] Can I inject dependencies instead of using globals?
- [ ] Can I separate I/O from business logic?
- [ ] Can I break this into smaller, pure functions?
- [ ] Can I use default parameters for dependencies?
- [ ] Can I create a service wrapper for this external API?
- [ ] Can I use a factory pattern here?
- [ ] Will I be able to mock this in tests?

---

## Migration Strategy

### Step 1: Wrap External Services

Create wrappers for GmailApp, DriveApp, etc.

### Step 2: Add Default Parameters

Add optional parameters with defaults for dependencies.

### Step 3: Extract Pure Functions

Move logic out of I/O-heavy functions.

### Step 4: Create Service Container

Centralize all service dependencies.

### Step 5: Write Tests

Now you can easily test everything!

---

## Further Reading

- [Dependency Injection in JavaScript](https://www.freecodecamp.org/news/a-quick-intro-to-dependency-injection-what-it-is-and-when-to-use-it-7578c84fa88f/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)

---

**Remember:** The goal is to make your code testable WITHOUT changing its behavior in production!
