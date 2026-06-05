# Job Finder Improvement Roadmap

## Goal
Fix job email processing: eliminate timeout, improve extraction quality, route bad emails for review.

---

## Phase 1 — Remove CSV Layer (Medium)
**Status:** Complete — 0b84b92

Remove Drive CSV intermediate storage. Write extracted jobs directly to Sheets in the same run.
- Delete `importPendingJobCsvs` trigger and batch loop (timeout root cause)
- Wire `extractJobDetailsSimple` output → `addJobToSpreadsheet` directly in `processOneEmail`
- Keep `csv-handler.js` write path for manual export only (or delete)
- One trigger replaces two

**Files:** `src/features/job-finder/main.js`, `src/features/job-finder/csv-handler.js`, `src/features/job-finder/sheets-handler.js`

---

## Phase 2 — No-Job Email Routing (Small)
**Status:** Complete — 02516f0

When extraction returns `[]`, route to `📬 JobAlerts/NoJobs` instead of Processed.
- Add `getJobFinderNoJobsLabel()` / `setJobFinderNoJobsLabel()` to config (same pattern)
- In `processOneEmail`: if `jobs.length === 0` → apply NoJobs label, skip Processed
- Lets user review false negatives and tune prompt

**Files:** `src/core/config.js`, `src/features/job-finder/main.js`

---

## Phase 3 — Prompt + Extraction Quality (Medium)
**Status:** Complete — da205eb

Two sub-changes:
1. **Pre-check gate**: cheap Gemini call — "does this email contain job listings?" — route non-jobs to NoJobs label before full extraction
2. **Richer extraction prompt**: add `employmentType`, `workArrangement` (Remote/Hybrid/Onsite), `experienceLevel` fields; fix URL-to-job matching by extracting anchor text+URL pairs from HTML before stripping tags; add `confidence` field to filter low-quality extractions

**Files:** `src/features/job-finder/extractor.js`, `src/features/job-finder/main.js`

---

## Phase 4 — Data Quality Cleanup (Small)
**Status:** Complete — 923e1bf

- Remove `inferCareersUrl` — always wrong, adds noise
- Remove `Careers URL Status: "Inferred"` column write
- Reject rows where Company = "Unknown" AND Title = "Unknown Position"
- Normalize location format in prompt: "City, State" or "Remote" only
- Stop writing `URL Status: "Not found"` — leave blank instead

**Files:** `src/features/job-finder/extractor.js`, `src/features/job-finder/sheets-handler.js`

---

## Backlog
| ID | Item |
|----|------|
| WARN-20 | Add regression test: assetsolutions.com URL NOT filtered (assets. fix false-positive guard) |
| WARN-21 | Add test: isJobListingEmail `{success:true, response:undefined}` returns false (not throw) — extractor.js:60 benign branch (from fix-gemini-429-pipeline) |

---

## Phase 5 — Gemini 429 Pipeline Fix (Small)
**Status:** Complete — fix-gemini-429-pipeline

Gemini 429/503 errors were breaking the job-finder pipeline: empty Sheet + silently archived/lost emails. callGemini now throws RATE_LIMIT_REACHED on 429/503 and on RESOURCE_EXHAUSTED/error.code 429; isJobListingEmail precheck re-throws RATE_LIMIT_REACHED (and other API failures) instead of returning false, so emails are queued (markEmailAsRateLimited) rather than archived as no-jobs.

**Files:** `src/core/api-service.js`, `src/features/job-finder/extractor.js`
