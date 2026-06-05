# Code Review — src/features/job-finder/extractor.js + tests — 2026-06-05

## Summary
WARN-14 and WARN-15 fixes are correct and well-tested. The hostname-anchored regex approach
properly scopes subdomain matching without false-positive risk on legitimate domains like
career.com and director.jobs. Two minor warnings deferred to backlog: residual substring
filters (`assets.`, `phenom.`) carry the same class of risk as the now-fixed `click.`/`r.`
filters, and the noise-filter constants are still defined inside the hot call path.

## Critical Findings (must fix before merge)
_None._

## Warning Findings (fix this sprint)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| 1 | `assets.` and `phenom.` substring URL filters carry same false-positive risk as the `click.`/`r.` filters fixed in this PR — `assetsolutions.com` or any domain containing `phenom.` would be wrongly excluded | extractor.js:104-106 | Convert to hostname-anchored check or exact-domain match in a follow-up PR |
| 2 | `ANCHOR_NOISE_DOMAINS` array and `ANCHOR_TRACKING_SUBDOMAIN_RE` regex are re-instantiated on every `extractJobDetailsSimple` call when anchorPairs is non-empty | extractor.js:171-173 | Hoist both to module-level constants |

## Info / Suggestions
| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | `ct.sendgrid.net` removed as redundant — broader `sendgrid.net` check already covers it. Correct removal. | extractor.js:87 | No action needed |
| 2 | `(lower.includes('e.') && lower.includes('.com/'))` compound heuristic removed — was fragile (matched `e.g.` in query strings) and now superseded by hostname regex. Correct removal. | extractor.js (deleted) | No action needed |
| 3 | `extractJobDetailsSimple` is ~248 lines — consider extracting `buildGeminiPrompt()` and `mapGeminiJobToRow()` helpers in a future refactor | extractor.js:52 | Readability improvement, not urgent |

## Checklist Status
- [x] Complexity — PASS (no new nesting in changed lines)
- [x] Error handling — PASS (URL parse errors caught; malformed anchor URL kept, not silently dropped)
- [x] Test coverage — PASS (6 new regression + behaviour tests; all 42 pass)
- [x] Observability — PASS (Logger.log retained throughout)
- [x] Scalability — PASS
- [x] API design — N/A
- [x] Dead code — PASS

## Status: PASS
_Signed: Ernie — 2026-06-05T00:00:00Z_
