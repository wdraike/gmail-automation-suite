# Code Review — src/features/job-finder/extractor.js + tests — 2026-06-05

## Summary
WARN-16 through WARN-19 are fully resolved. Module-level constants hoisted, `assets.` and `phenom.`
filters converted to hostname-anchored regex, and four new tests added covering `go.`/`email.`
subdomain filtering with regression guards. No critical or warning findings in this diff.

## Critical Findings (must fix before merge)
_None._

## Warning Findings (fix this sprint)
_None._

## Info / Suggestions
| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | `extractJobDetailsSimple` is ~248 lines — consider extracting `buildGeminiPrompt()` and `mapGeminiJobToRow()` helpers in a future refactor | extractor.js:60 | Readability improvement, not urgent |
| 2 | `ANCHOR_TRACKING_SUBDOMAIN_RE` is now shared between the URL filter (`relevantUrls`) and the anchor filter — both use the same module-level constant, which is correct and eliminates the duplication from WARN-17 | extractor.js:12 | No action needed |

## Checklist Status
- [x] Complexity — PASS (no new nesting in changed lines)
- [x] Error handling — PASS (URL parse errors caught in both filter paths)
- [x] Test coverage — PASS (46 tests pass; 4 new tests for WARN-18/19 including regression guard)
- [x] Observability — PASS (Logger.log retained throughout)
- [x] Scalability — PASS (module-level constants no longer recreated per call)
- [x] API design — N/A
- [x] Dead code — PASS (inline constants removed after hoisting)

## Status: PASS
_Signed: Ernie — 2026-06-05T00:00:00Z_
