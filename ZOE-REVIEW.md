# Zoe Review — 2026-06-06 (fix-processjobemails-timeout)

## Summary
Both behavior changes (deadline guard + in-process sleep caps) are guarded by mutation-verified tests. I ran two live mutations and confirmed each produces RED, then restored the source. No false passes on the fixed behavior. One WARN on a latent vacuous-truth in the sleep assertion, but it is backstopped by the throw + no-fetch assertions in the same test, which the mutation proved are the real guards. Verdict: PASS (WARN noted, not blocking).

## Telly Audit

### BLOCK Findings
| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| — | None | — | — | — |

### WARN Findings
| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| 1 | The pre-wait test's sleep assertion `slept.every(ms => ms <= MAX_INPROCESS_WAIT_MS)` is vacuously true if `Utilities.sleep` is never called (empty array → `.every()` === true). On its own it would NOT catch a regression that skips sleeping entirely. | tests-local/api-service.test.js, "does NOT sleep a long rate-limit pre-wait" | tests-local/api-service.test.js | Not blocking: the same test ALSO asserts `toThrow('RATE_LIMIT_REACHED')` and `UrlFetchApp.fetch` NOT called — the discriminating guards. Mutation (always-sleep) confirmed the test fails. Optional hardening: add `expect(slept).not.toContainEqual(expect.any(Number) > cap)` style or assert the specific 60100 value is absent. |

### PASS Verifications
| # | Check | Status |
|---|-------|--------|
| 1 | Deadline guard test non-vacuous | PASS — MUTATION: deleted the `if (Date.now()-startTime >= EXECUTION_BUDGET_MS){...break}` block → "stops the loop and defers remaining threads" went RED (t2/t3 getMessages were called, deferredCount undefined). Source restored, re-green. |
| 2 | Pre-wait cap test non-vacuous | PASS — MUTATION: replaced the cap-bail with unconditional `Utilities.sleep` → "does NOT sleep a long rate-limit pre-wait" went RED (caught via throw + no-fetch). Source restored, re-green. |
| 3 | Clock-mock call accounting correct | PASS — startTime consumes tick[0]=0; iter0 guard-check tick[1]=0 (under → process t1); iter1 guard-check tick[2]=budget+1 (over → break). t1 processed, t2/t3 deferred. Verified by asserting per-thread getMessages call state. |
| 4 | checkRateLimit produces waitTime > cap in pre-wait test | PASS — MAX_CALLS_PER_MINUTE timestamps at `now` → length===MAX → rateLimited, waitTime = 60000-(now-oldest) ≈ 60000 > 20000 cap. |
| 5 | "budget never exceeded" test is the lower-bound complement (proves guard does not false-trip), correctly stayed GREEN under the delete-guard mutation | PASS — expected behavior; the discriminating test is the budget-exceeded one. |
| 6 | Backoff-cap test | PASS — spies every sleep value; with current config backoffs (1000/2000/4000) all ≤ cap, so it guards the no-regression case. |
| 7 | Full suite 577/0/9; source byte-identical after each mutation/restore (git diff stat unchanged) | PASS |
| 8 | Removed `\|\| 0` (Ernie WARN-1) did not weaken any test — re-ran green | PASS |

## Status: PASS (1 WARN, backstopped by sibling assertions + mutation evidence)

_Signed: Zoe — 2026-06-06T00:00:00Z_
