# Documentation Review Report — FIXED

**Date:** 2026-05-25
**Scope:** README.md, docs/INDEX.md, docs/TESTING-SUMMARY.md, docs/testing/TESTING-OVERVIEW.md, docs/guides/QUICK-START.md, docs/PHASE-*.md, docs/README.md
**Method:** Full-text read + grep evidence across `src/`, `tests/`, `scripts/`

---

## Summary

| Category | BLOCK | WARN | PASS |
|----------|-------|------|------|
| Overall  | **5** | **1** | **2** |

---

## 1. No `src-modules/` references remain

**Status: BLOCK (4)**

- **DOCS-REVIEW.md** (root) — still contains `src-modules/` references. Not in the changed-files list but was not fixed.
- **OSCAR-REVIEW.md** (root) — still contains `src-modules/` references.
- **CODE-REVIEW.md** (root) — still contains `src-modules/` references.
- **scripts/update-tests-to-modules.js** — still contains `src-modules/` references.

All explicitly changed files are clean.

---

## 2. Broken links to CLEANUP-REPORT.md, COMPLETION-SUMMARY.md removed

**Status: PASS**

- No active markdown links to `CLEANUP-REPORT.md` or `COMPLETION-SUMMARY.md` remain in `docs/`.
- `docs/README.md` lists them only under **"Removed Files (Outdated/Redundant)"** as plain-text acknowledgements, not as clickable links. This is acceptable.
- `DOCS-REVIEW.md` (root) still mentions them, but it is outside the changed-files scope.

---

## 3. Historical docs marked as historical

**Status: PASS**

All three phase documents carry the historical banner on line 1:

- `docs/PHASE-1-COMPLETION.md` — banner present
- `docs/PHASE-2-COMPLETE.md` — banner present
- `docs/PHASE-2-PROGRESS.md` — banner present

---

## 4. Test counts reconciled consistently across files

**Status: PASS**

| File | Jest | Apps Script | Total |
|------|------|-------------|-------|
| README.md | ~390 | — | ~390 (local only section) |
| docs/INDEX.md | ~390 | ~138 | ~528 |
| docs/TESTING-SUMMARY.md | ~390 | ~138 | ~528 |
| docs/testing/TESTING-OVERVIEW.md | ~390 | ~138 | ~528 |
| docs/guides/QUICK-START.md | — | ~138 | ~528 (stated inline) |

The numbers are consistent everywhere the total is stated.

---

## 5. No references to non-existent functions

**Status: BLOCK (4)**

Verified by grepping `src/`, `tests/`, `scripts/` for exact `function` definitions.

### 5.1 `docs/INDEX.md`
- **Finding:** References `sortEmails()` in the Quick Navigation table (line 78).
- **Evidence:** `grep -r "function sortEmails" src/` returns **no output**. The function does not exist.
- **Fix:** Remove or replace with an actual function (e.g., `categorizeEmails()`).

### 5.2 `README.md` — API Reference section
- **Finding:** `createRetentionRule(rule)` (line 225).
- **Evidence:** `grep -r "function createRetentionRule" src/` returns **no output**. Actual function is `addRetentionRule(labelName, retentionDays, description, enabled, action, ...)` in `src/features/email-retention-manager.js`.
- **Fix:** Replace with `addRetentionRule(...)` and correct signature.

- **Finding:** `processNewJobAlerts()` (line 247).
- **Evidence:** `grep -r "function processNewJobAlerts" src/` returns **no output**. Actual function is `processJobEmailsMain()` in `src/features/job-finder/main.js`.
- **Fix:** Replace with `processJobEmailsMain()`.

- **Finding:** `exportJobListingsToCsv()` (line 252).
- **Evidence:** `grep -r "function exportJobListingsToCsv" src/` returns **no output**. Actual export functions are `writeJobsToCsv(jobs)` and `saveJobsToCsv(jobs, metadata)` in `src/features/job-finder/csv-handler.js` and `main.js`.
- **Fix:** Replace with `writeJobsToCsv(jobs)` or `saveJobsToCsv(jobs, metadata)`.

### Verified as correct
These functions referenced in the changed docs **do** exist:
- `categorizeEmails()`, `getAllCategories()`, `addCategory(...)`, `updateCategoryForEmail(...)`
- `runRetentionRule(ruleId)`, `runAllRetentionRules()`, `getRetentionRules()`
- `processJobEmailsMain()`, `testCompleteJobWorkflow()`
- `addJobToSpreadsheet(job)`
- `resetCache(keepBackup)`, `getDataLayerStats()`, `exportCacheData()`, `importCacheData(data)`
- `validateBeforePush()`, `validateBeforeDeploy()`, `runSmokeTests()`, `runTestsForModule(...)`
- `isApiKeySet()`, `loadCategorizerData()`

---

## 6. Doc counts accurate

**Status: WARN**

- `docs/README.md` states **25 total** documentation files. A `find docs/ -name "*.md"` confirms exactly **25** files exist. The headline count is accurate.
- **However,** the enumerated breakdown in `docs/README.md` only lists **22** files, omitting:
  - `docs/GAS-COMPATIBILITY.md`
  - `docs/coverage/COVERAGE-PROGRESS.md`
  - `docs/README.md` itself (if intended to be included in the count)

The count is right, but the list is incomplete.

---

## Action Items

1. **Fix `docs/INDEX.md`:** Remove or replace `sortEmails()` reference.
2. **Fix `README.md`:** Replace `createRetentionRule(rule)` with `addRetentionRule(...)`, `processNewJobAlerts()` with `processJobEmailsMain()`, and `exportJobListingsToCsv()` with `writeJobsToCsv(jobs)` (or `saveJobsToCsv`).
3. **Fix `docs/README.md`:** Add the two missing docs (`GAS-COMPATIBILITY.md`, `COVERAGE-PROGRESS.md`) to the enumerated list so the breakdown matches the 25 total.
4. **Optional:** Scrub `src-modules/` references from `DOCS-REVIEW.md`, `OSCAR-REVIEW.md`, `CODE-REVIEW.md`, and `scripts/update-tests-to-modules.js` if those files are meant to reflect current state.

---

*Report generated by Prairie Dawn — documentation standards enforcement.*
