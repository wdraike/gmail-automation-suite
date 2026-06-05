# Oscar Review — Phase 3: Pre-check Gate + Richer Extraction — 2026-06-05

## Verdict: WARN

## Summary
Phase 3 complete and correct. 54/54 tests pass. No critical or blocking findings from any agent. Six backlog-level items deferred: anchor pair filtering in prompt, `processEmailContent` missing anchorPairs arg, anchor cap size, truncation assertion loosse bound, `_confidence=null` behavior, and `_confidence=0` boundary test.

## Agent Findings

### Ernie — PASS
No critical findings. Three warnings deferred to backlog.
| # | Severity | Finding | File:Line | Remediation |
|---|----------|---------|-----------|-------------|
| 1 | WARN | `anchorPairs` injected into prompt without tracking/social filtering — pollutes link-mapping section | extractor.js:168-170 | Apply same filter predicate as `relevantUrls` before building anchorSection |
| 2 | WARN | `processEmailContent` calls `extractJobDetailsSimple` without `anchorPairs` (4th arg missing) | extractor.js:529 | Pass anchorPairs or document intentionally anchor-free |
| 3 | WARN | `anchorPairs.slice(0, 100)` can add ~4KB to prompt on large emails | extractor.js:170 | Reduce cap to 30, or filter by job-keyword anchor text first |
| 4 | Info | `isJobListingEmail` error path silently returns false — Gemini outage routes all emails to NoJobs | extractor.js:19-22 | Track pre-check errors separately from legit NoJobs verdicts |
| 5 | Info | Operator-precedence ambiguity (pre-existing) in URL filter condition | extractor.js:96 | Add explicit parens |
| 6 | Info | `_confidence` leading-underscore convention undocumented | extractor.js:264 | Add comment: filter-only, not stored to sheet |

### Telly — PASS
54/54 tests passing. All new Phase 3 functions fully covered: `isJobListingEmail` (5 cases), `extractAnchorPairs` (5 cases), `extractTextFromHtml` anchorPairs propagation, new extraction fields (present + defaulted), anchor pairs in prompt, pre-check gate (skip + pass-through), confidence filtering (below/boundary/missing).

### Zoe — PASS
No false passes. Three WARN items (truncation assertion loose bound, `_confidence=null` edge case, `_confidence=0` boundary) — all deferrable.

## Fix Loop
No fix loop run — no BLOCK findings.

## Completeness
| Check | Result |
|-------|--------|
| Tests exist for changed code | PASS |
| Tests passing | PASS |
| Docs updated (if API changed) | PASS (no external API change) |
| Security review run (if auth/payment) | N/A |

## Backlog Items (WARN)
| Finding | File |
|---------|------|
| Anchor pairs not filtered before prompt injection (tracking/social links leak into link-mapping section) | src/features/job-finder/extractor.js:168-170 |
| `processEmailContent` missing anchorPairs arg — anchor URL matching silently absent on that path | src/features/job-finder/extractor.js:529 |
| Anchor cap of 100 may push large-email prompts close to context limit | src/features/job-finder/extractor.js:170 |
| Truncation test assertion too loose — would pass a 4999-char implementation | tests-local/job-finder-extractor.test.js:42 |
| `_confidence=null` edge case untested — silently drops the job (may be unintended) | tests-local/job-finder-main.test.js |
| `_confidence=0` boundary not explicitly tested | tests-local/job-finder-main.test.js |

## Kermit Report
Verdict: WARN
Completeness gaps: none
Backlog items: 6
Ready to commit: yes

## Status: PASS
_Signed: Oscar — 2026-06-05T00:00:00Z_
