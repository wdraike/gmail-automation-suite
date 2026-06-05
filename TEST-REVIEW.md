# Test Review — Job Finder Label Config — 2026-06-05

## Summary
49 tests passed, 0 failed. All 6 new getter/setter functions covered including error paths.

## Test Results

| Suite | Tests | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| config.test.js | 35 | 35 | 0 | 0 |
| job-finder-main.test.js | 14 | 14 | 0 | 0 |

## New Tests Added (11)

| Test | File | Coverage Target |
|------|------|-----------------|
| getJobFinderSourceLabel returns default when not set | config.test.js | getter default fallback |
| getJobFinderSourceLabel returns stored value when set | config.test.js | getter happy path |
| setJobFinderSourceLabel returns true on success | config.test.js | setter happy path |
| getJobFinderProcessedLabel returns default when not set | config.test.js | getter default fallback |
| getJobFinderProcessedLabel returns stored value when set | config.test.js | getter happy path |
| setJobFinderProcessedLabel returns true on success | config.test.js | setter happy path |
| getJobFinderRateLimitLabel returns default when not set | config.test.js | getter default fallback |
| getJobFinderRateLimitLabel returns stored value when set | config.test.js | getter happy path |
| setJobFinderRateLimitLabel returns true on success | config.test.js | setter happy path |
| setter returns false when properties storage throws (×3) | config.test.js | error path all 3 setters |

## Coverage

| File | % Stmts | % Branch | % Funcs | Status |
|------|---------|----------|---------|--------|
| src/core/config.js | 53.77% | 47.36% | 77.27% | WARN (Apps Script-only funcs excluded) |
| src/features/job-finder/main.js | 72.10% | 57.89% | 81.25% | PASS |

_Note: config.js uncovered lines 278–434 are Apps Script-runtime functions (UrlFetchApp, CardService) that cannot run under Jest. New getter/setter functions are fully covered._

## Missing Tests
_None for the changed scope._

## Status: PASS
_Signed: Telly — 2026-06-05T12:30:00Z_

---

# Prior Review (2026-05-25)
**Project:** `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools`

---

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| **Total Source Files** | 26 JS files | — |
| **Jest Test Files** | 16 | Exists |
| **Custom Framework Test Files** | 5 | Exists |
| **Statement Coverage** | 29.9% (1,177 / 3,936) | CRITICAL |
| **Branch Coverage** | 31.4% (609 / 1,937) | CRITICAL |
| **Function Coverage** | 32.9% (137 / 417) | CRITICAL |
| **UI / Add-on Tests** | 0 | MISSING |
| **Jest Run Status** | Could not execute (nvm env issue) | BLOCKER |

**Verdict:** The test suite has foundational unit tests for backend logic, but coverage is critically low. There are no frontend/UI tests, no Gmail add-on tests, significant shallow assertions, and the Jest runner could not be verified in this environment.

---

## 1. Coverage Breakdown by Module

### 1.1 Core Services (`src/core/`)

| File | Stmts | Branches | Funcs | Verdict |
|------|-------|----------|-------|---------|
| `api-service.js` | 46.6% | 52.9% | 56.0% | Weak — many error paths untested |
| `cache-service.js` | 40.7% | 34.5% | 17.4% | Weak — only basic get/put |
| `config.js` | 43.7% | 37.5% | 68.8% | Moderate — getter/setter covered |
| `gmail-service.js` | 51.7% | 59.6% | 37.9% | Weak — label hierarchy partially covered |
| `services/drive-adapter.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `services/gmail-adapter.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `services/index.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `services/spreadsheet-adapter.js` | **0%** | **0%** | **0%** | **UNTESTED** |

**Finding:** Despite `service-adapters.test.js` and `gas-global-scope.test.js` existing, the Clover report shows **0% coverage** for all adapter files and `index.js`. This indicates a coverage collection path mismatch — the tests may exercise the files but `collectCoverageFrom` in `jest.config.js` does not resolve to the correct paths, OR the tests rely on mocked delegation and never invoke actual adapter internals.

### 1.2 Features (`src/features/`)

| File | Stmts | Branches | Funcs | Verdict |
|------|-------|----------|-------|---------|
| `email-retention-manager.js` | 57.3% | 59.0% | 70.6% | Moderate |
| `email-sorter/categorizer-cache.js` | 68.0% | 63.0% | 78.4% | Moderate — best covered file |
| `email-sorter/sorter.js` | 21.6% | 16.2% | 46.2% | Critical — main `categorizeEmails` barely touched |
| `enhanced-label-manager.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `job-finder/csv-handler.js` | 41.3% | 49.5% | 70.4% | Weak |
| `job-finder/extractor.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `job-finder/main.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `job-finder/sheets-handler.js` | 77.3% | 62.0% | 84.2% | Good |
| `job-finder/workflow-test.js` | **0%** | **0%** | **0%** | **UNTESTED** |

### 1.3 UI / Frontend (`src/ui/`)

| File | Stmts | Branches | Funcs | Verdict |
|------|-------|----------|-------|---------|
| `dashboard-api.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `dashboardController.js` | **0%** | **0%** | **0%** | **UNTESTED** |
| `gmail-addon.js` | **0%** | **0%** | **0%** | **UNTESTED** |

### 1.4 Dev / Utility Scripts

| File | Stmts | Branches | Funcs | Verdict |
|------|-------|----------|-------|---------|
| `dev/*.js` (5 files) | **0%** | **0%** | **0%** | **UNTESTED** (expected, but should be excluded from coverage) |
| `utils/label-cache.js` | 37.5% | 33.3% | 27.3% | Weak |

---

## 2. Missing Tests (Critical Gaps)

### 2.1 Completely Untouched Source Files (0% Coverage)

1. `src/core/services/drive-adapter.js`
2. `src/core/services/gmail-adapter.js`
3. `src/core/services/index.js`
4. `src/core/services/spreadsheet-adapter.js`
5. `src/features/enhanced-label-manager.js`
6. `src/features/job-finder/extractor.js`
7. `src/features/job-finder/main.js`
8. `src/features/job-finder/workflow-test.js`
9. `src/ui/dashboard-api.js`
10. `src/ui/dashboardController.js`
11. `src/ui/gmail-addon.js`
12. `src/dev/*.js` (5 files)

**12 of 26 source files have ZERO test coverage.**

### 2.2 Untested High-Risk Functions (Within Partially Covered Files)

| File | Function | Risk |
|------|----------|------|
| `api-service.js` | `callGeminiApi` (real fetch path) | Network failure, auth errors, malformed JSON |
| `api-service.js` | `handleApiError` | Error classification logic |
| `sorter.js` | `categorizeEmails` (main entry) | Bulk of app logic — only 21.6% stmt coverage |
| `sorter.js` | `moveEmailToFolder` | Gmail label creation failure, archive errors |
| `sorter.js` | `createNewCategory` | Notification email path |
| `sorter.js` | `setupEmailSorter` | One-time setup logic |
| `cache-service.js` | `initializeCacheSystem` | Cache bootstrap path |
| `gmail-service.js` | `batchProcessThreads` | Async batching with rate limiting |

### 2.3 Frontend / UI Test Gaps (All Missing)

Per `TEST-REGISTRY.md` and `TEST-RUN-LOG.md`:

- **Dashboard UI:** 20 tests identified; **0 exist**. Includes view switching, drag-and-drop, modals, search, settings.
- **Dashboard API:** 4 tests identified; **4 exist** (backend-only, not client-side `google.script.run` integration).
- **Gmail Add-on:** 7 tests identified; **0 exist**. Includes `getContextualAddOn`, `createCategoryCard`, `applyCategory`, `filterCategories` (which uses a hardcoded category list — a known BLOCK finding).

---

## 3. Shallow Assertions

Many tests in `tests-local/` perform surface-level checks rather than verifying actual behavior.

### 3.1 Examples of Shallow Assertions

**File:** `tests-local/email-sorter.test.js`

```javascript
// Lines 93-94, 100-101, 107-108 — cleanLabelName tests
expect(result).toBeDefined();
expect(typeof result).toBe('string');
// Does NOT assert the actual cleaned value.
```

**File:** `tests-local/api-service.test.js`

```javascript
// Lines 386-399 — "should include prompt in request payload"
if (options && options.payload) {   // Conditional skip
  const payload = JSON.parse(options.payload);
  expect(JSON.stringify(payload)).toContain(testPrompt);
}
// If payload is missing, test silently passes.
```

**File:** `tests-local/api-service.test.js`

```javascript
// Lines 412-418 — "should handle API errors gracefully"
if (typeof callGemini === 'function') {   // Conditional skip
  const result = callGemini('Test prompt');
  expect(typeof result).toBe('string');   // Only checks type, not value
}
```

### 3.2 Conditional Skipping (`if (typeof x === 'function')`)

**Count:** 23 instances across `tests-local/`.

These patterns appear in `api-service.test.js`, `email-sorter.test.js`, and others:

```javascript
if (typeof callGemini === 'function') { ... }
if (typeof getRemainingApiCalls === 'function') { ... }
if (typeof API_MONITOR !== 'undefined') { ... }
```

**Problem:** If the exported function is renamed, removed, or the require fails, the test **skips the assertion rather than failing**. This masks broken imports and provides false confidence.

### 3.3 Surface-Level Type Checks

**Count:** ~64 shallow assertions (`toBeDefined`, `toBeTruthy`, `typeof ... === 'string'`/`'object'`/`'boolean'`) across `tests-local/`.

These verify *existence* and *type* but not *correctness*. For example, `cleanLabelName('Label@#$%Name')` is tested with `expect(result).toBeDefined()` but not with `expect(result).toBe('LabelName')`.

---

## 4. Untested Edge Cases

### 4.1 API Service (`src/core/api-service.js`)

| Edge Case | Status |
|-----------|--------|
| Gemini API returns 200 but body is HTML (Cloudflare / proxy error) | Untested |
| Gemini API returns 200 with empty `candidates` array | Partially tested (lines 490-503) |
| Gemini API returns nested `error` object inside 200 response | Untested |
| Rate limiter clock drift (system time changes) | Untested |
| `Utilities.sleep` throws (rare but possible in GAS) | Untested |
| API key contains whitespace / newlines (not trimmed) | Untested |

### 4.2 Email Sorter (`src/features/email-sorter/sorter.js`)

| Edge Case | Status |
|-----------|--------|
| `getAllCategories()` returns `{}` (empty) — `buildGeminiPrompt` will fail | Untested |
| Email sender string has no `<email>` format and no `@` symbol | Untested |
| `thread.isUnread()` throws (Gmail API transient failure) | Untested |
| `moveEmailToFolder` with nested label path containing `/` | Partially tested |
| `createNewCategory` fails to create label but succeeds in cache | Untested |
| Concurrent execution: two triggers fire simultaneously | Untested |
| `EMAIL_SORTER_LOCK` is stale (>30s) but process is still running | Untested |

### 4.3 Retention Manager (`src/features/email-retention-manager.js`)

| Edge Case | Status |
|-----------|--------|
| Retention rule has `retentionDays = 0` (immediate deletion) | Untested |
| Label deleted in Gmail but rule still exists in properties | Untested |
| `GmailApp.search` returns iterator with `hasNext() == false` mid-loop | Untested |
| Batch deletion fails partway through (partial commit) | Untested |
| Timezone boundary at midnight for date queries | Untested |

### 4.4 CSV Handler (`src/features/job-finder/csv-handler.js`)

| Edge Case | Status |
|-----------|--------|
| CSV has BOM (Byte Order Mark) at start of file | Untested |
| CSV line has mismatched quote escaping | Untested |
| File encoding is not UTF-8 | Untested |
| Empty file (0 bytes) | Untested |

---

## 5. Flaky Test Patterns

### 5.1 Time-Dependent Tests

`tests/retention.test.js` uses `new Date().getTime()` in label names to ensure uniqueness:

```javascript
const testLabel = 'TestRetention_' + new Date().getTime();
```

This is fine for uniqueness but creates non-deterministic test data that makes debugging harder.

### 5.2 Shared Mutable State Between Tests

The custom framework tests in `tests/` run in a single GAS execution context. They modify global state (`EMAIL_CATEGORIZER.data`, `PropertiesService`, Gmail labels) and rely on manual cleanup (`deleteCategory(testKey)`). If a test fails mid-way, subsequent tests may see polluted state.

### 5.3 Mock Reset Inconsistency

`tests-local/setup.js` provides global mocks, but `resetAllMocks()` is commented out in the `afterEach` hook:

```javascript
// Run after each test
afterEach(() => {
  // Optional: Clear mocks after each test
  // global.resetAllMocks();
});
```

**Impact:** Mock state (e.g., `mockProperties`, `mockCacheWithExpiry`) can leak between tests, causing order-dependent failures.

### 5.4 Duplicate Test File

`tests-local/config.test 2.js` exists alongside `tests-local/config.test.js`. Likely an accidental Finder/IDE duplication. This causes Jest to run the same tests twice and inflates the perceived test count.

---

## 6. Test Organization Issues

### 6.1 Dual Framework Confusion

| Aspect | `tests/` (Custom) | `tests-local/` (Jest) |
|--------|-------------------|-----------------------|
| **Runner** | GAS-native (`test-framework.js`) | Node.js + Jest |
| **Mocks** | Real GAS services | `setup.js` global mocks |
| **Coverage** | Manual / none | Clover / lcov |
| **Assertions** | Custom `expect.value(...)` | Jest matchers |
| **CI/CD** | Not applicable | Could run in CI |

**Problem:** The project maintains two parallel test suites with overlapping scope. The custom framework in `tests/` cannot run in a CI pipeline and duplicates effort already present in `tests-local/`.

**Recommendation:** Deprecate `tests/` custom framework. Migrate any unique tests (e.g., GAS-specific integration tests) to `tests-local/` with proper mocking, or keep them as manual validation scripts in `scripts/`.

### 6.2 No UI Test Harness

The dashboard HTML files (`src/ui/dashboard-html/*.html`) and the Gmail add-on (`src/ui/gmail-addon.js`) have **zero automated tests**. The `TEST-REGISTRY.md` correctly identifies this gap:

- 20 dashboard UI tests missing
- 7 Gmail add-on tests missing
- No JSDOM / Happy DOM setup for client-side scripts
- No mock `google.script.run` implementation

### 6.3 Coverage Thresholds Too Low

`jest.config.js` sets:

```javascript
coverageThreshold: {
  global: {
    branches: 25,
    functions: 30,
    lines: 27,
    statements: 27
  }
}
```

These thresholds are calibrated to the current **low** coverage numbers. They do not enforce improvement. For a production GAS project, thresholds should be:

- **Statements:** >= 70%
- **Branches:** >= 60%
- **Functions:** >= 70%

### 6.4 Dev Scripts Included in Coverage

`src/dev/*.js` (5 files, ~217 statements) are included in coverage collection but are development/debug utilities. They should be excluded via `collectCoverageFrom` in `jest.config.js`.

---

## 7. Jest Execution Status

**Attempted:** Multiple times with `/usr/local/bin/node ./node_modules/jest/bin/jest.js`

**Result:** Jest binary hangs indefinitely with zero output, even for `--version` and `--listTests`.

**Likely Causes:**
1. nvm shell function conflicts causing subprocess spawning issues
2. Jest worker process creation failing in the sandboxed environment
3. Possible native module dependency issue (e.g., `fsevents` on macOS)

**Impact:** Could not verify:
- Actual pass/fail counts from a live run
- Whether any tests are currently failing
- Whether the coverage report is stale (from a previous run) or current

**The coverage data analyzed is from `coverage/clover.xml` and `coverage/coverage-final.json`, which appear to be from a prior run (timestamp 1759663108331 = ~Oct 2025).**

---

## 8. Recommended Actions (Prioritized)

### P0 — Immediate

1. **Fix Jest execution environment.** Verify `npm test` runs cleanly. If nvm is broken, use a direct Node path or NVM alternative.
2. **Delete duplicate file:** `tests-local/config.test 2.js`.
3. **Enable mock reset in `afterEach`:** Uncomment `global.resetAllMocks()` in `tests-local/setup.js`.
4. **Remove conditional skips:** Replace all `if (typeof x === 'function')` guards with direct assertions. If a function is missing, the test should **fail**.

### P1 — High Priority

5. **Write UI / Add-on tests:**
   - Mock `CardService` and test `gmail-addon.js` entry points (`getContextualAddOn`, `applyCategory`, `showCategorySelector`).
   - Add JSDOM tests for `dashboard-api.js` and `dashboardController.js` if feasible, or mark as manual test targets.
6. **Fill adapter coverage gaps:** `drive-adapter.js`, `gmail-adapter.js`, `spreadsheet-adapter.js`, `services/index.js`. These have `service-adapters.test.js` but show 0% in coverage — investigate the path mapping or require resolution.
7. **Strengthen shallow assertions:** Replace `toBeDefined()` / `typeof` checks with actual value assertions across all test files.
8. **Exclude `src/dev/` from coverage collection.**
9. **Raise coverage thresholds** to enforce improvement (statements >= 50% as a first milestone).

### P2 — Medium Priority

10. **Deprecate custom framework in `tests/`**. Migrate unique tests to Jest or document them as manual-only.
11. **Add edge case tests** for:
    - Empty category list in `buildGeminiPrompt`
    - Malformed sender email strings
    - Partial batch deletion failures
    - Stale lock detection in `checkLockBeforeProcessing`
12. **Add integration test** for the full `categorizeEmails()` flow with mocked Gmail threads.
13. **Add accessibility tests** for dashboard HTML (axe-core via JSDOM) once a DOM harness exists.

---

## 9. Pass / Fail / Summary Counts

### Based on Static Analysis of Test Files (Jest could not run)

| Suite | Files | Estimated Test Cases | Status |
|-------|-------|----------------------|--------|
| `tests-local/` | 16 | ~340 assertions | Cannot verify runtime pass/fail |
| `tests/` | 5 | ~140 assertions | Cannot verify runtime pass/fail |
| **UI / Add-on** | 0 | 0 | **All missing** |
| **Adapter internals** | 0 | 0 | **All missing** |

### Coverage Summary Table

| Category | Covered | Total | Percentage |
|----------|---------|-------|------------|
| Statements | 1,177 | 3,936 | **29.9%** |
| Branches | 609 | 1,937 | **31.4%** |
| Functions | 137 | 417 | **32.9%** |
| Lines | 1,177 | 3,936 | **29.9%** |

---

## 10. Files Referenced in This Review

- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/jest.config.js`
- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/coverage/clover.xml`
- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/coverage/coverage-final.json`
- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/tests/test-framework.js`
- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/tests-local/setup.js`
- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/tests-local/jest-setup.js`
- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/TEST-REGISTRY.md`
- `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools/TEST-RUN-LOG.md`

---

*End of review.*
