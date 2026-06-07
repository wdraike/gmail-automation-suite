# Complete Test Coverage Plan - Path to 100%

## Executive Summary

**Current Coverage: 24.79%** (3,075 / 12,417 lines covered)
**Target Coverage: 100%** (12,417 lines)
**Gap: 9,342 lines** to test

This plan provides a phased approach to achieve 100% test coverage with proper testing infrastructure, modularization, and reusable test data.

---

## Current Coverage Analysis

### Well-Tested Modules (>40%):
- ✅ **API Service**: 46.38% (good foundation)
- ✅ **Email Sorter Cache**: 67.94% (excellent)
- ✅ **Email Retention**: 57.34% (good)
- ✅ **Gmail Service**: 51.85% (good)
- ✅ **Cache Service**: 40.98% (acceptable)

### Under-Tested Modules (<40%):
- ❌ **Job Finder Modules**: 3.2% overall
  - main.js: 0% (596 lines)
  - extractor.js: 0% (539 lines)
  - sheets-handler.js: 0% (445 lines)
  - csv-handler.js: 10% (partial)

- ❌ **UI Components**: 0%
  - gmail-addon.js: 0% (695 lines)
  - dashboard-api.js: 0% (522 lines)
  - dashboardController.js: 0% (941 lines)

- ❌ **Enhanced Label Manager**: 0% (753 lines)
- ❌ **Email Sorter**: 21.21% (needs improvement)
- ❌ **Label Cache**: 38.53% (needs improvement)

---

## Infrastructure Requirements

### 1. Testing Frameworks & Tools

#### Core Testing Stack (Already Have):
- ✅ **Jest** - Unit testing framework
- ✅ **@types/google-apps-script** - Type definitions

#### Additional Tools Needed:
```json
{
  "devDependencies": {
    "@testing-library/dom": "^9.3.4",           // DOM testing
    "jsdom": "^24.0.0",                         // Browser environment simulation
    "jest-html-reporter": "^3.10.2",            // Better test reports
    "jest-environment-jsdom": "^29.7.0",        // JSDOM environment for Jest
    "@google/clasp": "^2.4.2",                  // Already have
    "sinon": "^17.0.1",                         // Advanced mocking/stubbing
    "nock": "^13.5.0",                          // HTTP request mocking
    "rewire": "^7.0.0",                         // Access private functions
    "mock-fs": "^5.2.0",                        // Mock filesystem
    "puppeteer": "^21.11.0",                    // E2E UI testing (optional)
    "playwright": "^1.41.2"                     // Alternative E2E (optional)
  }
}
```

### 2. Mock Infrastructure Setup

#### Google Apps Script Mock Library (`tests-local/mocks/google-apps-script.js`):
```javascript
// Comprehensive GAS mocks with realistic behavior
class MockGmailApp {
  constructor() {
    this.threads = [];
    this.labels = [];
    this.messages = [];
  }

  getThreadById(id) { /* realistic mock */ }
  getUserLabelByName(name) { /* realistic mock */ }
  search(query, start, max) { /* realistic mock */ }
  sendEmail(to, subject, body) { /* track calls */ }
}

class MockSpreadsheetApp {
  constructor() {
    this.spreadsheets = new Map();
  }

  create(name) { /* return mock spreadsheet */ }
  openById(id) { /* return mock spreadsheet */ }
}

class MockDriveApp {
  constructor() {
    this.files = new Map();
    this.folders = new Map();
  }

  createFile(blob) { /* mock file creation */ }
  getFoldersByName(name) { /* return mock iterator */ }
}

// Export all mocks
module.exports = {
  MockGmailApp,
  MockSpreadsheetApp,
  MockDriveApp,
  MockPropertiesService,
  MockCacheService,
  MockUrlFetchApp,
  MockUtilities,
  MockCardService
};
```

#### Test Data Factory (`tests-local/fixtures/data-factory.js`):
```javascript
// Reusable test data generators
class EmailTestData {
  static createThread(overrides = {}) {
    return {
      id: 'thread-' + Date.now(),
      messages: [this.createMessage()],
      labels: [],
      isUnread: true,
      ...overrides
    };
  }

  static createMessage(overrides = {}) {
    return {
      id: 'msg-' + Date.now(),
      subject: 'Test Subject',
      from: 'test@example.com',
      body: 'Test body content',
      date: new Date(),
      ...overrides
    };
  }

  static createJobEmail(overrides = {}) {
    return this.createMessage({
      subject: 'New Job: Senior Developer at Tech Corp',
      from: 'jobs@indeed.com',
      body: this.jobEmailBody(),
      ...overrides
    });
  }

  static jobEmailBody() {
    return `
      Company: Tech Corp
      Position: Senior Software Engineer
      Location: San Francisco, CA
      Salary: $150,000 - $200,000
      Apply: https://example.com/job/123
    `;
  }
}

class SpreadsheetTestData {
  static createSheet(columns, rows = []) {
    return {
      headers: columns,
      data: rows,
      getRange: jest.fn(),
      appendRow: jest.fn()
    };
  }
}

module.exports = { EmailTestData, SpreadsheetTestData };
```

### 3. Modularization Strategy

#### Dependency Injection Pattern:
```javascript
// BEFORE (tightly coupled):
function processEmails() {
  const threads = GmailApp.search('label:JobAlerts');
  // ...
}

// AFTER (testable):
function processEmails(gmailService = GmailApp) {
  const threads = gmailService.search('label:JobAlerts');
  // ...
}

// In tests:
processEmails(mockGmailService);
```

#### Service Abstraction Layer (`src/core/services/`):
```
src/core/services/
├── gmail-service-adapter.js      // Wraps GmailApp
├── drive-service-adapter.js      // Wraps DriveApp
├── sheets-service-adapter.js     // Wraps SpreadsheetApp
└── properties-service-adapter.js // Wraps PropertiesService
```

Each adapter:
- Provides same interface as GAS API
- Allows injection of mocks
- Adds logging/error handling
- Simplifies testing

---

## Phase-Based Implementation Plan

### **PHASE 1: Foundation & Infrastructure** (Week 1)
**Goal: Set up testing infrastructure and mock system**

#### Tasks:
1. **Install Additional Dependencies**
   ```bash
   npm install --save-dev jsdom sinon nock rewire mock-fs jest-html-reporter
   ```

2. **Create Mock Library Structure**
   - `tests-local/mocks/google-apps-script.js` - Core GAS mocks
   - `tests-local/mocks/gmail-service-mock.js` - Gmail-specific mocks
   - `tests-local/mocks/drive-service-mock.js` - Drive-specific mocks
   - `tests-local/setup-mocks.js` - Auto-setup for all tests

3. **Create Test Data Fixtures**
   - `tests-local/fixtures/data-factory.js` - Data generators
   - `tests-local/fixtures/sample-emails.json` - Email samples
   - `tests-local/fixtures/sample-jobs.json` - Job data samples
   - `tests-local/fixtures/sample-threads.json` - Thread samples

4. **Update Jest Configuration**
   ```javascript
   // jest.config.js additions
   module.exports = {
     // ... existing config
     setupFilesAfterEnv: [
       '<rootDir>/tests-local/setup.js',
       '<rootDir>/tests-local/setup-mocks.js'  // NEW
     ],
     coverageThreshold: {
       global: {
         statements: 100,  // Target
         branches: 100,
         functions: 100,
         lines: 100
       }
     },
     collectCoverageFrom: [
       'src/**/*.js',
       '!src/dev/**',
       '!src/**/*.test.js'
     ]
   };
   ```

5. **Create Service Adapters**
   - Refactor existing code to use adapters
   - Ensure backward compatibility

#### Verification:
- [ ] All mocks can be imported without errors
- [ ] Sample test using mocks passes
- [ ] Coverage report generates correctly
- [ ] Test data factory creates valid objects

---

### **PHASE 2: Job Finder Module** (Week 2)
**Goal: Achieve 100% coverage for job-finder modules**

**Current: 3.2% → Target: 100%**

#### 2.1 Main Module (`main.js` - 0% → 100%)

**Test File:** `tests-local/job-finder-main.test.js`

```javascript
describe('Job Finder Main Module', () => {
  let mockGmail, mockDrive, mockSheets;

  beforeEach(() => {
    mockGmail = new MockGmailApp();
    mockDrive = new MockDriveApp();
    mockSheets = new MockSpreadsheetApp();
  });

  describe('processJobEmailsMain', () => {
    it('should initialize system before processing');
    it('should handle initialization failures gracefully');
    it('should get email threads with 5 email limit');
    it('should skip processing if no threads found');
    it('should process batch of emails successfully');
    it('should handle rate limiting errors');
    it('should return processing statistics');
  });

  describe('getEmailThreadsToProcess', () => {
    it('should fetch max 5 threads');
    it('should prioritize rate-limited threads');
    it('should handle label not found error');
  });

  describe('extractEmailContent', () => {
    it('should parse email subject, body, urls');
    it('should extract plain text from HTML');
    it('should handle missing message data');
  });

  describe('extractJobsFromEmail', () => {
    it('should call Gemini API with email content');
    it('should return parsed job listings');
    it('should detect rate limiting');
  });

  describe('saveJobsToCsv', () => {
    it('should enrich jobs with metadata');
    it('should write to CSV file');
    it('should include all 17 columns');
  });

  describe('markEmailAsProcessed', () => {
    it('should remove source label');
    it('should add processed label');
  });
});
```

**Required Changes:**
- Add dependency injection to all functions
- Extract pure functions for easier testing
- Add error boundary handlers

#### 2.2 Extractor Module (`extractor.js` - 0% → 100%)

**Test File:** `tests-local/job-finder-extractor.test.js`

Focus areas:
- Gemini response parsing
- Job object validation
- URL extraction
- Salary parsing
- Company name extraction
- Fallback extraction logic

#### 2.3 Sheets Handler (`sheets-handler.js` - 0% → 100%)

**Test File:** `tests-local/job-finder-sheets.test.js`

Focus areas:
- Spreadsheet creation
- Row formatting
- Duplicate detection
- Column mapping
- Batch operations

#### Verification Checkpoints:
- [ ] All 3 job-finder modules at 100%
- [ ] Integration test: full job processing flow
- [ ] Mock interactions verified
- [ ] Edge cases covered

---

### **PHASE 3: UI Components** (Week 3)
**Goal: Test UI components with DOM simulation**

**Current: 0% → Target: 100%**

#### 3.1 Gmail Add-on (`gmail-addon.js` - 695 lines)

**Challenge:** Card UI requires CardService mocking

**Test File:** `tests-local/ui-gmail-addon.test.js`

```javascript
// Use JSDOM for DOM testing
const { JSDOM } = require('jsdom');

describe('Gmail Add-on UI', () => {
  let mockCardService;

  beforeEach(() => {
    // Setup JSDOM
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    global.document = dom.window.document;
    global.window = dom.window;

    // Mock CardService
    mockCardService = new MockCardService();
    global.CardService = mockCardService;
  });

  describe('getContextualAddOn', () => {
    it('should return category card when message selected');
    it('should return dashboard card when no message');
    it('should handle initialization errors');
  });

  describe('createCategoryCard', () => {
    it('should display sender information');
    it('should show category suggestions');
    it('should include action buttons');
  });

  describe('applyCategoryAction', () => {
    it('should apply label to thread');
    it('should update categorizer cache');
    it('should show success notification');
  });
});
```

**UI Testing Strategy:**
1. Mock CardService with builder pattern
2. Track all card building calls
3. Verify card structure without rendering
4. Test action handlers independently

#### 3.2 Dashboard (`dashboard-api.js`, `dashboardController.js`)

**Test Files:**
- `tests-local/ui-dashboard-api.test.js`
- `tests-local/ui-dashboard-controller.test.js`

**Approach:**
- Mock HtmlService
- Test data transformation logic
- Verify API responses
- Test error handling

#### 3.3 UI Integration Tests (Optional - E2E)

**Using Puppeteer/Playwright:**
```javascript
// tests-local/e2e/gmail-addon-e2e.test.js
describe('Gmail Add-on E2E', () => {
  it('should categorize email in Gmail UI', async () => {
    // Launch browser
    // Navigate to Gmail
    // Open add-on
    // Select category
    // Verify label applied
  });
});
```

**Note:** E2E tests optional - focus on unit tests first

#### Verification:
- [ ] All UI components at 100%
- [ ] Card building logic tested
- [ ] Action handlers verified
- [ ] Error states covered

---

### **PHASE 4: Utility & Support Modules** (Week 4)
**Goal: Complete remaining modules**

#### 4.1 Enhanced Label Manager (`enhanced-label-manager.js` - 753 lines)

**Test File:** `tests-local/enhanced-label-manager.test.js`

Coverage areas:
- Label creation/deletion
- Hierarchy management
- Color assignment
- Bulk operations
- Error recovery

#### 4.2 Label Cache (`label-cache.js` - 38% → 100%)

**Test File:** `tests-local/label-cache.test.js` (enhance existing)

Add missing coverage:
- Cache invalidation
- Refresh logic
- Error handling
- Concurrent access

#### 4.3 Email Sorter (`sorter.js` - 21% → 100%)

**Test File:** `tests-local/email-sorter.test.js` (enhance existing)

Add missing:
- Prompt building variations
- Category parsing edge cases
- Label application logic
- Batch processing

#### Verification:
- [ ] All utility modules at 100%
- [ ] Integration tests pass
- [ ] Performance acceptable

---

### **PHASE 5: Integration & Regression** (Week 5)
**Goal: End-to-end testing and regression prevention**

#### 5.1 Cross-Module Integration Tests

**Test File:** `tests-local/integration/full-workflow.test.js`

```javascript
describe('Full System Integration', () => {
  it('should process job email from inbox to spreadsheet', async () => {
    // Setup: Create mock email in inbox
    // Process: Run job finder
    // Verify: Job in spreadsheet
    // Verify: Email labeled as processed
    // Verify: CSV created in Drive
  });

  it('should categorize email and apply label', async () => {
    // Setup: Create uncategorized email
    // Process: Run email sorter
    // Verify: Label applied
    // Verify: Cache updated
  });

  it('should handle retention policy execution', async () => {
    // Setup: Create old emails
    // Process: Run retention manager
    // Verify: Old emails deleted/archived
  });
});
```

#### 5.2 Regression Test Suite

**Test File:** `tests-local/regression/known-bugs.test.js`

Document and test all previously found bugs:
- CSV substring matching bug
- Rate limiting issues
- Duplicate job detection
- Email parsing edge cases

#### 5.3 Performance Tests

**Test File:** `tests-local/performance/benchmarks.test.js`

```javascript
describe('Performance Benchmarks', () => {
  it('should process 100 emails in under 30 seconds');
  it('should import 1000 row CSV in under 10 seconds');
  it('should cache 500 labels in under 2 seconds');
});
```

#### Verification:
- [ ] All integration tests pass
- [ ] No regression in existing functionality
- [ ] Performance within acceptable limits

---

## Test Data Management Strategy

### 1. Fixture Organization

```
tests-local/fixtures/
├── emails/
│   ├── job-alerts/
│   │   ├── indeed-email.json
│   │   ├── linkedin-email.json
│   │   └── glassdoor-email.json
│   ├── regular/
│   │   ├── work-email.json
│   │   ├── personal-email.json
│   │   └── newsletter-email.json
│   └── edge-cases/
│       ├── malformed-html.json
│       ├── no-subject.json
│       └── huge-body.json
├── spreadsheets/
│   ├── job-listings-sample.json
│   └── empty-sheet.json
├── csv/
│   ├── valid-17-columns.csv
│   ├── old-9-columns.csv
│   └── malformed.csv
└── api-responses/
    ├── gemini-success.json
    ├── gemini-rate-limit.json
    └── gemini-error.json
```

### 2. Data Factory Patterns

```javascript
// tests-local/fixtures/factories/email-factory.js
class EmailFactory {
  static jobAlert(company, title, location) {
    return {
      id: generateId(),
      subject: `New Job: ${title} at ${company}`,
      from: 'jobs@indeed.com',
      body: this.jobAlertBody(company, title, location),
      date: new Date(),
      labels: ['JobAlerts']
    };
  }

  static withAttachments(count = 1) {
    return {
      ...this.basic(),
      attachments: Array(count).fill(null).map(() => ({
        name: 'resume.pdf',
        type: 'application/pdf',
        data: 'mock-data'
      }))
    };
  }

  static thread(messageCount = 3) {
    return {
      id: generateId(),
      messages: Array(messageCount).fill(null).map(() => this.basic()),
      isUnread: true
    };
  }
}
```

### 3. Snapshot Testing

For complex objects and UI:
```javascript
it('should generate correct job spreadsheet row', () => {
  const job = createJobObject(sampleJobData);
  const row = formatJobRow(job);

  expect(row).toMatchSnapshot();
});
```

---

## Continuous Testing Workflow

### 1. Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:changed && npm run lint"
    }
  },
  "scripts": {
    "test:changed": "jest --onlyChanged --bail"
  }
}
```

### 2. Coverage Gates

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100
  },
  // Per-file thresholds (enforce incrementally)
  './src/features/job-finder/main.js': {
    statements: 100,
    branches: 100,
    functions: 100,
    lines: 100
  }
}
```

### 3. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Dependencies
        run: npm ci
      - name: Run Tests
        run: npm test -- --coverage
      - name: Upload Coverage
        uses: codecov/codecov-action@v3
```

---

## Testing Best Practices

### 1. Test Structure (AAA Pattern)

```javascript
describe('Feature Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = createTestData();
    const expected = expectedResult();

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toEqual(expected);
  });
});
```

### 2. Isolation Principles

- Each test independent
- No shared state between tests
- Mock external dependencies
- Use `beforeEach` for setup
- Use `afterEach` for cleanup

### 3. Naming Conventions

```javascript
// Good test names
it('should return empty array when no emails found');
it('should throw error when API key is missing');
it('should retry 3 times on rate limit error');

// Bad test names
it('works');
it('test email processing');
it('handles errors');
```

---

## Success Metrics

### Phase Completion Criteria

**Phase 1:** ✅ Infrastructure
- All mocks created and tested
- Test data fixtures available
- Coverage reporting works

**Phase 2:** ✅ Job Finder 100%
- main.js: 100%
- extractor.js: 100%
- sheets-handler.js: 100%
- csv-handler.js: 100%

**Phase 3:** ✅ UI Components 100%
- gmail-addon.js: 100%
- dashboard-api.js: 100%
- dashboardController.js: 100%

**Phase 4:** ✅ Utilities 100%
- enhanced-label-manager.js: 100%
- label-cache.js: 100%
- sorter.js: 100%

**Phase 5:** ✅ Integration
- All integration tests pass
- Regression suite complete
- Performance benchmarks met

### Final Success Criteria

- [ ] **100% code coverage** across all modules
- [ ] **0 failing tests** in CI/CD
- [ ] **< 5 second** test suite execution
- [ ] **All edge cases** documented and tested
- [ ] **Regression suite** prevents known bugs
- [ ] **Documentation** updated with testing guide

---

## Timeline & Resource Allocation

| Phase | Duration | Primary Focus | Tests to Write | Expected Coverage Gain |
|-------|----------|---------------|----------------|----------------------|
| 1 | Week 1 | Infrastructure | ~50 | 0% → 30% |
| 2 | Week 2 | Job Finder | ~200 | 30% → 60% |
| 3 | Week 3 | UI Components | ~150 | 60% → 85% |
| 4 | Week 4 | Utilities | ~100 | 85% → 95% |
| 5 | Week 5 | Integration | ~50 | 95% → 100% |

**Total: ~550 new tests to write**

---

## Risk Mitigation

### Identified Risks:

1. **UI Testing Complexity**
   - Mitigation: Focus on logic testing, mock UI frameworks

2. **GAS API Limitations**
   - Mitigation: Comprehensive mocks, adapter pattern

3. **Time Constraints**
   - Mitigation: Phased approach, prioritize critical modules

4. **Breaking Changes**
   - Mitigation: Incremental refactoring, feature flags

5. **Flaky Tests**
   - Mitigation: Strict isolation, no time dependencies

---

## Appendix: Quick Start Commands

```bash
# Install all dependencies
npm install

# Run tests with coverage
npm run test:coverage

# Run specific phase tests
npm test -- tests-local/job-finder-*.test.js

# Watch mode for development
npm run test:watch

# Generate HTML coverage report
npm run test:coverage && open coverage/index.html

# Run only changed files
npm test -- --onlyChanged

# Update snapshots
npm test -- -u
```

---

**This plan provides a clear, testable, and verifiable path to 100% test coverage in 5 weeks with infrastructure that supports long-term maintainability.**
