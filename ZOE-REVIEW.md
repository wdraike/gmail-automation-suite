# Zoe Review — 2026-06-06 (fix-nojobs-false-negatives)

## Summary
The real bug (zero-width obfuscation + missing digest prompt guidance) is solidly covered by mutation-verified tests. However, two of the seven new tests are VACUOUS for the supplied fixture: they pass even when the new comment-strip and VML-strip code is removed, because the pre-existing generic `<[^>]+>` tag-strip already eliminates that noise for this specific email. No false-pass on the actually-fixed behavior. Verdict: WARN (overclaiming regression guards), not BLOCK.

## Telly Audit

### BLOCK Findings
| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| — | None | — | — | — |

### WARN Findings
| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| 1 | Test "retains Glassdoor tail job markers within the prompt budget" passes even with the new comment-strip + VML-strip lines removed (script/style kept). Mutation: removed lines 406 (`<!--...-->`) + 412–413 (VML) → 57/57 still green. The generic `<[^>]+>` strip already handles this fixture's noise. | extractor.js:406,412-413 vs test:88-101 | tests-local/job-finder-extractor.test.js | Add a fixture/case where tag-strip alone fails (e.g. MSO `<!--[if mso]>` wrapping visible-looking junk text, or VML with inner text that survives tag-strip), so the test actually depends on the new code. OR relabel as defense-in-depth and accept it does not regress-guard the new lines. |
| 2 | Test "strips MSO conditional / VML / CSS noise from Glassdoor HTML" — same vacuity. Asserts absence of roundrect/mso-/@font-face/v-text-anchor, but these are absent for this fixture even without the new strips (generic tag-strip + style-strip already remove them). | extractor.js:406,412-413 vs test:103-109 | tests-local/job-finder-extractor.test.js | Same as #1. |

### PASS Verifications
| # | Check | Status |
|---|-------|--------|
| 1 | Zero-width strip tests non-vacuous (synthetic + 99K fixture) | PASS — mutation: removing line 437 → both fail |
| 2 | Digest-prompt guidance test non-vacuous | PASS — mutation: removing DIGEST block → test fails |
| 3 | buildExtractionPrompt export + JSON contract assertions | PASS — meaningful substring checks |
| 4 | Marker test mirrors real cleaning+truncation pipeline (not raw plainText) | PASS |
| 5 | Full suite 543/0/9, no flakiness, file restored byte-identical after each mutation | PASS |
| 6 | No happy-path-only gaps on the actual fix; empty-input + absent-field paths already covered by pre-existing tests | PASS |

## Resolution (post-review)
WARN-1/WARN-2 addressed: added test "removes text inside MSO comments and VML elements that survives a tag-only strip" (test:~111-124). Engineered so the inner text of `<!--[if mso]>...<![endif]-->` and `<v:roundrect>...</v:roundrect>` survives a generic tag-only strip — only the new comment-strip + VML-strip remove it. Mutation-verified: passes with real code (58/58 focused), fails when the new strip lines are removed. The new comment/VML code is now genuinely regression-guarded. The original (a)/(b) tests remain as fixture-level smoke checks. Full suite now 544/0/9.

## Status: PASS (WARN items resolved via mutation-verified discriminating test)

_Signed: Zoe — 2026-06-06T00:00:00Z_
