# Code Review — job-finder (drop-precheck-bump-throughput) — 2026-06-06

## Summary
Ship-ready. The change is surgical and correct: the cost-saving `isJobListingEmail` pre-check is fully removed (function + export + caller block), the confidence gate is lowered 0.5 -> 0.3 with a guarded log of dropped jobs, and throughput knobs are bumped. Rate-limit safety is preserved through the unchanged `wasRateLimited` / `RATE_LIMIT_REACHED` -> `markEmailAsRateLimited` paths. No unapproved fallbacks. No dangling references to the deleted function.

## Critical Findings (must fix before merge)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| – | None | – | – |

## Warning Findings (fix this sprint)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| – | None | – | – |

## Info / Suggestions
| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | Removing the pre-check removes one early "not a job email" archive path; genuinely-empty extractions now fall through to the `validJobs.length === 0 -> markEmailAsNoJobs` branch instead. This is the intended behavior (the pre-check was mis-filing real jobs) and is correctly handled downstream. | main.js:~315 | None — informational. |
| 2 | `baseValid` is iterated twice (validJobs + droppedByConfidence). Negligible for <=10 emails/run; readability win outweighs cost. | main.js:~322 | None. |

## Checklist Status
- [x] Complexity — PASS
- [x] Error handling — PASS (rate-limit propagation intact; catch block unchanged)
- [x] Test coverage — PASS (RED-first tests added)
- [x] Observability — PASS (added Confidence-dropped log; Filters log preserved)
- [x] Scalability — PASS
- [x] No unapproved fallbacks — PASS (getApiKey override is approved prior-leg design, untouched)
- [x] Dead code — PASS (deleted function fully removed incl. export)

## Status: PASS

_Signed: Ernie — 2026-06-06T00:00:00Z_
