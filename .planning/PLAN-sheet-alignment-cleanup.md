# Plan — Sheet Export Alignment + Formatting Cleanup

**Leg:** plan-sheet-alignment-cleanup
**Goal:** Guarantee 100% column alignment of job data into the spreadsheet, and remove data/formatting inconsistencies.
**Mode:** Google Apps Script (clasp deploy, jest tests in `tests-local/`). TDD required for all logic. NO unapproved fallbacks — header mismatch repairs explicitly, never silently writes to wrong columns.

## Decisions (locked by user 2026-06-05)
- Header drift → **Repair in place** (remap existing data by header name; insert missing, drop obsolete).
- Careers URL / Careers URL Status → **Remove both columns**.
- Dedup → **Remove dead dedup code** (accept that active sheet may contain dupes).

## Final column set (SHEET_COLUMNS after Phase 1) — 18 columns
Company, Company Description, Job Title, Employment Type, Work Arrangement, Experience Level, Location, Minimum Salary, Maximum Salary, Salary Period, Job URL, URL Status, Email Received Date, Email Source, Date Added, Interest, Email Title, Jobs Found In Email
*(removed: Careers URL, Careers URL Status)*

---

## Phase 1 — Code/Config Cleanup (do FIRST, pure code, jest-testable)
Lands the final SHEET_COLUMNS so the Phase 2 migration targets the correct shape.

**1a. Remove Careers URL columns**
- `src/core/config.js:67` — delete `"Careers URL"`, `"Careers URL Status"` from SHEET_COLUMNS.
- `src/features/job-finder/sheets-handler.js:63-66` — delete those two `case` branches in rowData switch.
- `src/features/job-finder/sheets-handler.js:212-218` (formatJobRow) — delete careersUrl hyperlink block.
- `src/features/job-finder/extractor.js:243` — remove `"careersUrl": ""` from prompt JSON shape.
- `src/features/job-finder/extractor.js:315-316` — remove `"Careers URL"` / `"Careers URL Status"` keys from validJobs map.

**1b. Consolidate header-writing path (kill dead divergence)**
- `src/features/job-finder/main.js:479-489` — replace the inline `[...SHEET_COLUMNS]` + conditional-push + header-set block with a single `setupSheetHeaders(sheet)` call (sheets-handler.js:106 is the one source of truth). Removes the dead `if (!headers.includes(...))` pushes.

**1c. Remove dead dedup code** (confirmed no external callers; verify no menu/dashboard string-ref to `cleanupDuplicates` before deleting)
- `src/features/job-finder/sheets-handler.js` — delete `getExistingJobs` (229), `createJobSignature` (275), `isDuplicateJob` (286), `cleanupDuplicates` (363); remove from module.exports.
- `addJobToSpreadsheet` (16) — drop the `isDuplicate` param + `BACKUP_SHEET_NAME` branch; always write to ACTIVE_SHEET_NAME. Update the single caller `main.js:347` (already passes `false`).
- `src/core/config.js:58` — remove `BACKUP_SHEET_NAME` (now unused).

**Tests:** update `sheets-handler.test.js` for 18-col rowData + no-careers + no isDuplicate param. RED first.
**Gate:** Oscar `--precommit`. Commit. **No clasp push yet** (push after Phase 2 so migration ships together).

---

## Phase 2 — Header Audit + Repair-In-Place (the live-sheet fix)
New fn `auditAndRepairSheetHeaders(sheet)` in sheets-handler.js.

**Behavior:**
1. Read live header row (row 1).
2. If it already equals SHEET_COLUMNS exactly → return `{repaired:false}`.
3. Else build name→columnIndex map of the live sheet. For each target column in SHEET_COLUMNS, pull existing data by header NAME (not position). Columns present live but absent from target (e.g. old Careers URL) are dropped. Target columns absent live are inserted blank.
4. Rewrite the full data range in SHEET_COLUMNS order (header + remapped rows) via a single `setValues`. Re-apply `setupSheetHeaders` formatting + frozen row.
5. Log before/after header arrays + row count. If any data row length can't be reconciled → **throw loudly** (no silent drop).

**Call site:** `initializeJobFinder` (main.js) — run once per execution, after the sheet is fetched/created, before batch processing. Guard so a no-op (already aligned) is cheap.

**Tests (`sheets-handler.test.js`, using existing `mocks/spreadsheet.mock.js`):**
- old 16-col sheet (pre-careers, pre-Phase3) → repaired to 18, data lands under correct headers.
- sheet with Careers URL cols → those columns dropped, other data preserved.
- already-aligned sheet → `repaired:false`, no write.
- reordered headers → data remapped by name, not position.
- unreconcilable row → throws.
RED first.

**Gate:** Oscar `--precommit`. Commit.
**Runtime step (REQUIRED to actually fix live sheet):** after deploy, run `processJobEmailsMain` once (or a dedicated `auditJobSheetHeaders` entrypoint) and confirm via the diagnostic Logger.log + the live sheet that headers = 18 cols aligned. This is manual / user-run (needs Script Property `JOB_FINDER_SPREADSHEET_ID`).

---

## Phase 3 — Formatting Normalization
**3a. Salary stored as Number, not numeric-string**
- `cleanSalaryValue` (extractor.js:490) currently returns a numeric STRING ("120000"). Change to return a `Number` when the cleaned value is fully numeric, else `""`. Then `$#,##0` format applies consistently and sorting works. TDD: "$120,000.00"→120000 (number), "DOE"→"", ""→"".

**3b. Row striping via native banding (kills row%2 desync)**
- formatJobRow (sheets-handler.js:169-178) — remove the `row % 2` background hack. Instead apply a single `Range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY)` on the data range once in `setupSheetHeaders` (idempotent: remove existing banding first). Banding auto-maintains stripes after row deletes.

**3c. Location normalization (optional — confirm scope)**
- No `normalizeLocation` exists today. Prompt constrains format (extractor.js:238) but nothing enforces post-extraction. Add a light `normalizeLocation(str)` (trim, collapse spaces, standardize "Remote"/", " separators) applied in the validJobs map. Low risk; flag for Oscar review. If user wants to defer, drop 3c.

**Tests:** salary-cleaner unit tests; formatJobRow banding test; normalizeLocation unit tests. RED first.
**Gate:** Oscar `--precommit`. Commit. **clasp push** after Phase 3 (or after Phase 2 if user wants the alignment fix live sooner).

---

## Sequencing & rationale
1 → 2 → 3. Phase 1 sets the final 18-col target; Phase 2 migrates the live sheet to that exact target (so it must run after the config change, else it would migrate to the wrong shape and re-migrate later). Phase 3 is independent polish, last.

## Risks / open items
- **cleanupDuplicates UI caller:** verify no dashboard/menu invokes it by name before deleting (grep dashboard-api.js, gmail-addon.js, menu setup).
- **Repair-in-place on a large sheet:** single full-range setValues is fine for hundreds of rows; note if sheet is very large.
- **Live migration is destructive-ish:** repair rewrites the whole sheet. Recommend the audit fn snapshot/log original headers first; consider a one-time backup copy of the tab before first repair run.

## Estimated legs
- Leg 1 = Phase 1 (1 agent, Oscar, commit)
- Leg 2 = Phase 2 (1 agent, Oscar, commit) + manual runtime verify
- Leg 3 = Phase 3 (1 agent, Oscar, commit) + clasp push
