# Test Review — fix-gemini-429-pipeline — 2026-06-05

## Summary
129 passed, 1 skipped, 0 failed across the 3 in-scope suites. RED-first TDD
confirmed (8 tests failed against pre-fix code, all green after). New tests
exercise every changed branch and assert the correct sentinel (RATE_LIMIT_REACHED)
vs. genuine NO behavior. No tests were deleted that should remain.

## Test Results (in-scope)

| Suite | Tests | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| tests-local/api-service.test.js | — | all | 0 | 1 |
| tests-local/job-finder-extractor.test.js | — | all | 0 | 0 |
| tests-local/job-finder-main.test.js | — | all | 0 | 0 |
| **Total** | **130** | **129** | **0** | **1** |

## New Tests Verified

### api-service.test.js — callGemini error cases
| Test | Exercises | Asserts |
|------|-----------|---------|
| 429 -> RATE_LIMIT_REACHED | responseCode 429 branch | throws "RATE_LIMIT_REACHED" |
| 503 -> RATE_LIMIT_REACHED | responseCode 503 branch | throws "RATE_LIMIT_REACHED" |
| body code 429 (200 status) | jsonResponse.error.code===429 | throws "RATE_LIMIT_REACHED" |
| RESOURCE_EXHAUSTED (200) | jsonResponse.error.status branch | throws "RATE_LIMIT_REACHED" |
| generic non-RL error body | error.code 400 / INVALID_ARGUMENT | throws, message != RATE_LIMIT_REACHED, contains "Bad request" |

### job-finder-extractor.test.js — isJobListingEmail
| Test | Exercises | Asserts |
|------|-----------|---------|
| thrown RATE_LIMIT_REACHED | catch + isRateLimitSignal | throws "RATE_LIMIT_REACHED" |
| {success:false, error:'...429...'} | failure branch + isRateLimitSignal | throws "RATE_LIMIT_REACHED" |
| non-RL {success:false} | failure branch fall-through | throws, message != RATE_LIMIT_REACHED |
| null result | `!result` branch | throws |
| {success:true,response:'NO'} | success branch | returns false |
| (retained) YES / whitespace YES / NO / 2000-char truncation | success branch | unchanged behavior |

### job-finder-main.test.js (end-to-end path, retained)
- "throws RATE_LIMIT_REACHED on 429 error" confirms processOneEmail queues the
  thread (markEmailAsRateLimited) and re-throws to stop the batch — i.e. the
  email is NOT archived as no-jobs.

## Out-of-Scope Pre-Existing Failures (NOT introduced by this change)
| Suite | Status | Note |
|-------|--------|------|
| gmail-addon.test.js | 10 failures total across these 3 | Verified pre-existing on baseline via `git stash` — identical failures with the fix removed. Out of scope for this bugfix. |
| sheets-handler.test.js | (included above) | Pre-existing |
| csv-handler-integration.test.js | (included above) | Pre-existing |

## Coverage Gaps
None for the changed code — every new conditional branch has a dedicated test.

## Status: PASS

_Signed: Telly — 2026-06-05T00:00:00Z_
