# Code Review — job-finder Phase 3 — 2026-06-05

## Summary

Phase 3 changes are solid. Pre-check gate, anchor-pair extraction, new fields, and confidence filter are all correctly wired. Two warnings worth noting: (1) `anchorPairs` injected into the Gemini prompt are not filtered the way `extractedUrls` are — tracking and social anchors will appear in the prompt even though their URL counterparts are filtered; (2) `processEmailContent` (legacy helper) doesn't pass `anchorPairs` to `extractJobDetailsSimple`, so anchor-based URL matching silently absent on that path. Neither blocks shipping.

## Critical Findings (must fix before merge)

_None._

## Warning Findings (fix this sprint)

| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| 1 | `anchorPairs` passed to prompt without the same tracking/social filtering applied to `extractedUrls`. Tracking anchors (sendgrid, linkedin, unsubscribe etc.) will pollute the link-mapping section. | extractor.js:168-170 | Apply the same filter predicate used for `relevantUrls` before building `anchorSection`, or at minimum strip known tracking domains. |
| 2 | `processEmailContent` calls `extractJobDetailsSimple` without `anchorPairs` (4th arg missing). Anchor-based URL matching silently absent on that code path. | extractor.js:529 | Pass `anchorPairs` as 4th arg, or document that this helper is intentionally anchor-free. |
| 3 | `anchorPairs.slice(0, 100)` can inject up to 100 anchor entries into the Gemini prompt on top of the URL section and full email body. On large emails near the 30 KB text cap this could push the prompt close to model context limits. | extractor.js:170 | Reduce cap from 100 to 30, or filter anchor pairs to job-keyword anchor text only before slicing. |

## Info / Suggestions

| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | `isJobListingEmail` silently returns `false` on API error. A Gemini outage routes all emails to NoJobs with no distinguishing signal. Already logged — but consider a separate error counter so operators can detect the failure mode. | extractor.js:19-22 | Track pre-check errors separately from legit NoJobs verdicts. |
| 2 | Operator-precedence ambiguity inherited from prior code: `lower.includes('e.') && lower.includes('.com/')` in multi-line `||` chain reads as if top-level. No behaviour bug but confusing. | extractor.js:96 | Add explicit parens: `(lower.includes('e.') && lower.includes('.com/'))` |
| 3 | `_confidence` leading-underscore convention is undocumented. If a caller iterates job keys to write to sheet directly, the field would appear as a column. | extractor.js:264 | Add a brief comment: filter-only field, not stored to sheet. |

## Checklist Status

- [x] Complexity — PASS (functions well-scoped, no God classes introduced)
- [x] Error handling — PASS (pre-check failures caught and logged; rate limit propagated correctly)
- [x] Test coverage — PASS (54 tests; pre-check gate, confidence filter, anchor pairs, new fields all covered)
- [x] Observability — PASS (Logger.log at all key decision points)
- [x] Scalability — WARN (anchor section prompt size, see Warning #3)
- [x] API design — N/A (no HTTP routes changed)
- [x] Dead code — PASS (no TODOs added, no commented-out blocks)

## Status: PASS

_Signed: Ernie — 2026-06-05T00:00:00Z_
