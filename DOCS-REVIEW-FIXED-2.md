# Documentation Review — FIXED-2

**Date:** 2026-05-25
**Scope:** README.md, docs/INDEX.md, docs/README.md, docs/* (all .md files), scripts/update-tests-to-modules.js
**Method:** Full-text read + grep evidence across `src/`, `tests/`, `scripts/`

---

## Summary

| Status | Count |
|--------|-------|
| BLOCK | 3 |
| WARN | 2 |
| PASS | 3 |

**Verdict: BLOCK** — new and lingering non-existent function references, plus widespread broken internal links in `docs/`.

---

## Verification Results

### 1. No references to non-existent functions in README.md or docs/INDEX.md

**Status: BLOCK**

Evidence gathered by grepping `src/`, `tests/`, `scripts/` for exact `function` definitions.

#### `docs/INDEX.md` — lingering misname
- **Line 78:** Quick Navigation table references `categorizeEmail()`.
- **Evidence:** `grep -rn "function categorizeEmail\b" src/` returns **no output**.
- **Fix:** Replace with `categorizeEmails()` (plural), defined in `src/features/email-sorter/sorter.js:275`.

#### `README.md` — API Reference section not fully fixed
- **Line 139 (Setup):** `createRetentionRule({ ... })`
- **Line 333 (API Reference):** `createRetentionRule(rule)`
- **Line 339 (API Reference):** `processNewJobAlerts()`
- **Line 341 (API Reference):** `exportJobListingsToCsv()`
- **Evidence:**
  - `grep -rn "function createRetentionRule\b" src/` — no output. Actual: `addRetentionRule(labelName, retentionDays, description, enabled, action, ...)` in `src/features/email-retention-manager.js:81`.
  - `grep -rn "function processNewJobAlerts\b" src/` — no output. Actual: `processJobEmailsMain()` in `src/features/job-finder/main.js:10`.
  - `grep -rn "function exportJobListingsToCsv\b" src/` — no output. Actual: `writeJobsToCsv(jobs)` in `src/features/job-finder/csv-handler.js:479`.
- **Fix:** Replace the four occurrences above with the actual function names and signatures.

#### Verified as correct (these references are fine)
- `addCategory(key, displayName, label)` → `src/features/email-sorter/categorizer-cache.js:439`
- `updateCategoryForEmail(email, category)` → `src/features/email-sorter/categorizer-cache.js:741`
- `runRetentionRule(ruleId)` → `src/features/email-retention-manager.js:398`
- `addJobToSpreadsheet(job)` → `src/features/job-finder/sheets-handler.js:16`
- `importCacheData(data)` → `src/features/email-sorter/categorizer-cache.js:1334`
- `resetCache(keepBackup)` → `src/features/email-sorter/categorizer-cache.js:1386`

---

### 2. docs/README.md enumeration totals 25

**Status: WARN**

- `find docs/ -name "*.md"` confirms **exactly 25** markdown files exist under `docs/`.
- The headline "Documentation Files (25 total)" is therefore numerically accurate.
- **However,** the enumerated breakdown in `docs/README.md` only lists **24** items:
  - Structure (2)
  - Getting Started (2)
  - Improvements (1)
  - Testing & Debugging (13)
  - Historical (3)
  - Guides (2)
  - Navigation (1)
  - **Total listed = 24**
- The missing item from the list is `docs/README.md` itself. If it is intentionally excluded from its own inventory, the headline should read "24 files + this README"; otherwise, add `README.md` to the Navigation or Structure section.
- Prior review (DOCS-REVIEW-FIXED.md) counted 22; `GAS-COMPATIBILITY.md` and `COVERAGE-PROGRESS.md` were successfully added (+2), bringing the list from 22 to 24.

---

### 3. Historical docs are marked

**Status: PASS**

All three phase documents carry the `(historical)` marker in `docs/README.md`:
- `PHASE-1-COMPLETION.md` — (historical)
- `PHASE-2-COMPLETE.md` — (historical)
- `PHASE-2-PROGRESS.md` — (historical)

---

### 4. Test counts are consistent across all docs

**Status: PASS with WARN**

| File | Jest | Apps Script | Total |
|------|------|-------------|-------|
| README.md | ~390 | — | ~390 (local only section) |
| docs/INDEX.md | ~390 | ~138 | ~528 |
| docs/TESTING-SUMMARY.md | ~390 | ~138 | ~528 |
| docs/testing/TESTING-OVERVIEW.md | ~390 | ~138 | ~528 |

Test **counts** are consistent wherever the total is stated.

**WARN:** Coverage percentages diverge slightly:
- README.md states **25.56%** overall.
- docs/INDEX.md states **25.59%** overall.
- The 0.03% gap is minor but should be reconciled to a single authoritative source.

---

### 5. No broken links remain in docs/

**Status: BLOCK**

Systematic link extraction from every `.md` file under `docs/` (resolved relative to each file's directory) reveals **43 broken internal links** across **12 files**.

**Broken doc-to-doc links (relative paths missing subdirectories):**

| File | Broken Link | Correct Target |
|------|-------------|----------------|
| docs/TESTING-SUMMARY.md | `QUICK-START.md` | `guides/QUICK-START.md` |
| docs/TESTING-SUMMARY.md | `TESTABLE-CODE-PATTERNS.md` | `testing/TESTABLE-CODE-PATTERNS.md` |
| docs/TESTING-SUMMARY.md | `VSCODE-TESTING.md` | `testing/VSCODE-TESTING.md` |
| docs/testing/TESTING-OVERVIEW.md | `IMPLEMENTATION-STATUS.md` | `coverage/IMPLEMENTATION-STATUS.md` |
| docs/testing/TESTING-OVERVIEW.md | `TESTING-SUMMARY.md` | `../TESTING-SUMMARY.md` |
| docs/testing/VSCODE-TESTING.md | `QUICK-START.md` | `../guides/QUICK-START.md` |
| docs/testing/VSCODE-TESTING.md | `README.md` | `../README.md` |

**Broken links to project files outside docs/ (missing `../` prefix):**

| File | Broken Link | Correct Target |
|------|-------------|----------------|
| docs/GEMINI-DEBUG-LOGGING.md | `src/core/api-service.js` | `../src/core/api-service.js` |
| docs/PHASE-1-COMPLETION.md | `jest.config.js` | `../jest.config.js` |
| docs/PHASE-1-COMPLETION.md | `src/core/services/*` (5 files) | `../src/core/services/*` |
| docs/PHASE-1-COMPLETION.md | `tests-local/*` (10 files) | `../tests-local/*` |
| docs/PHASE-2-COMPLETE.md | `tests-local/csv-handler-integration.test.js` | `../tests-local/csv-handler-integration.test.js` |
| docs/PHASE-2-COMPLETE.md | `tests-local/sheets-handler.test.js` | `../tests-local/sheets-handler.test.js` |
| docs/PHASE-2-PROGRESS.md | `tests-local/csv-handler-integration.test.js` | `../tests-local/csv-handler-integration.test.js` |
| docs/PHASE-2-PROGRESS.md | `tests-local/sheets-handler.test.js` | `../tests-local/sheets-handler.test.js` |
| docs/TESTING-SUMMARY.md | `tests-local/README.md` | `../tests-local/README.md` |
| docs/TESTING-SUMMARY.md | `tests-local/api-service.test.js` | `../tests-local/api-service.test.js` |
| docs/TESTING-SUMMARY.md | `tests/README.md` | `../tests/README.md` |
| docs/guides/QUICK-START.md | `README.md` | `../README.md` |
| docs/guides/QUICK-START.md | `pre-push.js` | `../scripts/pre-push.js` |
| docs/guides/QUICK-START.md | `tests/` | `../tests/` |
| docs/guides/QUICK-START.md | `tests/README.md` | `../tests/README.md` |
| docs/guides/QUICK-START.md | `tests/test-framework.js` | `../tests/test-framework.js` |
| docs/guides/QUICK-START.md | `tests/test-runner.js` | `../tests/test-runner.js` |
| docs/testing/INTEGRATION-TESTING.md | `tests-local/README.md` | `../../tests-local/README.md` |
| docs/testing/NO-REAL-API-CALLS.md | `tests-local/setup.js` | `../../tests-local/setup.js` |
| docs/testing/NO-REAL-API-CALLS.md | `tests-local/test-utils.js` | `../../tests-local/test-utils.js` |
| docs/testing/VSCODE-TESTING.md | `tests-local/README.md` | `../../tests-local/README.md` |
| docs/testing/VSCODE-TESTING.md | `tests/README.md` | `../../tests/README.md` |

---

### 6. scripts/update-tests-to-modules.js

**Status: PASS**

Line 3 contains the required comment:
```javascript
// NOTE: src-modules/ no longer exists — this script may be obsolete.
```
The script no longer falsely presents `src-modules/` as a current code path.

---

## Action Items

1. **Fix `docs/INDEX.md`:** Change `categorizeEmail()` to `categorizeEmails()` (line 78).
2. **Fix `README.md`:**
   - Line 139: Replace `createRetentionRule({...})` with `addRetentionRule(...)`.
   - Line 333: Replace `createRetentionRule(rule)` with `addRetentionRule(...)`.
   - Line 339: Replace `processNewJobAlerts()` with `processJobEmailsMain()`.
   - Line 341: Replace `exportJobListingsToCsv()` with `writeJobsToCsv(jobs)`.
3. **Fix broken links in `docs/`:** Update all 43 relative links to use correct `../` or subdirectory prefixes so they resolve from the file's actual directory.
4. **Reconcile coverage percentage:** Align README.md and docs/INDEX.md to a single value (e.g., 25.59%).
5. **Fix `docs/README.md` enumeration:** Either add `README.md` to the list or change the headline to "24 files".

---

*Report generated by Prairie Dawn — documentation standards enforcement.*
