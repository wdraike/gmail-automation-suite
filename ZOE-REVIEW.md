# Zoe Review — Phase 3: Pre-check Gate + Richer Extraction — 2026-06-05

## Summary
54/54 tests pass. No false passes detected. Three WARN findings — one loose truncation assertion that would miss a buggy implementation cutting at 4999 chars instead of 2000, and two untested `_confidence` edge cases (null and 0). All deferrable; none justify blocking this commit.

---

## Telly Audit

### BLOCK Findings
_None._

### WARN Findings

| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| 1 | Truncation assertion too loose: `expect(promptArg.length).toBeLessThan(5200)` would pass even if the implementation sent 5079 chars (e.g. `substring(0, 4999)` instead of 2000). The real prompt with a correct 2000-char snippet is ~2080 chars. | extractor.test.js:42 | job-finder-extractor.test.js | Tighten bound: `expect(promptArg.length).toBeLessThan(2200)` |
| 2 | `_confidence = null` not tested. Filter condition `job._confidence === undefined \|\| job._confidence >= 0.5` evaluates `null >= 0.5` as `false` in JS, silently dropping the job. Whether this is intended is undocumented. | main.js:329 | job-finder-main.test.js | Add test with `_confidence: null`; decide and document whether null should pass or be rejected. |
| 3 | `_confidence = 0` not tested as an explicit rejected value. Spec says "filter out confidence < 0.5"; 0.3 and 0.5 are tested, but 0 (complete noise) has no dedicated boundary test. | main.test.js confidence tests | job-finder-main.test.js | Add test: job with `_confidence: 0` is filtered out. |

### PASS Verifications

| # | Check | Status |
|---|-------|--------|
| 1 | All 54 tests re-run and independently confirmed passing | PASS |
| 2 | `isJobListingEmail` YES/NO/null-response/whitespace paths all have substantive assertions | PASS |
| 3 | `isJobListingEmail` API-throw path: returns `false`, not rethrown — source confirmed to match intent | PASS |
| 4 | `extractAnchorPairs`: null, empty, single, multiple, nested-HTML-tags cases all verified | PASS |
| 5 | `extractTextFromHtml` anchorPairs assertion checks actual content (text + url), not just `toBeDefined()` | PASS |
| 6 | New fields tested both present (with values) and defaulted (absent from Gemini response) | PASS |
| 7 | Anchor pairs prompt injection: assertion inspects actual prompt content, not just call count | PASS |
| 8 | Pre-check gate skip path: asserts `extractJobDetailsSimple` NOT called — correct negative assertion | PASS |
| 9 | Confidence boundary at exactly 0.5 tested (inclusive) | PASS |
| 10 | `_confidence` undefined field passes through (undefined → pass) | PASS |
| 11 | URL filter test checks presence of valid URL AND absence of three distinct filtered patterns | PASS |
| 12 | Rate-limit propagation: `isJobListingEmail` global defaulted to `true` in beforeEach, so existing rate-limit tests remain valid | PASS |

## Bird Audit
N/A — no frontend files changed.

## Status: PASS

_Signed: Zoe — 2026-06-05T00:00:00Z_

---

# Prior Review — Phase 2: NoJobs Label Routing — 2026-06-05

## Summary
1 WARN finding, 0 BLOCK findings. New NoJobs tests are substantive — side effects verified with object identity, not just call presence. One untested interaction: rate-limited threads that produce zero valid jobs will keep the rate-limit label after markEmailAsNoJobs (the rate-limit label is not removed). Ernie also flagged this; covered below.

## Telly Audit

### BLOCK Findings
_None._

### WARN Findings
| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| 1 | `markEmailAsNoJobs` does not remove the rate-limit label. A previously rate-limited thread that is re-processed and yields zero valid jobs will retain the `RateLimitQueue` label after archiving. No test covers this interaction. | main.js:247–261, job-finder-main.test.js:266–289 | src/features/job-finder/main.js | Add rate-limit label removal to `markEmailAsNoJobs` (mirrors `markEmailAsProcessed`), then add a test verifying `removeLabel` is called with the rate-limit label object when it exists. Defer to backlog if edge case is not yet a user-reported issue. |

### PASS Verifications
| # | Check | Status |
|---|-------|--------|
| 1 | Default fallback tested for `getJobFinderNoJobsLabel` — hardcoded value `'📬 JobAlerts/NoJobs'` asserted | PASS |
| 2 | Round-trip set/get tested for `setJobFinderNoJobsLabel` | PASS |
| 3 | Error path (storage throws) tested for `setJobFinderNoJobsLabel` | PASS |
| 4 | `beforeEach` deletes `JOB_FINDER_NO_JOBS_LABEL` property for clean isolation | PASS |
| 5 | Zero-job routing: `addLabel` called with NoJobs object, NOT Processed object — verified by object identity, not just name string | PASS |
| 6 | Zero-job routing: `addJobToSpreadsheet` NOT called — asserted explicitly | PASS |
| 7 | `markEmailAsNoJobs` side effects: addLabel, removeLabel (source), moveToArchive — all three verified | PASS |
| 8 | 55 tests pass, 0 fail | PASS |

## Status: ISSUES
_Signed: Zoe — 2026-06-05T00:00:00Z_

---

# Prior Review (2026-05-25)
**Project:** `/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools`

---

## Executive Summary

I independently inspected every test file in `tests/` and `tests-local/`, counted assertions by category, verified conditional skip patterns, and traced coverage path mismatches. Telly's surface-level findings are directionally correct, but the actual rot runs deeper: **tests are engineered to pass even when the code under test is broken or missing.**

| Metric | Value |
|--------|-------|
| Jest execution | **BLOCKED** (nvm shell function conflict, hangs indefinitely) |
| Conditional skips masking broken paths | **24+ instances** |
| `toBeDefined` / `typeof` shallow assertions | **47+ instances** |
| Try/catch blocks that turn throws into passes | **5 instances** |
| Duplicate test file inflating count | **1 file** (`config.test 2.js`) |
| Coverage data provenance | **Stale** (generated on a different filesystem path, Oct 2025) |
| Custom framework (`tests/`) isolation | **None** — shared mutable global state |

**Verdict: BLOCK**

---

## 1. Shallow Assertions — Verified Counts and Locations

Telly reported ~64 shallow assertions. My independent grep and file read confirms **at least 47** across `tests-local/` alone. These verify *existence* or *type*, never *correctness*.

### 1.1 Existence-Only Assertions (`toBeDefined`)

**File: `tests-local/email-sorter.test.js`** — 13 instances
- Lines 93, 100, 107, 113: `cleanLabelName('My Label')`, `cleanLabelName('Label@#$%Name')`, `cleanLabelName('')`, `cleanLabelName(null)` — all assert `toBeDefined()` and `typeof).toBe('string')` but **never assert the actual cleaned value**.
- Lines 121, 134, 141, 147: `sanitizeCategoryName` tests same pattern.
- Lines 162, 172, 181, 200: Inside try/catch blocks, `expect(e).toBeDefined()` — these are worse than shallow; they **reward failure**.

**File: `tests-local/service-adapters.test.js`** — 19 instances
- Lines 21, 26, 33, 38, 45, 50, 59, 60, 61, 83, 88, 96, 104, 112, 165, 166, 167, 168, 169: Nearly every adapter/factory test asserts only that the exported thing `isDefined()`. No verification that `adapter.search('query')` actually delegates, or that `getOrCreateSheet` handles the "sheet already exists" branch.

**File: `tests-local/api-service.test.js`** — 1 instance
- Line 376: `expect(fetchCall).toBeDefined()` inside "should pass correct API key in headers" — the test claims to verify headers but only checks that `fetch` was called. It does **not** inspect `options.headers` or URL params for the key.

**File: `tests-local/config.test.js`** — 1 instance
- Line 73: `expect(stored).toBeDefined()` for whitespace trimming test. The inline comment admits the current implementation does **not** trim, yet the test does not fail. It passes for any defined value.

**File: `tests-local/api-service.integration.test.js`** — 6 instances
- Lines 80, 97, 114, 126, 168, 190: All `expect(result).toBeDefined()` with no value validation.

### 1.2 Type-Only Assertions (`typeof`)

**File: `tests-local/api-service.test.js`** — 8 instances
- Lines 86, 179, 267, 416, 431, 446, 471, 567: Error-path tests for `callGemini`, `callGeminiWithRateLimiting`, `getApiCallStats` all assert `typeof result).toBe('string')` or `typeof).toBe('object')` but never verify the fallback value (e.g., that a 500 error returns `'other'`).

**File: `tests-local/email-sorter.test.js`** — 4 instances
- Lines 94, 101, 122, 135: `typeof result).toBe('string')` paired with `toBeDefined()` for `cleanLabelName` and `sanitizeCategoryName`.

**File: `tests-local/config.test.js` and `config.test 2.js`** — 5 instances each
- Lines 96, 100, 106, 110, 162: `typeof PROPERTY_KEYS).toBe('object')`, etc. Duplicate file means these assertions run twice, inflating the perceived assertion count.

---

## 2. False Passes — Conditional Skips and Try/Catch Swallowing

### 2.1 Conditional `typeof` Guards

Telly counted 23 instances. My grep found **23 in `tests-local/` plus 1 in `tests-local/api-service.integration.test.js`**, for a total of **24**.

**File: `tests-local/api-service.test.js`** — 16 instances (lines 178, 188, 243, 254, 266, 283, 292, 298, 325, 350, 369, 388, 412, 428, 443, 455, 467, 483, 498, 537, 564, 588, 600, 617, 627, 639, 649)

The most damaging cluster is lines 325–503: **10 consecutive `callGemini` tests** (success + error paths) are all wrapped in `if (typeof callGemini === 'function')`. If the require/destructure at the top of the file silently fails or the export is renamed, **the entire `callGemini` contract evades testing while reporting green**.

**File: `tests-local/api-service.integration.test.js`** — 1 instance
- Line 63: `if (typeof resetApiMonitor === 'function')`

### 2.2 Try/Catch Blocks That Turn Errors into Passes

Telly did **not** report these. This is a distinct and more dangerous pattern than conditional skips.

**File: `tests-local/email-sorter.test.js`**

```javascript
// Lines 152-163
it('should build prompt with email details', () => {
  try {
    const result = buildGeminiPrompt('test@example.com', 'example.com', 'Test Subject');
    expect(result).toContain('test@example.com');
    // ...
  } catch (e) {
    // If buildGeminiPrompt throws for ANY reason, test PASSES
    expect(e).toBeDefined();
  }
});
```

**Count:** 5 tests across lines 152–203 use this anti-pattern. If `buildGeminiPrompt` or `queryGeminiForCategory` is completely broken and throws on every invocation, these tests report success.

### 2.3 Conditional Skips in Custom Framework (`tests/`)

Telly noted shared mutable state but missed that the custom framework tests also skip assertions conditionally.

**File: `tests/retention.test.js`**
- Lines 43–53: `if (createResult.success) { ... expect.value(...) ... }`
- Lines 102–121: `if (createResult.success) { ... expect.value(...) ... }`
- Lines 144–155: `if (createResult.success) { ... expect.value(...) ... }`
- Lines 174–194: `if (createResult.success) { ... expect.value(...) ... }`

If `createRetentionRule` is broken and always returns `success: false`, the custom framework will report **0 failures** because the assertions are inside the guard block.

---

## 3. Missing Edge Cases (Beyond Telly's List)

### 3.1 API Service (`api-service.js`)

- **Empty API key string with only whitespace** (`'   '`): `setApiKey` test at line 66 of `config.test.js` documents that trimming does not happen, but does not assert the buggy behavior; it asserts `toBeDefined()`.
- **`callGemini` with `null` or `undefined` prompt**: No test passes a null prompt to verify it doesn't crash or leak into the payload.
- **HTML response body with 200 status**: Telly listed this as untested; confirmed untested after inspection.
- **`cleanGeminiResponse('')`** (line 84–87): Only asserts `typeof cleaned).toBe('string')`. Does not assert the returned value is `''`.

### 3.2 Email Sorter (`sorter.js`)

- **`buildGeminiPrompt` with empty sender/domain/subject**: No null/undefined parameter tests.
- **`cleanLabelName` with string of only special characters**: No test for `'@#$%'` to verify it returns `''` or a fallback.
- **`sanitizeCategoryName` with whitespace-only string**: No test for `'   '`.

### 3.3 Retention Manager (`retention.test.js`)

- **Boundary condition `retentionDays = 0`**: Telly listed it. Confirmed untested in both custom framework and Jest suites.
- **Retention rule with extremely large `retentionDays`**: No overflow or sanity-check test.

### 3.4 CSV Handler (`csv-handler.test.js`)

- Telly listed BOM, mismatched quotes, non-UTF-8, empty file. Confirmed all untested.
- **Additional gap:** No test for CSV fields containing carriage returns (`\r\n`).

---

## 4. Missing Negative Tests

### 4.1 Auth / Authorization

- **Zero tests** verify that dashboard endpoints or Gmail add-on actions enforce any authorization check. The `google.script.run` integration has no mock for user identity verification.

### 4.2 Injection / Sanitization

- **Zero tests** for XSS or script injection in `cleanGeminiResponse`, `buildGeminiPrompt`, or dashboard HTML generation. A malicious Gemini response like `{"category": "<script>alert(1)</script>"}` has no test coverage.

### 4.3 Rate Limiter Abuse

- The rate limiter tests in `api-service.test.js` fill the counter with a loop but do not test:
  - Clock rewind (system time goes backward)
  - Concurrent modification of `API_MONITOR` from multiple async contexts

---

## 5. Mock Leakage Between Tests

### 5.1 Global Mock State Not Reset

**File: `tests-local/setup.js`**
- Lines 239–243: `afterEach` hook has `// global.resetAllMocks();` commented out.
- Impact: `mockProperties`, `mockCacheWithExpiry`, and `jest.clearAllMocks()` (the latter is NOT called by `resetAllMocks()`) accumulate across tests.

### 5.2 Global Object Reassignment Leakage

**File: `tests-local/gmail-service.test.js`**
- Tests reassign `global.GmailApp` inside individual test blocks (lines 28–30, 41–44, 57–71, etc.). `jest.clearAllMocks()` only clears call history on mock functions; it **does not restore** the original `global.GmailApp` object. If a test assigns a broken mock, subsequent tests inherit it.

### 5.3 Custom Framework (`tests/`) Has No Isolation

**File: `tests/test-framework.js`**
- `TEST_RESULTS` is a module-level global. `clearTests()` exists but is **never invoked** in any test file I inspected.
- `beforeEach`/`afterEach` hooks exist in the framework but `retention.test.js` does not use them. Properties, labels, and cache mutations persist across the entire suite.

---

## 6. Coverage Path Mismatch — Root Cause Verified

Telly suspected a path mismatch for the 0% adapter coverage. I inspected `coverage/coverage-final.json` and confirmed the absolute paths recorded in the report:

```
/Users/david/Documents/Software Development/Google Scripts/email Tools/src/core/services/...
```

This is **not the current working directory** (`/Users/david/Library/Mobile Documents/com~apple~CloudDocs/Documents/07_Software_Development/Google Scripts/email Tools`). The coverage data was generated on a different machine or at a different filesystem mount point in **Oct 2025** (timestamp 1759663108331).

Because Jest cannot currently execute in this environment (nvm shell function conflict causes indefinite hang), **nobody knows whether the current tests actually cover the adapters or not**. The 0% may be stale, or it may reflect a genuine `collectCoverageFrom` resolution issue. Without a live run, this is unprovable.

**Additionally:** `service-adapters.test.js` directly requires `../src/core/services/gmail-adapter.js`. If Jest were running, those lines should register coverage. The fact that the stale report shows 0/25 for `gmail-adapter.js` suggests either:
1. The file did not exist when the report was generated, or
2. The require path resolved to a different file than the one `collectCoverageFrom` tracks.

---

## 7. Additional Findings Telly Missed

### 7.1 Duplicate Test File

`tests-local/config.test 2.js` is a **byte-for-byte duplicate** of `tests-local/config.test.js`. Jest runs both, inflating the test count and creating false confidence. The duplicate adds 5 shallow `typeof` assertions and 1 `toBeDefined` assertion to the inflated total.

### 7.2 Tests That Document Bugs But Don't Fail on Them

**File: `tests-local/config.test.js`** line 66–74:

```javascript
it('should trim whitespace from API key', () => {
  const testKey = '  api-key-with-spaces  ';
  setApiKey(testKey);
  // Note: Current implementation doesn't trim,
  // but it should for better UX
  const stored = getApiKey();
  expect(stored).toBeDefined();  // PASSES even if bug persists
});
```

This is a **documented, unenforced regression**. The test should assert `toBe('api-key-with-spaces')` and fail until the bug is fixed.

### 7.3 `api-service.test.js` "Correct API Key in Headers" Test Is a Lie

Lines 358–378:

```javascript
it('should pass correct API key in headers', () => {
  const testKey = 'test-api-key-12345';
  setApiKey(testKey);
  // ... mock UrlFetchApp.fetch ...
  if (typeof callGemini === 'function') {
    callGemini('Test prompt');
    const fetchCall = UrlFetchApp.fetch.mock.calls[0];
    const options = fetchCall[1];
    // API key should be in headers or URL params
    expect(fetchCall).toBeDefined();  // <-- ONLY asserts call exists
  }
});
```

The test description claims to verify the API key is in headers. The assertion only checks that the fetch call exists. **The actual header/param verification is missing.**

### 7.4 `tests/` Custom Framework Cannot Be Deprecrated Without Migration

Telly recommends deprecating the custom framework. However, `tests/` contains the **only** tests that exercise `retention.test.js` functions against the actual custom assertion framework. If these are removed without migrating the retention assertions to Jest, the retention module loses all automated validation.

---

## 8. Recommendations (Zoe-Prioritized)

### P0 — Fix Before Any Commit

1. **Uncomment `global.resetAllMocks()`** in `tests-local/setup.js` afterEach.
2. **Delete `tests-local/config.test 2.js`**.
3. **Replace all 24 conditional skips** with direct assertions. If an export is missing, the test must fail.
4. **Replace all 5 try/catch swallowing blocks** in `email-sorter.test.js` with direct invocation. If the function throws unexpectedly, let the test fail.
5. **Fix or delete** the "should pass correct API key in headers" test — it must inspect `options.headers` or the URL query string.

### P1 — Close Critical Gaps

6. **Add value assertions** to `cleanLabelName` and `sanitizeCategoryName` tests. Example: `expect(cleanLabelName('Label@#$%Name')).toBe('LabelName')`.
7. **Add the whitespace-trimming assertion** to `config.test.js` and fix the underlying bug, or remove the misleading comment.
8. **Restore Jest execution environment**. The nvm conflict blocks all runtime verification. Use a direct Node path or containerized runner.
9. **Add negative tests** for null/undefined prompts in `callGemini` and injection payloads in `cleanGeminiResponse`.
10. **Migrate `tests/retention.test.js`** to Jest with proper `beforeEach` isolation before deprecating the custom framework.

### P2 — Coverage and Quality

11. **Regenerate coverage** from a live Jest run to determine whether `service-adapters.test.js` actually hits the adapter files or if there is a genuine path/config issue.
12. **Exclude `src/dev/`** from `collectCoverageFrom` as Telly recommended.
13. **Raise thresholds** to statements >= 50%, branches >= 40%, functions >= 50% as a minimum bar.

---

## 9. Verdict

**BLOCK**

The test suite is structurally compromised by:
- 24 conditional skips masking broken exports
- 5 try/catch swallowing blocks that reward failures with passes
- 47+ shallow assertions providing zero behavioral verification
- Zero mock reset between tests causing order-dependent state pollution
- Stale coverage data from a different environment, making coverage claims unverifiable
- A duplicate test file inflating perceived coverage

Telly was right about the symptoms but understated the severity. These tests do not merely have "shallow assertions" — they are **actively designed to pass when the code is missing or broken**. Do not trust the reported assertion count or coverage percentage until Jest can execute cleanly and every conditional skip is removed.

---

*End of Zoe adversarial review.*
