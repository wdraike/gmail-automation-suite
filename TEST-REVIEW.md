# Test Review — 2026-06-06 (drop-precheck-bump-throughput)

## Summary
Full jest: 536 passed, 0 failed, 9 skipped (545 total). All changed behavior is covered by RED-first tests that were confirmed failing before implementation.

## Test Results

| Suite | Status | Notes |
|-------|--------|-------|
| config.test.js | PASS | MAX_EMAILS_PER_RUN === 10 lock updated |
| job-finder-main.test.js | PASS | precheck block removed; extraction-direct + confidence-0.3 + rate-limit tests added |
| job-finder-extractor.test.js | PASS | isJobListingEmail describe removed; extraction + RATE_LIMIT_REACHED retained |
| full suite (20 suites) | PASS | 0 failures |

## Coverage of Changed Behavior

| Change | Covering Test | Verified |
|--------|---------------|----------|
| MAX_EMAILS_PER_RUN = 10 (config) | "sets MAX_EMAILS_PER_RUN to 10" | PASS |
| getThreads limit -> (0,10) | "fetches new threads using the limit from JOB_FINDER_CONFIG (0, 10)" | PASS |
| combined trim to 10 | "trims combined rate-limited + new threads to MAX_EMAILS_PER_RUN (10)" | PASS |
| extraction runs without pre-check | "runs full extraction directly without any pre-check gate" | PASS |
| rate-limit -> markEmailAsRateLimited (not NoJobs) | "marks the thread rate-limited (not NoJobs) when extraction rate-limits" | PASS |
| confidence 0.4 now WRITTEN | "WRITES a job with confidence 0.4 (was dropped at the old 0.5 gate)" | PASS |
| confidence 0.2 dropped AND logged | "filters out jobs with confidence below 0.3 AND logs the dropped job" | PASS |
| exactly 0.3 kept | "keeps jobs where _confidence is exactly 0.3" | PASS |
| null/0 dropped | two dedicated tests | PASS |
| isJobListingEmail tests removed | grep count = 0 in extractor test | PASS |
| extraction RATE_LIMIT_REACHED retained | grep count = 2 (extractor) + 13 (api-service) | PASS |

## Failed Tests
None.

## Coverage Gaps
None for the changed surface.

## Status: PASS

_Signed: Telly — 2026-06-06T00:00:00Z_
