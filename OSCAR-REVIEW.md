# Oscar Review — 2026-06-06 (fix-nojobs-false-negatives)

## Verdict: PASS

## Summary
fix-nojobs-false-negatives is complete and correct. extractor.js now strips MSO/VML/comment/CSS noise and zero-width obfuscation before truncation, and the Gemini prompt (extracted to a testable `buildExtractionPrompt`) carries digest/aggregator guidance. Ernie PASS, Telly PASS, Zoe initially WARN (two vacuous regression guards) — resolved inline with a mutation-verified discriminating test. All checks green; ready to commit.

## Agent Findings

### Ernie (code quality) — PASS
No Critical/Warning. Two Info notes (VML non-nesting assumption is safe; zero-width literal-vs-escape is cosmetic). Regexes verified bounded (~3ms on 99K input); all 6 zero-width codepoints present; no fallbacks added.

### Telly (tests) — PASS
58/58 focused, 544/0/9 full suite. extractor.js coverage 78% line / 79% branch (uncovered = live-Gemini path + logging helpers, out of scope). New behavior all exercised.

### Zoe (adversarial) — PASS (after resolution)
Found that the original tail-marker and MSO-noise tests passed even with the new comment/VML strip removed (the pre-existing generic tag-strip already handled THIS fixture) — vacuous regression guards. Resolved by adding a discriminating test where the generic tag-strip alone cannot remove the noise (MSO-comment inner text + VML inner text). Mutation-verified: fails when the new strip lines are removed.

## Fix Loop
- Iteration 1: Zoe WARN (2 vacuous guards) → added 1 mutation-verified discriminating test → re-verified GREEN. No bert needed (test gap, not code defect).

## Completeness
| Check | Result |
|-------|--------|
| Tests exist for changed code | PASS |
| Tests passing | PASS (544/0/9) |
| Docs updated (if API changed) | N/A (internal helper; no external API/schema change) |
| Security review run (if auth/payment) | N/A (no security-sensitive files) |
| No unapproved fallbacks | PASS |
| maxLength raised? | No (noise-strip kept job text in existing 30000 budget) |

## Kermit Report
Verdict: PASS
Completeness gaps: none
Backlog items: 0
Ready to commit: yes

## Status: PASS
_Signed: Oscar — 2026-06-06T00:00:00Z_
