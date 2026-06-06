# Test Review — 2026-06-06 (fix-nojobs-false-negatives)

## Summary
543 passed / 0 failed / 9 skipped across the full suite (baseline was 536 passed — 7 new tests added). Extractor focused suite: 57/57 pass. Coverage on extractor.js 78% lines / 79% branch (above WARN floor; uncovered lines are the live-Gemini call path and logging/source helpers, out of scope for this leg). Mutation check confirms the new zero-width tests genuinely fail when the strip is removed.

## Test Results

| Suite | Tests | Passed | Failed | Skipped | Time |
|-------|-------|--------|--------|---------|------|
| job-finder-extractor (focused) | 58 | 58 | 0 | 0 | ~1.3s |
| full suite | 553 | 544 | 0 | 9 | ~4s |

(Post-Zoe: +1 discriminating test for the MSO-comment/VML strip — see ZOE-REVIEW.md resolution.)

## Failed Tests
None.

## Coverage Gaps

| File | Line % | Branch % | Status |
|------|--------|----------|--------|
| src/features/job-finder/extractor.js | 78% | 79% | PASS (changed lines all covered; uncovered = live-Gemini path + logging helper, intentionally untested per repo convention) |

## New Tests (this leg)

| Test | Guards |
|------|--------|
| retains Glassdoor tail job markers within the prompt budget | Northrop/Sr. Staff Chief Engineer/Rolling Meadows survive 30000-char window |
| strips MSO conditional / VML / CSS noise from Glassdoor HTML | no roundrect/mso-/@font-face/v-text-anchor in plainText |
| strips zero-width characters injected inside words | synthetic obfuscated word reconnects; MUTATION-VERIFIED fails without strip |
| removes the high-volume zero-width runs from the Glassdoor digest | real 99K fixture has zero ZW chars; MUTATION-VERIFIED |
| buildExtractionPrompt is exported as a function | export contract |
| includes digest/aggregator guidance instructing extraction of every block | digest prompt guidance present |
| preserves the JSON contract and CRITICAL RULES | refactor did not drop JSON shape / rules |

## Assertion Strength
Strong. Tests assert specific substrings and use a negative regex for zero-width residue. Marker test mirrors the production cleaning+truncation pipeline (same `\s+` collapse + 30000 substring) rather than asserting on raw plainText, so it tests the real window Gemini sees. Mutation testing confirmed the zero-width and (by construction) digest tests are not vacuous.

## Flakiness
None — all transforms are pure/deterministic; no timers, network, or randomness. Re-runs stable.

## Status: PASS

_Signed: Telly — 2026-06-06T00:00:00Z_
