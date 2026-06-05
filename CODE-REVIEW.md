# Code Review — src/features/job-finder/ — 2026-06-05

## Summary
Ship-ready. All 13 WARN backlog items addressed correctly. Two real bugs fixed (operator-precedence on URL filter, location fallback returning 'Not specified'), dead code removed (processEmailContent), anchorPairs capped at 30 with noise filtering, and label-cleanup symmetry restored in markEmailAsNoJobs. No new critical issues introduced.

## Critical Findings (must fix before merge)
_None._

## Warning Findings (fix this sprint)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| 1 | `'r.'` in ANCHOR_NOISE_DOMAINS matches legitimate domains (e.g. `career.com`, `director.jobs`) | extractor.js:169 | Use `'/r/'` or `'r.email'` as a more targeted pattern. Backlog item — does not block. |
| 2 | `(lower.includes('e.') && lower.includes('.com/'))` URL filter still overly broad — matches `e.g.` in query strings | extractor.js:96 | Pre-existing pattern narrowed by parens fix but still imprecise. Consider regex. Backlog item. |

## Info / Suggestions
| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | `extractJobDetailsSimple` is 248 lines — consider extracting `buildGeminiPrompt()` and `mapGeminiJobToRow()` helpers | extractor.js:52 | Readability improvement, not urgent |
| 2 | `ANCHOR_NOISE_DOMAINS` declared inside function body on every call | extractor.js:169 | Lift to module-level const to avoid repeated allocation |

## Checklist Status
- [x] Complexity — PASS (no new nesting added)
- [x] Error handling — PASS (no new unhandled paths)
- [x] Test coverage — PASS (all new behaviors tested, 64/64 passing)
- [x] Observability — PASS (Logger.log throughout)
- [x] Scalability — PASS
- [x] Dead code — PASS (processEmailContent removed cleanly)

## Status: PASS

_Signed: Ernie — 2026-06-05T00:00:00Z_
