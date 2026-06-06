# Code Review — fix-processjobemails-timeout — 2026-06-06

## Summary
Ship-ready with one minor cleanup. The deadline guard and sleep caps are correct: the loop always processes at least one email (no starvation), `deferredCount` math is right, and the RATE_LIMIT_REACHED throw inside the retry catch propagates to the outer catch that sets the cross-run backoff — matching the existing rate-limit path. One Warning: a defensive `|| 0` fallback that can never fire and violates the project no-fallback rule.

## Critical Findings (must fix before merge)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| — | None | — | — |

## Warning Findings (fix this sprint)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| 1 | Unapproved/dead fallback `batchResult.deferredCount \|\| 0` — `processEmailBatch` always initializes `results.deferredCount = 0` and both return paths return that same object, so the LHS is provably never undefined/null. The `\|\| 0` is defensive code that can never fire and violates the global no-fallback rule (papering over a value that "might" be missing). | src/features/job-finder/main.js:97 | Replace with `deferredCount: batchResult.deferredCount,` |

## Info / Suggestions
| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | Pre-wait bail threshold raised 5000→20000ms — intentional and within the 290s budget margin; small waits ≤20s now sleep in-process, larger waits bail to next run. Correct per leg intent. | src/core/api-service.js:191 | None — documented. |
| 2 | Backoff cap branch (backoffTime > 20000) is unreachable with current config (backoffs 1000/2000/4000) — defensive guard against future RETRY_DELAY_MS/MAX_RETRIES changes. Existing "retry up to MAX_RETRIES on 500" behavior unchanged (confirmed by test). | src/core/api-service.js:234 | None — acceptable defensive cap. |

## Checklist Status
- [x] Complexity — PASS (small localized changes, no nesting growth)
- [x] Error handling — PASS (throw propagates to existing outer catch; no swallowed errors)
- [x] Test coverage — PASS (4 new tests: 2 deadline guard, 2 sleep caps; RED→GREEN)
- [x] Observability — PASS (both new branches Logger.log structured context)
- [x] Scalability — PASS (deadline guard is the scalability fix itself)
- [x] API design — N/A
- [ ] No unapproved fallbacks — WARN (1 dead `|| 0` fallback)
- [x] Dead code — PASS (no commented-out blocks, no new TODOs)

## Status: ISSUES

_Signed: Ernie — 2026-06-06T00:00:00Z_
