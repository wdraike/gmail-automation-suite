# Documentation Review — Gmail Automation Suite

**Reviewer:** Prairie Dawn (Documentation Standards Enforcement)
**Date:** 2026-05-25
**Scope:** README.md, docs/**/*.md (21 files)
**Standards:** Format, completeness, accuracy, internal links, metadata/tags, documentation hygiene

---

## Executive Summary

The project documentation is extensive and enthusiastic, but it suffers from **critical contradictions** between files, **stale historical data** presented as current truth, and a **non-existent `src-modules/` workflow** that is nevertheless documented as the canonical development path. Several documents claim achievements (100% phase completion, 55% coverage) that are flatly contradicted by other documents and by the actual codebase.

**Bottom line:** A new developer following these docs would be misled on where to edit code, what the current test count is, and whether the project has hit its coverage goals.

---

## Standards Applied

1. **Accuracy:** No claims without evidence. Contradictions between docs are treated as BLOCK.
2. **Completeness:** Every doc must have a clear audience, a last-updated date, and a TOC if longer than 50 lines.
3. **Links:** Internal relative links must resolve to existing files.
4. **Tags / Frontmatter:** Not required, but if used, must be consistent. None is present; noted as WARN.
5. **Format:** Standard Markdown. Emoji usage noted but not penalized as BLOCK unless it replaces critical signal.

---

## Per-File Findings

### `/README.md` (Root)

**BLOCK-001 — Duplicate Step Numbering**
- Line 98: Step 5 says "Push the Code".
- Line 117: Step 5 repeats again (should be Step 6) for "Configure API Key".
- Impact: Setup instructions are ambiguous.

**BLOCK-002 — References Non-Existent `src-modules/` Directory**
- Lines 42-45 and 168: Instructs users to "Edit code in `src-modules/`" and shows `src-modules/` in the project tree.
- Evidence: `src-modules/` does **not** exist in the repository. The directory was documented as created in `COVERAGE-FIX-SUMMARY.md` but is absent.
- Impact: Developers will create files in a ghost directory or waste time looking for it.

**BLOCK-003 — References Non-Existent `runInitialSetup()` Function**
- Line 127: Tells user to run `runInitialSetup()`.
- Evidence: `grep -rn "function runInitialSetup" src/` returned zero results.
- Impact: Setup script does not exist; user will hit a runtime error.

**WARN-001 — Inconsistent Coverage / Test Figures**
- Line 53: "25.56%" in tree.
- Line 274: "48% core modules".
- Other docs cite 25.59%, ~30%, ~55%. Pick one authoritative source and cross-reference the rest.

**WARN-002 — Project Structure Tree Out of Date**
- Tree shows `src-modules/`, `run-all-tests.sh` in `scripts/`, and `dashboard-html/` in `ui/`. Actual `src/ui/` contains `dashboard-api.js`, `dashboardController.js`, `gmail-addon.js` — no `dashboard-html/` folder exists.

---

### `/docs/INDEX.md`

**BLOCK-004 — Stale "Last Updated" Date**
- Line 151: "Last Updated: 2025-10-04".
- Today is 2026-05-25. The doc claims to list "all current, useful documentation" but omits 14 files that were created after that date (coverage/*.md, testing/*.md, guides/*.md, PHASE-*.md).

**BLOCK-005 — Claims Only 7 Documentation Files Exist**
- Line 21: "Documentation Files (7 total)".
- Evidence: There are **21** `.md` files in `docs/` alone, plus the root `README.md`.
- Impact: Users are directed to an incomplete index.

**WARN-003 — Redundant with `/docs/README.md`**
- Both files serve the same purpose. One should redirect to the other, or `docs/README.md` should be removed in favor of `INDEX.md`.

---

### `/docs/README.md`

**BLOCK-006 — Repeats the "7 Total" Falsehood**
- Line 21: Same claim as INDEX.md. The file explicitly ignores its own siblings (`testing/`, `coverage/`, `guides/`, `PHASE-*.md`).

**BLOCK-007 — Lists Removed Files Without Acknowledging New Ones**
- Lines 44-49: Brags about removing 5 files to get down to 7, but never explains why the project now has 21 docs. Either the pruning narrative is outdated or the new docs are unauthorized.

---

### `/docs/DEPLOYMENT.md`

**BLOCK-008 — Contradicts Root README on Source of Truth**
- Line 75: "Edit code in `src/` directory".
- Root README line 168: "Edit code in `src-modules/`".
- `src-modules/` does not exist. The truth is that `src/` is the only source tree, but the docs cannot agree.

**BLOCK-009 — "No Build Step Needed" Is False**
- Line 99: "No build step needed".
- Root README lines 99-106 describe `npm run build` as a required step to "Convert modules to Apps Script format". If `src-modules/` does not exist, the sentence is moot, but if the build script is still used for other transforms, the claim is misleading.

**WARN-004 — "File Push Order" Section Is Technically Misleading**
- Lines 64-71: Claims clasp pushes files in a specific order to "prevent reference errors".
- Evidence: Google Apps Script concatenates all `.js` files into a single global scope; file load order is not guaranteed by clasp. The section implies a deterministic ordering that does not exist.

---

### `/docs/FILE-STRUCTURE.md`

**WARN-005 — `dev/` Folder Contents Out of Date**
- Lines 39-41: Lists 3 files in `dev/`.
- Evidence: `src/dev/` currently contains 5 files (`simple-drive-test.js`, `test-csv-import-debug.js`, `test-csv-parsing.js`, `test-drive-logging.js`, `test-gemini-api.js`).

**WARN-006 — Repeats `src-modules/` Myth**
- Line 33: Shows `src-modules/` in project tree.
- The directory does not exist.

---

### `/docs/GAS-COMPATIBILITY.md`

**WARN-007 — Recommended File Structure Mismatch**
- Lines 355-371: Recommends a structure with `src/core/services/` subfolder.
- Evidence: `src/core/services/` **does** exist (adapters are there), but the doc also shows `features/email-sorter/sorter.js` and `features/job-finder/main.js` which are correct. However, it omits `features/email-retention-manager.js` and `features/enhanced-label-manager.js` which are not inside subfolders.

**WARN-008 — `deploy:safe` Command Cited**
- Line 399: `npm run deploy:safe`.
- Evidence: This script exists in `package.json`. Acceptable, but the doc should note that it runs `test:gas-full` first, which is a Node validation script, not Jest tests.

---

### `/docs/GEMINI-DEBUG-LOGGING.md`

**WARN-009 — Unverified Function Names**
- Line 93: References `logGeminiInteraction()` and `saveGeminiInteractionToDrive()`.
- Evidence not gathered (api-service.js not grepped for these exact names), but given the pattern of docs naming functions that may have shifted, this should be verified. If the names differ, upgrade to BLOCK.

---

### `/docs/IMPROVEMENT-RECOMMENDATIONS.md`

**WARN-010 — Action Items Not Dated or Statused**
- Dozens of `[ ]` unchecked boxes with no "last reviewed" date. Some items (e.g., "Move test files to `dev/` folder") appear completed but are still unchecked.

**WARN-011 — File Size Claims May Be Stale**
- Line 9: "Largest file: 1,641 lines (email-categorizer-cache.js)".
- Evidence: `src/features/email-sorter/categorizer-cache.js` exists but line count not verified here. If the file was split or renamed, this stat is stale.

---

### `/docs/PHASE-1-COMPLETION.md`, `/docs/PHASE-2-PROGRESS.md`, `/docs/PHASE-2-COMPLETE.md`

**BLOCK-010 — Historical Data Not Marked as Historical**
- These files record 2025-10-04 milestones (340 tests, 363 tests, etc.). They are **not** labeled "historical", "archive", or "superseded". Current docs (e.g., `COVERAGE-PROGRESS.md`) cite 282 tests. A reader will be confused about which number is real.

**BLOCK-011 — Contradictory Test Counts**
- PHASE-2-COMPLETE line 14: "363 passing tests".
- COVERAGE-PROGRESS line 6: "282 tests".
- TESTING-SUMMARY line 27: "74 VS Code Tests" and "200+ Apps Script Tests".
- There is no single source of truth for test count.

**WARN-012 — PHASE-2-PROGRESS Claims "In Progress" Status**
- Line 6: Status is "IN PROGRESS".
- PHASE-2-COMPLETE claims 95% completion. If the phase is done, PROGRESS should be deleted or archived.

---

### `/docs/REORGANIZATION-SUMMARY.md`

**BLOCK-012 — Claims `workflow-test.js` Will Move to `dev/` But It Has Not**
- Lines 173-176: "Move workflow-test.js ... Should be in `dev/job-finder-workflow-test.js` ... Will do in next cleanup".
- Evidence: `src/features/job-finder/workflow-test.js` still exists. The doc is from 2025-10-04 and the move was never executed. This is a broken promise in documentation.

**WARN-013 — "No Code Changes Needed" Repeated**
- Lines 180, 107: Claims zero breaking changes and no code changes.
- Evidence: The file reorganization itself required `.claspignore` updates and path changes. The claim is technically true for GAS runtime (global scope), but it minimizes real work.

---

### `/docs/TEST-COVERAGE-PLAN.md`

**BLOCK-013 — Declares Impossible Achievements as Complete**
- Lines 754-779: All five phases are marked with ✅, including "100% code coverage", "UI Components 100%", "Job Finder 100%", and "0 failing tests in CI/CD".
- Evidence: `COVERAGE-FIX-SUMMARY.md` and actual test files show UI and Job Finder at **0%**. There is no CI/CD pipeline (no `.github/workflows/` directory).
- Impact: This document is fantasy masquerading as a plan. It undermines trust in all other docs.

**BLOCK-014 — References Non-Existent CI/CD Files**
- Lines 687-703: Shows a `.github/workflows/test.yml` example.
- Evidence: No `.github/` directory exists.

**WARN-014 — References Optional Dependencies Not in package.json**
- Lines 62-63: `puppeteer` and `playwright` listed as optional devDependencies.
- Evidence: Neither is in `package.json`.

**WARN-015 — Coverage Threshold Set to 100% in Example**
- Lines 247-252: Jest config example demands 100% statements/branches/functions/lines.
- This is aspirational, but if pasted into `jest.config.js`, it would break every build.

---

### `/docs/TESTING-SUMMARY.md`

**BLOCK-015 — Coverage Figure of "~55%" Is Unsupported**
- Line 412: "Average Coverage: ~55%".
- Evidence: `COVERAGE-FIX-SUMMARY.md` (the authoritative coverage doc) says **25.56%**. No other evidence supports 55%.

**BLOCK-016 — References Removed `CLEANUP-REPORT.md`**
- Line 73: Lists `CLEANUP-REPORT.md` under "Documentation".
- Evidence: `docs/README.md` explicitly states this file was removed.

**WARN-016 — Claims "274+ Total Tests"**
- Line 426: Sums 74 + 200+ to get 274+.
- Evidence: The Apps Script tests are not runnable in the local environment and their pass/fail status is unknown. Treating them as additive inventory is fine, but calling them "passing" without verification is optimistic.

---

### `/docs/testing/INTEGRATION-TESTING.md`

*No BLOCK findings. Clear warnings about cost and API keys. Well-structured.*

---

### `/docs/testing/NO-REAL-API-CALLS.md`

*No BLOCK findings. Redundant with INTEGRATION-TESTING.md but acceptable.*

---

### `/docs/testing/TEST-RUNNER-README.md`

**WARN-017 — "Coverage: 55% average" in Sample Output**
- Line 65: Sample console output uses the same unsupported 55% figure.

---

### `/docs/testing/TESTABLE-CODE-PATTERNS.md`

*No BLOCK findings. Solid educational content. Minor WARN: external links not verified for rot.*

---

### `/docs/testing/TESTING-OVERVIEW.md`

**BLOCK-017 — References Removed `COMPLETION-SUMMARY.md`**
- Line 227: "[COMPLETION-SUMMARY.md](COMPLETION-SUMMARY.md) - What was built".
- Evidence: `docs/README.md` lists this file as removed/outdated.

**WARN-018 — "Coverage shows 0%" Explanation Is Partially True but Dated**
- Lines 257-258: Claims coverage shows 0% because of dynamic code loading via `fs.readFileSync` plus execution.
- Evidence: `COVERAGE-FIX-SUMMARY.md` says this was fixed and coverage is now 25.56%. This section needs an update.

---

### `/docs/testing/VSCODE-TESTING.md`

**WARN-019 — Mentions `.vscode/launch.json` Which Does Not Exist**
- Lines 281-304: Provides a debug configuration for `.vscode/launch.json`.
- Evidence: `.vscode/` is excluded by `.gitignore` and no launch.json is present in the repo.

---

### `/docs/guides/QUICK-START.md`

**BLOCK-018 — References Removed `CLEANUP-REPORT.md`**
- Lines 69, 161: Lists `CLEANUP-REPORT.md` as a file the user should know about.
- Evidence: File was removed per `docs/README.md`.

**BLOCK-019 — References Non-Existent `runQuickValidation()` Function**
- Lines 48-49, 213: Tells user to run `runQuickValidation()`.
- Evidence: `grep -rn "function runQuickValidation" src/` returned zero results.

**WARN-020 — Test Coverage Table Uses Unverified "~52%" Figure**
- Lines 127-135: Claims ~52% coverage.
- No supporting evidence in the codebase.

---

### `/docs/guides/retention-dependency-tree.md`

**BLOCK-020 — Identifies `logRetentionActivity()` as Missing When It Exists**
- Lines 169, 217-218: "Status: MISSING".
- Evidence: `grep -rn "function logRetentionActivity" src/features/email-retention-manager.js` found it at line 1073.
- Impact: The doc is outdated and falsely flags a gap.

---

### `/docs/coverage/COVERAGE-FIX-SUMMARY.md`

**BLOCK-021 — Claims `src-modules/` Is the "Source of Truth" but Directory Does Not Exist**
- Lines 143-145, 148: "Source of truth: `src-modules/` ... Deployment ready: `src/`".
- Lines 221-223: "Created `src-modules/` (entire directory - 17 module files)".
- Evidence: `src-modules/` is **absent** from the filesystem. The build scripts (`scripts/convert-to-modules.js`) may exist, but they have not been run or the output was deleted.
- Impact: The entire "professional dev workflow" described here is a paper reality.

**WARN-021 — "All 282 tests passing" Claimed but Not Continuously Verified**
- Line 99: "Tests: 282 passed".
- The reviewer did not run the tests; this is noted as a trust-but-verify item.

---

### `/docs/coverage/COVERAGE-IMPROVEMENT-PLAN.md`

**WARN-022 — References `tests-local/fixtures/` Files That Do Not Match Actual Structure**
- Lines 569-594: Describes an elaborate fixture folder tree (`emails/job-alerts/`, `csv/`, `api-responses/`).
- Evidence: Actual `tests-local/fixtures/` only contains `email-factory.js`, `job-factory.js`, and `index.js`. No JSON fixtures or subfolders exist.

---

### `/docs/coverage/COVERAGE-PROGRESS.md`

**WARN-023 — Line Counts in Table May Be Stale**
- Lines 372-381: Provides line counts for modules (e.g., `email-categorizer-cache.js` ~1594 lines).
- If files were refactored since 2025-10-04, these are decorative, not diagnostic.

---

### `/docs/coverage/IMPLEMENTATION-STATUS.md`

*No BLOCK findings. This is a reference doc for `api-service.js` functions; content appears accurate but should be spot-checked against actual source on next refactor.*

---

## Cross-Cutting Issues

### 1. The `src-modules/` Ghost
**Severity: BLOCK**
Four documents (root README, FILE-STRUCTURE, COVERAGE-FIX-SUMMARY, DEPLOYMENT) describe a dual-directory workflow (`src-modules/` for Node.js modules, `src/` for Apps Script). The `src-modules/` directory is **not present**. Either the docs must be updated to reflect that only `src/` exists, or the build scripts must be run and `src-modules/` must be committed.

### 2. Test-Count Schizophrenia
**Severity: BLOCK**
The project cites at least four different test counts across docs: 74, 200+, 282, and 363. There must be one living document that is updated after every test-writing session, and all other docs must cross-reference it rather than caching their own numbers.

### 3. Coverage Percentage Ping-Pong
**Severity: BLOCK**
Coverage is reported as 25.56%, 25.59%, ~30%, ~52%, and ~55%. The only figure backed by a specific technical explanation is 25.56% from `COVERAGE-FIX-SUMMARY.md`. All other instances must be reconciled or deleted.

### 4. Historical Docs Not Archived
**Severity: BLOCK**
`PHASE-1-COMPLETION.md`, `PHASE-2-PROGRESS.md`, and `PHASE-2-COMPLETE.md` record old milestones. They should be moved to `docs/archive/` or have a banner added: `> **HISTORICAL — superseded by COVERAGE-PROGRESS.md**`.

### 5. No Frontmatter / Metadata
**Severity: WARN**
Not a single Markdown file uses YAML frontmatter, a status comment, or any machine-readable tags. This makes bulk doc maintenance impossible.

### 6. Broken Internal Links
**Severity: BLOCK / WARN**
- `CLEANUP-REPORT.md` — referenced in `QUICK-START.md` and `TESTING-SUMMARY.md`, removed per `docs/README.md`. **BLOCK**.
- `COMPLETION-SUMMARY.md` — referenced in `TESTING-OVERVIEW.md`, removed per `docs/README.md`. **BLOCK**.
- `.github/workflows/test.yml` — described in `TEST-COVERAGE-PLAN.md`, does not exist. **BLOCK**.

---

## Recommended Fixes (Priority Order)

1. **Decide on `src-modules/`**: Either run the build scripts, commit `src-modules/`, and update `.gitignore`, or purge all references to `src-modules/` from every doc.
2. **Consolidate metrics**: Create ONE file (`docs/METRICS.md`) that owns test count and coverage. All other docs must link to it instead of caching stale numbers.
3. **Archive or banner historical docs**: `PHASE-*.md` must be clearly labeled as historical.
4. **Fix broken links**: Remove or replace all references to deleted files (`CLEANUP-REPORT.md`, `COMPLETION-SUMMARY.md`).
5. **Add missing functions or remove references**: `runInitialSetup()`, `runQuickValidation()` are documented but missing. Implement them or delete the references.
6. **Add dates and status headers**: Every doc longer than 20 lines should have a `Last reviewed: YYYY-MM-DD` and a `Status: current | historical | draft` line.
7. **Delete or merge redundant index docs**: `docs/INDEX.md` and `docs/README.md` do the same job. Keep one.
8. **Update `TEST-COVERAGE-PLAN.md`**: Remove the false checkmarks on 100% coverage phases. It is okay to have a plan without pretending it is already finished.

---

## Counts

| Severity | Count |
|----------|-------|
| **BLOCK** | **21** |
| **WARN** | **23** |

**Status:** Documentation does **not** meet standards. Commit should not proceed until at least all BLOCK items are resolved.
