# VS Code Testing Guide

## 🎯 Quick Answer

**You can test in VS Code:**
- ✅ **All JavaScript logic** - Pure functions, algorithms, data transformations
- ✅ **Configuration** - Settings, validation, constants
- ✅ **Error handling** - Exception catching, error formatting
- ✅ **Data processing** - Parsing, formatting, calculations
- ✅ **Business logic** - Category matching, rule validation, job parsing

**You CANNOT test in VS Code:**
- ❌ **Real Gmail operations** - Requires Google's servers
- ❌ **Drive file operations** - Actual file I/O needs Google Drive
- ❌ **Gemini API calls** - Real API calls (can mock them though!)
- ❌ **Spreadsheet operations** - Real sheets need Google Sheets
- ❌ **Triggers and time-based execution**

## 🚀 Getting Started (5 Minutes)

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- **Jest** - Testing framework
- **ESLint** - Code quality checker
- **Google Apps Script types** - Autocomplete support

### Step 2: Run Your First Test

```bash
npm test
```

You should see output like:
```
 PASS  tests-local/config.test.js
  Config Module - Local Tests
    ✓ should return null when no API key is set (3ms)
    ✓ should accept valid API key (2ms)
    ...

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

### Step 3: Try Watch Mode

```bash
npm run test:watch
```

Now edit a test file - tests re-run automatically! 🎉

## 📊 Testing Levels

### Level 1: Unit Tests (Pure Logic) ✅ **FULLY SUPPORTED**

Test JavaScript functions that don't depend on Google services:

```javascript
// Example: Testing pure logic
describe('Email Parser', () => {
  it('should extract email domain', () => {
    const email = 'user@example.com';
    const domain = extractDomain(email);
    expect(domain).toBe('example.com');
  });
});
```

**What you can test:**
- String manipulation
- Array operations
- Object transformations
- Math calculations
- Validation logic
- Regular expressions

### Level 2: Mocked Integration Tests ✅ **SUPPORTED WITH MOCKS**

Test functions that use Google services, but with mocked responses:

```javascript
// Example: Testing with mocks
describe('API Key Management', () => {
  it('should save API key to properties', () => {
    setApiKey('test-key');

    // PropertiesService is mocked
    expect(PropertiesService.getScriptProperties().setProperty)
      .toHaveBeenCalledWith('API_KEY', 'test-key');
  });
});
```

**What you can test:**
- PropertiesService interactions
- CacheService operations
- Logger calls
- Configuration management
- Data persistence logic

### Level 3: Real Integration Tests ❌ **NOT SUPPORTED LOCALLY**

These require actual Google Apps Script environment:

```javascript
// Example: Needs real Gmail (can't test locally)
function categorizeRealEmails() {
  const threads = GmailApp.search('is:unread');  // Needs real Gmail
  // ... process threads
}
```

**For these, use:**
- Apps Script tests in `/tests/`
- Run `validateBeforePush()` before deployment

## 🔨 Common Testing Scenarios

### Scenario 1: Testing Configuration Functions

**File:** `config.js`

**What to test:**
```javascript
✅ getApiKey()              // Mocked PropertiesService
✅ setApiKey()              // Mocked PropertiesService
✅ isApiKeySet()            // Boolean logic
✅ CONFIG constants         // Static values
✅ Validation logic         // Pure functions
```

**Example test:**
```javascript
it('should validate spreadsheet ID format', () => {
  const validId = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
  const invalidId = 'invalid-id';

  expect(isValidSpreadsheetId(validId)).toBe(true);
  expect(isValidSpreadsheetId(invalidId)).toBe(false);
});
```

### Scenario 2: Testing Data Processing

**File:** `job-finder-extractor.js`

**What to test:**
```javascript
✅ extractJobDetailsSimple()  // Pure logic
✅ parseJobUrl()              // Regex matching
✅ parseSalary()              // String parsing
✅ formatJobRow()             // Data transformation
❌ extractFromGmail()         // Needs real Gmail
```

**Example test:**
```javascript
it('should parse job URL from text', () => {
  const text = 'Apply here: https://company.com/jobs/123';
  const url = parseJobUrl(text);

  expect(url).toBe('https://company.com/jobs/123');
});
```

### Scenario 3: Testing API Integration

**File:** `api-service.js`

**What to test:**
```javascript
✅ cleanGeminiResponse()    // String manipulation
✅ parseGeminiCategory()    // JSON parsing
✅ Rate limiting logic       // Counter management
❌ callGemini()             // Real API (mock it!)
```

**Example test:**
```javascript
it('should extract JSON from markdown code block', () => {
  const response = '```json\n{"category": "work"}\n```';
  const cleaned = cleanGeminiResponse(response);

  expect(cleaned).toContain('{"category": "work"}');
});
```

### Scenario 4: Testing Cache Operations

**File:** `cache-service.js`

**What to test:**
```javascript
✅ Cache key generation      // String operations
✅ Expiration logic          // Time calculations
✅ Data serialization        // JSON operations
✅ Storage operations         // Mocked CacheService
```

**Example test:**
```javascript
it('should serialize and deserialize complex objects', () => {
  const data = { nested: { value: 123 } };
  const serialized = serializeForCache(data);
  const deserialized = deserializeFromCache(serialized);

  expect(deserialized).toEqual(data);
});
```

## 🎭 Working with Mocks

All Google Apps Script globals are pre-mocked in `tests-local/setup.js`.

### Available Mocks

```javascript
Logger.log()                    // ✅ Mocked
PropertiesService.*             // ✅ Mocked
CacheService.*                  // ✅ Mocked
DriveApp.*                      // ✅ Mocked
SpreadsheetApp.*               // ✅ Mocked
GmailApp.*                      // ✅ Mocked
ScriptApp.*                     // ✅ Mocked
UrlFetchApp.fetch()            // ✅ Mocked
Utilities.*                     // ✅ Mocked
Session.*                       // ✅ Mocked
HtmlService.*                   // ✅ Mocked
CardService.*                   // ✅ Mocked
```

### Using Mocks

```javascript
it('should call Logger.log', () => {
  myFunction();

  // Verify Logger was called
  expect(Logger.log).toHaveBeenCalled();
  expect(Logger.log).toHaveBeenCalledWith('Expected message');
});
```

### Customizing Mocks

```javascript
it('should handle API errors', () => {
  // Override mock for this test
  UrlFetchApp.fetch = jest.fn(() => {
    throw new Error('Network error');
  });

  const result = callApi();
  expect(result.success).toBe(false);
});
```

## 🐛 Debugging in VS Code

### Method 1: Breakpoints

1. Click left margin to add breakpoint (red dot)
2. Run test in debug mode
3. Inspect variables when paused

### Method 2: Debug Console

While paused at breakpoint:
- Type variable names to see values
- Execute expressions
- Modify variables

### Method 3: Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest: Current File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["${fileBasename}", "--runInBand"],
      "console": "integratedTerminal"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Jest: All Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand"],
      "console": "integratedTerminal"
    }
  ]
}
```

Then:
1. Press F5
2. Select configuration
3. Tests run in debug mode

## 📈 Test Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

### View Coverage in VS Code

1. Install "Coverage Gutters" extension
2. Run `npm run test:coverage`
3. Click "Watch" in status bar
4. See coverage inline in editor:
   - ✅ Green = covered
   - ❌ Red = not covered
   - 🟡 Yellow = partially covered

### Coverage HTML Report

After running coverage:
```bash
open coverage/lcov-report/index.html
```

See detailed coverage in browser.

## 🔄 TDD Workflow in VS Code

### Test-Driven Development Cycle

1. **Write test** (it will fail)
   ```javascript
   it('should parse email subject', () => {
     const subject = 'Job Alert: Software Engineer';
     const parsed = parseJobSubject(subject);
     expect(parsed.title).toBe('Software Engineer');
   });
   ```

2. **Run test** (see it fail)
   ```bash
   npm run test:watch
   ```

3. **Implement function** (make it pass)
   ```javascript
   function parseJobSubject(subject) {
     const match = subject.match(/Job Alert: (.+)/);
     return { title: match ? match[1] : '' };
   }
   ```

4. **See test pass** ✅

5. **Refactor** (improve code while tests still pass)

6. **Repeat**

## 💡 Best Practices

### DO ✓

```javascript
// ✓ Test pure functions
it('should calculate total', () => {
  expect(sum([1, 2, 3])).toBe(6);
});

// ✓ Test edge cases
it('should handle empty array', () => {
  expect(sum([])).toBe(0);
});

// ✓ Test error conditions
it('should reject invalid input', () => {
  expect(() => sum(null)).toThrow();
});

// ✓ Use descriptive names
it('should extract domain from email address', () => {
  // ...
});
```

### DON'T ✗

```javascript
// ✗ Don't test implementation details
it('should call helper function', () => {
  // Don't test HOW it works, test WHAT it does
});

// ✗ Don't rely on execution order
it('test 1', () => { globalVar = 1; });
it('test 2', () => { expect(globalVar).toBe(1); }); // BAD!

// ✗ Don't skip tests
it.skip('broken test', () => {
  // Fix it or remove it!
});

// ✗ Don't test external APIs directly
it('should call Gemini API', () => {
  const result = callRealGeminiAPI(); // Mock it!
});
```

## 🎯 Testing Checklist

### For Each Module

- [ ] **Pure logic tested** - All algorithms and calculations
- [ ] **Edge cases covered** - Null, undefined, empty, max values
- [ ] **Error handling tested** - All error paths exercised
- [ ] **Mocks used properly** - External dependencies mocked
- [ ] **Coverage >50%** - Maintain minimum threshold
- [ ] **Tests are fast** - Each test <100ms
- [ ] **Tests are independent** - No shared state
- [ ] **Names are descriptive** - Clear what they test

## 🚦 Complete Testing Strategy

### 1. Local Tests (VS Code) - **Fast feedback**

```bash
npm run test:watch
```

- Test pure logic
- Test with mocks
- Get coverage reports
- Debug easily

### 2. Apps Script Tests - **Integration**

In Apps Script Editor:
```javascript
runAllTests()
```

- Test real Google services
- Test actual Gmail
- Test real API calls
- Integration validation

### 3. Pre-Deployment - **Safety check**

In Apps Script Editor:
```javascript
validateBeforePush()
```

- All Apps Script tests pass
- System health verified
- Safe to deploy

### 4. Deploy - **Production**

```bash
clasp push
```

- Code deployed
- Ready for production
- Monitored for issues

## 📊 Summary Table

| Testing Task | Use | Command |
|--------------|-----|---------|
| **Quick logic check** | VS Code | `npm test` |
| **TDD development** | VS Code | `npm run test:watch` |
| **Coverage analysis** | VS Code | `npm run test:coverage` |
| **Debug tests** | VS Code | F5 (debug mode) |
| **Integration tests** | Apps Script | `runAllTests()` |
| **Pre-deployment** | Apps Script | `validateBeforePush()` |
| **Deploy** | Terminal | `clasp push` |

## 🎓 Learning Path

### Beginner
1. Run existing tests: `npm test`
2. Read test examples in `tests-local/`
3. Modify a test and see it fail/pass
4. Write your first test for a new function

### Intermediate
1. Use TDD workflow (`test:watch`)
2. Write tests for edge cases
3. Use mocks effectively
4. Debug failing tests

### Advanced
1. Achieve >60% coverage
2. Write parameterized tests
3. Use snapshot testing
4. Set up CI/CD pipeline

---

## 🆘 Need Help?

- **VS Code testing basics**: See [tests-local/README.md](tests-local/README.md)
- **Apps Script testing**: See [tests/README.md](tests/README.md)
- **General docs**: See [README.md](README.md)
- **Quick start**: See [QUICK-START.md](QUICK-START.md)

---

**Happy Testing! 🧪**
