# Test Review — WARN-14 + WARN-15 URL Filter Fixes — 2026-06-05

## Summary
42 tests passed, 0 failed across extractor suite. 6 new regression and behaviour tests added for
WARN-14 (r. too broad in anchor noise filter) and WARN-15 (imprecise substring URL filter). All
changed lines in extractor.js are covered by new tests. Two pre-existing uncovered functions
(extractEmailSource, logJobFinderGeminiInteraction) remain gaps but are unchanged by this PR.

## Test Results

| Suite | Tests | Passed | Failed | Skipped | Time |
|-------|-------|--------|--------|---------|------|
| job-finder-extractor.test.js | 42 | 42 | 0 | 0 | <1s |
| **Total** | **42** | **42** | **0** | **0** | **<1s** |

## Failed Tests
_None._

## Coverage — extractor.js (this PR scope only)

| File | % Stmts | % Branch | % Lines | % Funcs | Status |
|------|---------|----------|---------|---------|--------|
| extractor.js | 76.3% | 77.6% | 76.4% | 88.9% | PASS (>50%) |

**Note:** Global coverage threshold failure when running single test suite is a pre-existing
project configuration issue — thresholds are set for full suite runs, not isolated file runs.

## WARN-14 / WARN-15 Coverage Map

| Item | Change | Test(s) | Status |
|------|--------|---------|--------|
| WARN-14 (URL filter) | `r.` removed; hostname-anchored regex replaces `click.`/`track.` substring checks | `does NOT filter out career.com URLs`, `does NOT filter out director.jobs URLs`, `filters out r.example.com redirect URLs` | PASS |
| WARN-14 (anchor filter) | `r.`, `click.`, `track.`, `email.`, `go.` removed from ANCHOR_NOISE_DOMAINS; replaced with `ANCHOR_TRACKING_SUBDOMAIN_RE` regex on hostname | `keeps career.com anchor pairs`, `filters r.example.com anchor pairs` | PASS |
| WARN-15 | `click.`/`track.` substring → `/^(click\|track\|email\|go\|r)\./i` regex anchored to hostname | `filters out click.example.com tracking URLs`, `filters out tracking and social URLs` (track.foobar.com) | PASS |

## Missing Tests (pre-existing gaps, unchanged by this PR)

| File | Untested Entities | Priority |
|------|-------------------|----------|
| extractor.js:470–493 | `extractEmailSource` — all branches | LOW — utility only |
| extractor.js:500–532 | `logJobFinderGeminiInteraction` — error storage path (requires PropertiesService mock) | LOW — logging only |

## Status: PASS

_Signed: Telly — 2026-06-05T00:00:00Z_
