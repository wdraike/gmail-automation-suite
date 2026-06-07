# VS Code Local Testing Guide

## Overview

This directory contains **local Jest tests** that run in VS Code/Node.js environment, separate from the Google Apps Script tests in `/tests/`.

### Two Testing Systems

| Feature | Apps Script Tests (`/tests/`) | Local Tests (`/tests-local/`) |
|---------|------------------------------|-------------------------------|
| **Run in** | Google Apps Script Editor | VS Code / Terminal |
| **Framework** | Custom framework | Jest |
| **Speed** | Slower (cloud execution) | Fast (local execution) |
| **Mocking** | Limited | Full control |
| **CI/CD** | Manual | Automated |
| **Debugging** | Limited | Full debugger |
| **Coverage** | Manual | Automatic |

## Why Two Test Systems?

1. **Apps Script Tests** (`/tests/`)
   - Test actual Google APIs
   - Run in production environment
   - Required for deployment validation
   - Use: `validateBeforePush()`

2. **Local Tests** (`/tests-local/`)
   - Fast TDD workflow
   - Full IDE integration
   - CI/CD compatible
   - Better debugging
   - Use: `npm test`

## Setup

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `jest` - Testing framework
- `eslint` - Code linting
- `@types/google-apps-script` - Type definitions

### 2. Verify Installation

```bash
npm test
```

Should run the example tests and show results.

## Running Tests in VS Code

### Quick Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run with verbose output
npm run test:verbose
```

### VS Code Integration

#### Method 1: NPM Scripts (Recommended)

1. Open VS Code
2. Click "NPM SCRIPTS" in sidebar (or View → Open View → NPM Scripts)
3. Expand "gmail-automation"
4. Click play button next to any script:
   - `test` - Run all tests
   - `test:watch` - Watch mode
   - `test:coverage` - With coverage

#### Method 2: Integrated Terminal

1. Press `` Ctrl+` `` to open terminal
2. Run: `npm test`
3. See results in terminal

#### Method 3: Jest Extension (Optional)

1. Install "Jest" extension by Orta
2. Tests auto-run in background
3. See results inline in editor
4. Click to debug individual tests

## Writing Local Tests

### Basic Test Structure

```javascript
// Load your module
const fs = require('fs');
const moduleCode = fs.readFileSync('../your-module.js', 'utf8');
eval(moduleCode);

describe('Your Module', () => {
  it('should do something', () => {
    const result = yourFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Using Mocks

All Google Apps Script globals are mocked in `setup.js`:

```javascript
it('should save to properties', () => {
  // PropertiesService is already mocked
  setApiKey('test-key');

  // Verify the mock was called
  expect(PropertiesService.getScriptProperties().setProperty)
    .toHaveBeenCalledWith('API_KEY', 'test-key');
});
```

### Testing Async Code

```javascript
it('should handle promises', async () => {
  const result = await yourAsyncFunction();
  expect(result).toBeDefined();
});
```

### Testing Errors

```javascript
it('should throw error for invalid input', () => {
  expect(() => {
    riskyFunction(null);
  }).toThrow('Invalid input');
});
```

## Debugging Tests

### VS Code Debugger

1. Set breakpoint in your test file (click left margin)
2. Open Debug panel (Ctrl+Shift+D)
3. Select "Jest: Current File"
4. Press F5 to start debugging
5. Test will pause at breakpoint

### Debug Configuration

Add to `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Jest: Current File",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "${fileBasename}",
        "--config",
        "jest.config.js",
        "--runInBand"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

## Test Coverage

### Generate Coverage Report

```bash
npm run test:coverage
```

### View Coverage

After running coverage:

1. Open `coverage/lcov-report/index.html` in browser
2. See line-by-line coverage
3. Identify untested code

### Coverage Policy — 100% Enforced Gate

The local suite enforces a **100% coverage threshold** on all four metrics.
Configured in `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100
  }
}
```

`npm run test:coverage` (and `npx jest --coverage`) **fail** if statements,
branches, functions, or lines drop below 100% for any in-scope file. This gate
is the regression guard: new untested source code breaks the build.

#### Scope (what 100% applies to)

Coverage is collected from `src/**/*.js` **except** the genuinely-untestable
scaffolds, set via `collectCoverageFrom` / `coveragePathIgnorePatterns`:

- `src/dev/**` — manual GAS scaffolds that call live DriveApp/Gemini (not unit-testable).
- `src/core/local-secrets.js` — git-ignored API-key stub (secret, not in the repo).

The `*.integration.test.js` real-Gemini suite stays `describe.skip` (needs a live
API key + quota) and is the only remaining set of skipped tests.

#### Honest 100% — justified `istanbul ignore`

A handful of branches are genuinely unreachable in the Node/Jest runtime and are
wrapped with a **justified** `/* istanbul ignore … -- <reason> */` comment (never
a blanket ignore). The recurring categories are:

- **Dual-runtime guards** — `if (typeof module !== 'undefined' && module.exports)`
  export blocks (always true under Node, always false in GAS) and the
  `_xxServiceFactory()` GAS-global / `require` resolution seams.
- **Defensive catches on swallow-only callees** — `try/catch` wrappers around
  helpers that already catch their own errors and never throw.
- **`const` global guards** — e.g. `typeof API_MONITOR === 'undefined'` on a
  module-scope const object that is always defined and truthy.
- **Mock-coerced cell defenses** — live-GAS null-cell handling in the Sheets
  audit path; the Sheets test mock coerces empty cells to `""`, so the
  null/undefined arms cannot be exercised under test (but are real defenses live).

Each ignore carries a one-line reason explaining why the branch is unreachable.
Prefer deleting dead code over ignoring it; ignore only where the code is a
required GAS/Node bridge or a defensive guard with no test-reachable path.

#### Running the gate

```bash
npm run test:coverage     # full suite + 100% gate + coverage/ report
# or, deterministically (avoids the VS Code Jest watch worker contention):
npx jest --coverage --runInBand
```

## Best Practices

### DO ✓

- **Test pure functions** - Functions without side effects
- **Mock external dependencies** - Use Jest mocks
- **Test edge cases** - Null, undefined, empty arrays, etc.
- **Keep tests independent** - No shared state
- **Use descriptive names** - Test names should explain what they verify

### DON'T ✗

- **Don't test Google APIs directly** - Use Apps Script tests for that
- **Don't rely on external services** - Mock them
- **Don't skip tests** - Fix or remove them
- **Don't test implementation details** - Test behavior
- **Don't write slow tests** - Keep them fast

## Example Test Patterns

### Testing Configuration

```javascript
describe('Config', () => {
  it('should have default values', () => {
    expect(CONFIG.MAX_RETRIES).toBe(3);
  });

  it('should validate inputs', () => {
    const result = setConfig('invalid');
    expect(result.success).toBe(false);
  });
});
```

### Testing Data Transformations

```javascript
describe('Data Processing', () => {
  it('should transform data correctly', () => {
    const input = { raw: 'data' };
    const output = processData(input);

    expect(output).toMatchObject({
      processed: true,
      value: 'DATA'
    });
  });
});
```

### Testing Error Handling

```javascript
describe('Error Handling', () => {
  it('should catch and format errors', () => {
    const error = new Error('Test error');
    const formatted = handleError(error);

    expect(formatted).toContain('error');
    expect(Logger.log).toHaveBeenCalled();
  });
});
```

## Limitations

### What You CAN Test Locally

✅ Pure JavaScript logic
✅ Data transformations
✅ Validation functions
✅ Utility functions
✅ Error handling
✅ Configuration management
✅ Algorithms

### What You CANNOT Test Locally

❌ Actual Gmail operations
❌ Real Drive file access
❌ Actual API calls to Gemini
❌ Spreadsheet modifications
❌ Trigger execution
❌ UI components (Cards)

For these, use the Apps Script tests in `/tests/`.

## Workflow Recommendation

### Development Cycle

1. **Write local test** (fast iteration)
   ```bash
   npm run test:watch
   ```

2. **Implement feature** (test-driven)
   - Write test first
   - See it fail
   - Implement code
   - See it pass

3. **Run local tests** (verify logic)
   ```bash
   npm test
   ```

4. **Push to Apps Script** (deploy)
   ```bash
   clasp push
   ```

5. **Run Apps Script tests** (integration)
   ```javascript
   validateBeforePush()
   ```

6. **Deploy** (if all tests pass)
   ```bash
   clasp deploy
   ```

## Common Issues

### "Cannot find module"

**Problem:** Test can't load source file

**Solution:**
```javascript
// Use correct relative path
const code = fs.readFileSync(path.join(__dirname, '../module.js'), 'utf8');
```

### "ReferenceError: SomeGlobal is not defined"

**Problem:** Missing Google Apps Script global

**Solution:** Add to `setup.js`:
```javascript
global.SomeGlobal = {
  method: jest.fn()
};
```

### "Jest did not exit"

**Problem:** Async operations not completing

**Solution:** Use `--detectOpenHandles`:
```bash
npm test -- --detectOpenHandles
```

### Tests run but don't complete

**Problem:** Infinite loops or hanging operations

**Solution:** Add timeout:
```javascript
it('should complete quickly', () => {
  // Test code
}, 5000); // 5 second timeout
```

## Advanced Features

### Parameterized Tests

```javascript
describe.each([
  ['input1', 'expected1'],
  ['input2', 'expected2'],
  ['input3', 'expected3']
])('processValue(%s)', (input, expected) => {
  it(`should return ${expected}`, () => {
    expect(processValue(input)).toBe(expected);
  });
});
```

### Test Fixtures

```javascript
// tests-local/fixtures/sample-data.json
{
  "emails": [...],
  "categories": [...]
}

// In test
const fixtures = require('./fixtures/sample-data.json');

it('should process sample data', () => {
  const result = process(fixtures.emails);
  expect(result.length).toBeGreaterThan(0);
});
```

### Snapshot Testing

```javascript
it('should match snapshot', () => {
  const result = generateReport();
  expect(result).toMatchSnapshot();
});
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
```

## Summary

**Local tests** are perfect for:
- 🚀 Fast development (TDD)
- 🐛 Easy debugging
- 📊 Coverage reports
- 🤖 Automated CI/CD

**Apps Script tests** are perfect for:
- ✅ Pre-deployment validation
- 🔌 Integration testing
- 📧 Real Gmail operations
- 🚢 Production verification

**Use both** for maximum confidence! 💪
