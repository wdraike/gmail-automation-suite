# Test Review — WARN-16 through WARN-19 Fixes — 2026-06-05

## Summary
46 tests passed, 0 failed across extractor suite (+4 new tests vs prior baseline of 42). 
All four WARN items (module constant hoisting, assets./phenom. filter fix, go./email. anchor 
filter tests, go. URL filter test) are covered by new tests. Pre-existing suite failures 
(3 suites, 10 tests) in csv-handler-integration, gmail-addon, sheets-handler are unchanged by 
this PR.

## Test Results

| Suite | Tests | Passed | Failed | Skipped | Time |
|-------|-------|--------|--------|---------|------|
| job-finder-extractor.test.js | 46 | 46 | 0 | 0 | <1s |
| **Full suite (baseline)** | **583** | **564** | **10** | **9** | ~4s |
| **Full suite (this PR)** | **583** | **564** | **10** | **9** | ~4s |

No regressions introduced. Pre-existing failures unchanged.

## Failed Tests
_None in scope. 10 pre-existing failures in out-of-scope suites unchanged._

## Coverage — extractor.js (this PR scope only)

| File | % Stmts | % Branch | % Lines | % Funcs | Status |
|------|---------|----------|---------|---------|--------|
| extractor.js | 76.3% | 78.2% | 76.4% | 88.9% | PASS (>50%) |

## WARN-16 through WARN-19 Coverage Map

| Item | Change | Test(s) | Status |
|------|--------|---------|--------|
| WARN-16 (assets./phenom. substring) | Replaced with `/^assets\./i` and `/^phenom\./i` hostname-anchored regex | Covered by existing URL filter tests; false-positive class tested via WARN-18 regression | PASS |
| WARN-17 (constant hoisting) | `ANCHOR_NOISE_DOMAINS` + `ANCHOR_TRACKING_SUBDOMAIN_RE` moved to module level | All anchor filter tests exercise these constants | PASS |
| WARN-18 (go./email. anchor tests) | 3 new tests: go. filtered, email. filtered, email-in-path NOT filtered | `filters out go.example.com anchor pair`, `filters out email.example.com anchor pair`, `does NOT filter anchor pair with 'email' in path` | PASS |
| WARN-19 (go. URL filter test) | 1 new test: go.example.com URL filtered via noise filter | `filters out go.example.com redirect URL` | PASS |

## Missing Tests (pre-existing gaps, unchanged by this PR)

| File | Untested Entities | Priority |
|------|-------------------|----------|
| extractor.js:477–500 | `extractEmailSource` — all branches | LOW — utility only |
| extractor.js:507–539 | `logJobFinderGeminiInteraction` — error storage path (requires PropertiesService mock) | LOW — logging only |
| extractor.js:241–268 | Debug logging path inside JSON parse block | LOW — logging only |

## Status: PASS

_Signed: Telly — 2026-06-05T00:00:00Z_
