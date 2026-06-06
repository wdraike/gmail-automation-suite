# Zoe Review — 2026-06-06 (fix-nojobs-output-truncation)

## Summary
I ran live mutation tests against every load-bearing assertion. The salvage and
prompt-injection tests are real guards (mutations produced RED). I found one
false-pass (MAX_TOKENS warning-branch test matched the always-on finishReason log
rather than the warning), flagged it, and it was fixed in this same review:
the assertion now targets the distinct `/output was truncated/i` text and a
re-mutation of the warning branch produces RED. Verdict: PASS (0 open findings).

## Telly Audit

### BLOCK Findings
None.

### WARN Findings
| # | Finding | Evidence | File | Status |
|---|---------|----------|------|--------|
| 1 | (RESOLVED) The MAX_TOKENS test originally asserted `/MAX_TOKENS|truncat/i`, which the always-on `Gemini finishReason: MAX_TOKENS` log already satisfied — mutating the warning branch off left it GREEN. | Now asserts `/output was truncated/i` (distinct warning text). Re-mutation of the warning branch → RED, confirming isolation. | api-service.test.js:~404 | FIXED |

### PASS Verifications (mutation-confirmed)
| # | Check | Evidence |
|---|-------|----------|
| 1 | Salvage test exercises the real no-`]` path | Built string has zero `]`; `/\[[\s\S]*\]/.test()` returns false → salvage branch hit |
| 2 | Salvage test is not vacuous | Mutated `salvageTruncatedJobArray` to `return []` → "salvages the complete jobs" went RED |
| 3 | "still returns []" exercises salvage failure, not the empty-input guard | emailText="Big digest" (truthy); input `[{"company":"Acme","jobTit` has `[`@0 but no `}` → salvage's `lastBrace===-1` guard returns [] via the salvage path |
| 4 | "does not affect well-formed array" proves passthrough | Valid array never reaches salvage (happy path), asserts count+value |
| 5 | Prompt "does NOT inject" tests are real guards | Mutated buildExtractionPrompt to re-inject params + tokens → all 3 injection tests + jobUrl test went RED |
| 6 | finishReason logging verified | "logs finishReason from the candidate" asserts Logger called with "finishReason" |
| 7 | Source restored byte-identical after mutations | `diff -q` clean on both files; suite 112 passed/1 skipped |

## Status: PASS

_Signed: Zoe — 2026-06-06T00:00:00Z_
