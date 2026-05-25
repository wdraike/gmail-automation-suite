# Google Apps Script Compatibility Guide

## Table of Contents
- [Overview](#overview)
- [How Google Apps Script Works](#how-google-apps-script-works)
- [Common Pitfalls](#common-pitfalls)
- [Best Practices](#best-practices)
- [Testing for Compatibility](#testing-for-compatibility)
- [Troubleshooting](#troubleshooting)

## Overview

Google Apps Script (GAS) has a unique runtime environment that differs significantly from Node.js. Understanding these differences is crucial for writing code that works in both environments.

**Key Difference:** In Google Apps Script, all `.js` files are concatenated into a **single global scope**. There is no module system like Node.js's `require()` or ES6's `import/export`.

## How Google Apps Script Works

### File Concatenation

When you deploy code to GAS using `clasp push`, all your JavaScript files are combined into a single script with a shared global namespace:

```javascript
// What you write:
// File: src/services/gmail-adapter.js
class GmailAdapter { }

// File: src/services/index.js
class ServiceFactory { }

// What GAS sees (simplified):
class GmailAdapter { }
class ServiceFactory { }
// All in one global scope!
```

### No Module System

GAS does **not support**:
- `require()` (Node.js CommonJS)
- `import/export` (ES6 modules)
- Module bundlers (Webpack, Rollup, etc.)

All functions, classes, and variables declared at the top level are **globally accessible**.

## Common Pitfalls

### 1. Duplicate Declarations

**❌ Problem:**
```javascript
// File: gmail-adapter.js
class GmailAdapter { }

// File: index.js
let GmailAdapter;  // ❌ Error: Identifier 'GmailAdapter' has already been declared
```

**✅ Solution:**
```javascript
// File: gmail-adapter.js
class GmailAdapter { }

// File: index.js
// Don't redeclare! The class is already globally available in GAS

// For Node.js compatibility, only require inside module.exports:
if (typeof module !== 'undefined' && module.exports) {
  const { GmailAdapter } = require('./gmail-adapter.js');
  module.exports = { GmailAdapter };
}
```

### 2. Using `require()` Outside Module Checks

**❌ Problem:**
```javascript
// This will fail in GAS (require is not defined)
const config = require('./config.js');

function myFunction() {
  // use config
}
```

**✅ Solution:**
```javascript
// Option 1: Don't use require in GAS code
// Access the globally available config directly

function myFunction() {
  const apiKey = getApiKey(); // Function from config.js (globally available)
}

// Option 2: Conditional require (for dual Node.js/GAS compatibility)
if (typeof require !== 'undefined') {
  var config = require('./config.js');
}
```

### 3. ES6 Import/Export at Top Level

**❌ Problem:**
```javascript
// Not supported in GAS
import { helper } from './helpers.js';
export function main() { }
```

**✅ Solution:**
```javascript
// For GAS: Just declare functions/classes globally
function helper() { }
function main() { }

// For Node.js: Wrap exports conditionally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { helper, main };
}
```

### 4. Variable Name Collisions

**❌ Problem:**
```javascript
// File: feature-a.js
const CONFIG = { mode: 'A' };

// File: feature-b.js
const CONFIG = { mode: 'B' };  // ❌ Error: Identifier 'CONFIG' has already been declared
```

**✅ Solution:**
```javascript
// Use unique prefixes or namespacing
// File: feature-a.js
const FEATURE_A_CONFIG = { mode: 'A' };

// File: feature-b.js
const FEATURE_B_CONFIG = { mode: 'B' };

// Or use an object namespace:
const FeatureA = {
  CONFIG: { mode: 'A' }
};
```

## Best Practices

### 1. Dual Compatibility Pattern

For code that works in both Node.js and GAS:

```javascript
/**
 * MyService.js - Works in both Node.js and GAS
 */

class MyService {
  constructor(dependency = MyDependency) {
    this.dependency = dependency;
  }

  doSomething() {
    // Implementation
  }
}

// Export for Node.js only
if (typeof module !== 'undefined' && module.exports) {
  // Only require dependencies here (not at top level)
  const { MyDependency } = require('./my-dependency.js');

  module.exports = { MyService };
}
```

### 2. Avoid Top-Level Variable Declarations

Minimize global pollution:

```javascript
// ❌ Avoid
const tempData = [];
const helper = (x) => x * 2;

function processData() {
  tempData.push(helper(5));
}

// ✅ Better
function processData() {
  const tempData = [];
  const helper = (x) => x * 2;
  tempData.push(helper(5));
}
```

### 3. Use Constants Wisely

Group related constants:

```javascript
// ✅ Good
const EMAIL_CONFIG = {
  MAX_THREADS: 100,
  BATCH_SIZE: 10,
  LABEL_PREFIX: 'Auto/'
};

// ❌ Avoid multiple top-level constants
const MAX_THREADS = 100;
const BATCH_SIZE = 10;
const LABEL_PREFIX = 'Auto/';
```

### 4. Factory Pattern for Testability

Use dependency injection:

```javascript
class EmailService {
  constructor(gmailApp = GmailApp) {
    this.gmail = gmailApp;
  }

  search(query) {
    return this.gmail.search(query);
  }
}

// Easy to test with mocks in Node.js
// Works with real GmailApp in GAS
```

## Testing for Compatibility

### Automated Tests

We've created automated tests to catch GAS compatibility issues before deployment:

#### 1. Global Scope Conflict Detection

```bash
npm run test:gas-compat
```

This runs:
- `tests-local/gas-global-scope.test.js` - Detects duplicate identifiers
- `tests-local/service-adapters.test.js` - Tests adapter integration

#### 2. Full GAS Validation

```bash
npm run test:gas-full
```

This runs all compatibility checks:
- Global scope conflict detection
- Service adapter integration tests
- Unsupported ES6+ feature detection
- `.clasp.json` validation
- Sensitive data detection

#### 3. Pre-Deploy Hook

The `predeploy` script automatically runs validation:

```bash
npm run deploy  # Runs test:gas-full first, then deploys
```

To skip validation (not recommended):
```bash
clasp push  # Direct push without validation
```

### Manual Testing

Before deploying:

1. **Run all tests locally:**
   ```bash
   npm test
   npm run test:gas-full
   ```

2. **Check the Apps Script logs:**
   ```bash
   clasp logs
   ```

3. **Test in GAS environment:**
   - Open the script: `npm run open`
   - Run a test function
   - Check for errors in Execution log

## Troubleshooting

### Error: "Identifier 'X' has already been declared"

**Cause:** Multiple files declare the same identifier in the global scope.

**Solution:**
1. Run `npm run test:gas-compat` to find conflicts
2. Rename one of the conflicting identifiers
3. Or move the declaration inside a function/class

### Error: "require is not defined"

**Cause:** Using `require()` outside of a module check.

**Solution:**
```javascript
// Wrap all require() calls:
if (typeof require !== 'undefined') {
  const myModule = require('./my-module.js');
}
```

### Error: "Cannot find module './xyz'"

**Cause:** Trying to use Node.js-style module paths in GAS.

**Solution:**
- Remove the `require()` call
- Access the module's exports directly (they're global in GAS)

### Changes Not Appearing After Deploy

**Cause:** GAS may be caching the old version.

**Solutions:**
1. Hard refresh in browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Check file was actually pushed: `clasp push` output
3. Verify in online editor: `npm run open`
4. Check `.claspignore` isn't excluding your file

### Tests Pass Locally But Fail in GAS

**Cause:** Environment differences (Node.js vs GAS).

**Common issues:**
- Different JavaScript engine (V8 version)
- Missing Node.js built-ins (fs, path, etc.)
- Different Date/JSON implementations

**Solution:**
- Check GAS-specific behavior in online editor
- Add conditional code for environment differences
- Use polyfills if needed

## File Structure Recommendations

```
src/
├── core/
│   ├── config.js           # Global configuration
│   ├── cache-service.js    # Caching utilities
│   └── services/
│       ├── gmail-adapter.js      # GmailApp wrapper
│       ├── spreadsheet-adapter.js # SpreadsheetApp wrapper
│       └── index.js              # Factory (Node.js exports only)
├── features/
│   ├── email-sorter/
│   │   └── sorter.js       # Feature implementation
│   └── job-finder/
│       └── main.js         # Feature implementation
└── ui/
    └── dashboard.js        # UI components
```

**Key principles:**
- Each file exports classes/functions via conditional `module.exports`
- No cross-file `require()` at top level
- Related functionality grouped in directories
- Adapters provide testable wrappers around GAS services

## Resources

- [Official GAS Documentation](https://developers.google.com/apps-script)
- [Clasp Documentation](https://github.com/google/clasp)
- [V8 Runtime Features](https://developers.google.com/apps-script/guides/v8-runtime)

## Summary Checklist

Before deploying to Google Apps Script:

- [ ] Run `npm run test:gas-full`
- [ ] No duplicate class/function/variable names across files
- [ ] All `require()` calls wrapped in `typeof module !== 'undefined'` checks
- [ ] No top-level `import/export` statements
- [ ] Global scope minimized (constants grouped, functions namespaced)
- [ ] Tests pass locally
- [ ] No sensitive data hardcoded

**Quick deploy with safety checks:**
```bash
npm run deploy:safe
```

This guide will help prevent the "Identifier already declared" error and other GAS compatibility issues. Keep it updated as you discover new patterns and solutions!
