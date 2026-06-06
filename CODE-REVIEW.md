# Code Review — fix-nojobs-output-truncation (extractor + api-service) — 2026-06-06

## Summary
Ship-ready. The leg cleanly removes the URL/anchor output bloat that overran
Gemini's 8192-token output cap and adds an approved, JSON.parse-validated salvage
path for truncated arrays. No dead references, no hexagonal-boundary violations;
salvage degrades safely to `[]`/fallback on unparseable input. No Critical or
Warning findings.

## Critical Findings (must fix before merge)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| — | None | — | — |

## Warning Findings (fix this sprint)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| — | None | — | — |

## Info / Suggestions
| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | Salvage comment asserts "flat objects with no nested braces"; a `}` inside a free-text `companyDescription` value could in theory shift `lastIndexOf('}')`. In practice `JSON.parse` validates the candidate and returns `[]` on imbalance, so no bad data is ever emitted — only a rare missed salvage that degrades to fallback. | extractor.js:~330 | Acceptable as-is; if precision ever matters, do a brace-depth scan instead of `lastIndexOf`. Not blocking. |
| 2 | `extractedUrls`/`anchorPairs` params now unused by the prompt but retained for caller-signature stability (documented in JSDoc). | extractor.js:68,134 | Backlog: full removal of the URL pathway + Job URL/URL Status sheet columns (explicitly out-of-scope for this leg). |

## Checklist Status
- [x] Complexity — PASS (net -118 lines; salvage fn small and single-purpose)
- [x] Error handling — PASS (salvage wrapped in try/catch, logs failure, returns []; 429 path untouched)
- [x] Test coverage — PASS (salvage happy/empty/non-truncated + finishReason + MAX_TOKENS tests added)
- [x] Observability — PASS (finishReason + MAX_TOKENS warning + salvage-count logging added)
- [x] Scalability — PASS (removes per-call URL filter/dedup; no new loops)
- [x] API design — N/A (no HTTP routes)
- [x] No unapproved fallbacks — PASS (salvage is user-approved + commented; Job URL="" is a removed feature, not a fallback)
- [x] Dead code — PASS (removed constants + URL-filter block; zero orphan refs)
- [x] Hexagonal boundary — PASS (no forbidden tokens in extractor.js)

## Status: PASS

_Signed: Ernie — 2026-06-06T00:00:00Z_
