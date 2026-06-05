# Zoe Review — fix-gemini-429-pipeline — 2026-06-05

## Summary
Tests are sound. No false passes. The assertions genuinely distinguish the new
RATE_LIMIT_REACHED behavior from the old generic-error behavior, the "greedy
branch" guard is real, and the masked-failure claim checks out. One minor
coverage gap (WARN) for the `{success:true, response:undefined}` branch — does
NOT block; it is not on the email-loss regression path.

## Telly Audit

### BLOCK Findings
| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| — | None | — | — | — |

### WARN Findings
| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| 1 | The `{success:true, response:undefined/empty}` branch (extractor.js:60 `if (!result.response) return false`) has no dedicated test. It returns false (-> NoJobs), which is legitimate, not the loss bug — but it is an untested conditional. | extractor.js:60 | Backlog: add a test asserting `{success:true}` with no `response` returns false (not throw). Low priority. |

### PASS Verifications (adversarial points answered)
| # | Challenge | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Does `toThrow('RATE_LIMIT_REACHED')` pass for the wrong reason? | PASS | Substring match. The OLD 429 path threw `"API returned status 429: ..."` which does NOT contain "RATE_LIMIT_REACHED". RED phase confirmed the prior `.toThrow('429')` assertion had to change. The assertion genuinely separates new from old. |
| 2 | Is the generic-error test a real guard against an over-greedy branch? | PASS | api-service.test.js:446-449 uses `expect(err.message).not.toBe('RATE_LIMIT_REACHED')` (exact) AND `toContain('Bad request')`. If a future change made callGemini throw the sentinel for a 400, BOTH assertions fail. Real guard. |
| 3 | Extractor non-RL test — does the double-call assertion hold? | PASS | extractor.test.js:46-60. Mock is a stable `jest.fn(() => ({success:false, error:'...Unexpected...'}))` returning the same object on both calls. `toThrow()` proves it throws; the second invocation captures `e.message` and asserts `not.toBe('RATE_LIMIT_REACHED')`. Meaningful. |
| 4 | Did Telly mask a real failure as "pre-existing"? | PASS | Re-ran the 3 suites. All 10 failures are: Sheets Handler addJobToSpreadsheet/getExistingJobs/getJobStatistics, CSV Handler importPendingJobCsvs (5), Gmail Add-on createDashboardCard. NONE reference callGemini, isJobListingEmail, rate limiting, or 429. Unrelated to this change. Stash-verification trustworthy. |
| 5 | Missing edge case enabling regression? | PARTIAL (see WARN-1) | The loss-bug regression paths (thrown RL, {success:false} RL, {success:false} non-RL, null) are all covered and assert throw-not-false. The only uncovered branch is the benign `{success:true, response:undefined}` -> returns false, which is correct legacy behavior, not the bug. |

## Status: PASS

_Signed: Zoe — 2026-06-05T00:00:00Z_
