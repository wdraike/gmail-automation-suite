# Code Review — src/features/job-finder/extractor.js (fix-nojobs-false-negatives) — 2026-06-06

## Summary
Ship-ready. The change is a focused, well-commented noise-strip + zero-width-strip in `extractTextFromHtml` plus a pure-refactor extraction of `buildExtractionPrompt` with added digest guidance. No bugs, no unhandled errors, no fallbacks introduced. All 6 zero-width codepoints verified present in the regex character class. Regexes run in ~3ms on the 99K fixture (no catastrophic backtracking).

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
| 1 | VML paired-tag regex does not handle nested same-name VML tags | extractor.js:412 | Not present in real email VML; any leftover opener is caught by the generic `<[^>]+>` strip at line 430. No action needed. |
| 2 | Zero-width regex uses literal invisible chars rather than `\u` escapes | extractor.js:437 | Codepoints verified correct (U+200B/200C/200D/200E/200F/FEFF). Literal form works in V8/Apps Script; `\uXXXX` would be more reviewer-legible if touched again. |

## Checklist Status
- [x] Complexity — PASS
- [x] Error handling — PASS (existing try/catch preserved; no new throws)
- [x] Test coverage — PASS (7 new tests, TDD RED→GREEN)
- [x] Observability — PASS (pure text transforms)
- [x] Scalability — PASS (~3ms on 99K input)
- [x] API design — N/A
- [x] Dead code — PASS
- [x] No unapproved fallbacks — PASS

## Status: PASS

_Signed: Ernie — 2026-06-06T00:00:00Z_
