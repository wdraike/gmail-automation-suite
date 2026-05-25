# Testing Infrastructure

This directory contains the complete testing infrastructure for the Gmail Automation project.

## Files

- **test-framework.js** - Core testing framework (Jest/Mocha-like for Google Apps Script)
- **test-runner.js** - Test execution and reporting system
- **categorization.test.js** - Tests for email categorization module
- **retention.test.js** - Tests for email retention module
- **cache.test.js** - Tests for cache and storage operations
- **api.test.js** - Tests for Gemini API integration
- **job-finder.test.js** - Tests for job alert processing

## Quick Start

### Running All Tests

```javascript
runAllTests()
```

This will execute all test suites and display results in the Apps Script console.

### Pre-Deployment Validation

**IMPORTANT: Run this before every `clasp push`**

```javascript
validateBeforeDeploy()
```

This function:
- Runs all tests
- Generates a comprehensive report
- Returns `true` if safe to deploy, `false` if tests fail
- Shows clear pass/fail status with ASCII art

### Running Specific Module Tests

```javascript
// Test only categorization
runTestsForModule('categorization')

// Test only retention
runTestsForModule('retention')

// Test only cache
runTestsForModule('cache')

// Test only API
runTestsForModule('api')
```

### Quick Smoke Test

For rapid validation during development:

```javascript
runSmokeTests()
```

Runs only critical tests to verify basic functionality.

## Test Framework API

### Defining Test Suites

```javascript
describe('Feature Name', () => {
  it('should do something', () => {
    expect.value(actualValue).toBe(expectedValue);
  });
});
```

### Setup and Teardown

```javascript
describe('Test Suite', () => {
  beforeEach(() => {
    // Runs before each test
  });

  afterEach(() => {
    // Runs after each test
  });

  it('test case', () => {
    // Your test code
  });
});
```

### Assertions

```javascript
// Equality
expect.value(actual).toBe(expected)        // Strict equality (===)
expect.value(actual).toEqual(expected)     // Deep equality (JSON comparison)

// Truthiness
expect.value(value).toBeTruthy()
expect.value(value).toBeFalsy()
expect.value(value).toBeNull()
expect.value(value).toBeUndefined()

// Comparisons
expect.value(num).toBeGreaterThan(5)
expect.value(num).toBeLessThan(10)

// Arrays and Strings
expect.value(array).toContain(item)
expect.value(array).toHaveLength(3)

// Objects
expect.value(obj).toHaveProperty('key')
expect.value(obj).toHaveProperty('key', 'value')

// Exceptions
expect.value(() => { throw new Error('test') }).toThrow()
expect.value(() => { throw new Error('test') }).toThrow('test')
```

## Writing New Tests

### 1. Create Test File

Create a new file in `/tests/` directory:

```javascript
/**
 * Unit Tests for My New Feature
 */

describe('My Feature', () => {
  describe('specific function', () => {
    it('should behave correctly', () => {
      const result = myFunction(input);
      expect.value(result).toBe(expectedOutput);
    });
  });
});
```

### 2. Follow Testing Best Practices

- **Isolate tests** - Each test should be independent
- **Test one thing** - Each test should verify one behavior
- **Use descriptive names** - Test names should explain what they verify
- **Clean up** - Remove test data in `afterEach` hooks
- **Don't test external APIs** - Mock or stub external dependencies

### 3. Add to Test Runner

The test runner automatically picks up all test files. No configuration needed.

## Test Coverage

### Current Coverage by Module

| Module | Test File | Functions Tested | Coverage |
|--------|-----------|------------------|----------|
| Categorization | categorization.test.js | 15+ | ~60% |
| Retention | retention.test.js | 10+ | ~55% |
| Cache | cache.test.js | 12+ | ~50% |
| API | api.test.js | 12+ | ~50% |
| Job Finder | job-finder.test.js | 15+ | ~45% |

### Coverage Goals

- **Short term**: 60% coverage across all modules
- **Medium term**: 75% coverage
- **Long term**: 85% coverage with integration tests

## CI/CD Integration

### Manual Workflow

1. Make code changes
2. Run `runAllTests()` in Apps Script editor
3. Verify all tests pass
4. Run `validateBeforeDeploy()`
5. If validation passes, run `clasp push`

### Automated Workflow (Future)

Set up automated testing:

```javascript
setupTestWatcher()
```

This creates a trigger to run tests every hour automatically.

To remove:

```javascript
removeTestWatcher()
```

## Test Reports

### Console Report

Default output when running tests - shows in Apps Script logs.

### HTML Report

Generate a visual HTML report:

```javascript
const htmlReport = generateHtmlTestReport();
// Open in a modal or new window
```

### Save Results

Save test results to Google Drive:

```javascript
const fileId = saveTestResults(runAllTests());
// Results saved as JSON file
```

## Troubleshooting

### Tests Timing Out

If tests take too long:
- Reduce test data size
- Mock external API calls
- Split large test suites
- Use `runSmokeTests()` for quick validation

### Tests Failing After Changes

1. Check if breaking changes affected dependencies
2. Update tests to match new behavior
3. Verify test cleanup is working (check `afterEach`)
4. Look for race conditions or async issues

### Flaky Tests

If tests pass sometimes and fail other times:
- Check for shared state between tests
- Ensure proper cleanup in `afterEach`
- Avoid time-dependent assertions
- Don't rely on external data

## Best Practices

### DO ✓

- Write tests before fixing bugs (TDD)
- Keep tests simple and readable
- Test edge cases and error conditions
- Use meaningful test descriptions
- Clean up test data after each test
- Run tests before committing code

### DON'T ✗

- Test implementation details
- Write tests that depend on execution order
- Leave test data in production properties
- Skip tests (fix or remove them)
- Test external APIs directly
- Commit code with failing tests

## Examples

### Testing a Pure Function

```javascript
describe('calculateTotal', () => {
  it('should sum array of numbers', () => {
    const numbers = [1, 2, 3, 4, 5];
    const result = calculateTotal(numbers);
    expect.value(result).toBe(15);
  });

  it('should handle empty array', () => {
    expect.value(calculateTotal([])).toBe(0);
  });

  it('should handle negative numbers', () => {
    expect.value(calculateTotal([-1, -2, -3])).toBe(-6);
  });
});
```

### Testing with Setup/Teardown

```javascript
describe('Category Manager', () => {
  let testCategory;

  beforeEach(() => {
    testCategory = 'test_' + new Date().getTime();
    addCategory(testCategory, 'Test', 'TestLabel');
  });

  afterEach(() => {
    deleteCategory(testCategory);
  });

  it('should add emails to category', () => {
    updateCategoryForEmail('test@test.com', testCategory);
    expect.value(getCategoryForEmail('test@test.com')).toBe(testCategory);
  });
});
```

### Testing Error Handling

```javascript
describe('Error Handling', () => {
  it('should throw error for invalid input', () => {
    expect.value(() => {
      processData(null);
    }).toThrow('Invalid input');
  });

  it('should return error object for failures', () => {
    const result = riskyOperation();
    if (!result.success) {
      expect.value(result).toHaveProperty('error');
      expect.value(result.error).toBeTruthy();
    }
  });
});
```

## Contributing

When adding new features:

1. Write tests first (TDD approach)
2. Run tests to see them fail
3. Implement the feature
4. Run tests to see them pass
5. Refactor if needed
6. Run `validateBeforeDeploy()` before pushing

## Support

For issues or questions about testing:

1. Check test output for specific error messages
2. Review this README
3. Look at existing test files for examples
4. Check the Apps Script logs for detailed output

---

**Remember**: Tests are documentation. Write them clearly so they explain what the code should do.

## CSV Handler Tests - Critical Coverage

### New Test File: csv-handler.test.js

Comprehensive tests for CSV import/export functionality, including critical regression tests.

#### Test Categories

**1. Value Sanitization (`sanitizeCsvValue`)**
- Null/undefined handling
- Simple values (no escaping needed)
- Values with commas → quoted
- Values with quotes → escaped as `""`
- Values with newlines → quoted
- Combined cases (commas + quotes)

**2. Column Mapping (`createCsvColumnMap`)**
- Exact header matching
- Case insensitive matching
- **CRITICAL: Substring collision prevention**
  - "Company Description" should NOT match "company" field
  - "Jobs Found In Email" should NOT match "job" in jobTitle variations
- Alternative header names
- Missing headers handling
- Full 17-column validation

**3. CSV Generation (`convertJobsToCsv`)**
- Empty job array handling
- 17-column header generation
- Proper quoting for commas
- Quote escaping
- Multiple job rows
- Column order consistency

**4. CSV Parsing (`createJobFromCsvRow`)**
- Valid row with all fields
- Missing optional fields → defaults applied
- Empty strings handling
- Whitespace trimming
- All 17 fields creation

**5. Round-trip Integration**
- Write CSV → Parse → Read back → Verify data integrity
- Complex email titles with commas and quotes
- Location fields with commas

### Regression Tests for Substring Matching Bug

**Bug Description (Fixed 2025-10-04):**
The column mapping used substring matching (`includes()`), causing:
- "Company Description" to match "company" → Company field got wrong column (index 1 instead of 0)
- "Jobs Found In Email" to match "job" → Job Title got wrong column (index 16 instead of 2)
- Result: Company showed as "Unknown", Job Title showed as "6"

**Test Coverage:**
```javascript
// Regression test at line 95-115 in csv-handler.test.js
it('should NOT match "Company Description" to company field', () => {
  const headers = ['Company', 'Company Description'];
  const map = createCsvColumnMap(headers);

  expect(map.company).toBe(0); // NOT 1
  expect(map.description).toBe(1);
});

// Bug scenario reproduction at lines 399-455
it('should NOT cause Unknown company due to substring matching', () => {
  // Real-world 17-column CSV
  const job = createJobFromCsvRow(realRow, realMap);

  expect(job['Company']).toBe('Capital One'); // NOT "Unknown"
  expect(job['Job Title']).toBe('Director'); // NOT "6"
});
```

### Adding CSV Format Changes

When modifying CSV structure:

1. **Update column count expectations:**
   ```javascript
   expect(headers.length).toBe(NEW_COUNT);
   ```

2. **Add new column mapping test:**
   ```javascript
   it('should map new column correctly', () => {
     const map = createCsvColumnMap(headersWithNewColumn);
     expect(map.newField).toBe(expectedIndex);
   });
   ```

3. **Check for substring collisions:**
   - Does new column name contain existing field variations?
   - Example: "Job Type" would incorrectly match "job" in jobTitle
   - Add specific test if collision risk exists

4. **Update integration tests:**
   - Add new field to round-trip test
   - Verify data preservation through write→read cycle

### Test Execution

Run CSV-specific tests:
```javascript
// In Apps Script editor
runTestsForModule('csv-handler')

// Or run specific test
runSingleTest('CSV Column Mapping', 'should NOT match Company Description to company field')
```
