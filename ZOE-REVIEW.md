# Zoe Review — WARN-16 through WARN-19 Fixes — 2026-06-05

## Summary
46/46 tests pass. No false passes, no shallow assertions found. All 4 new tests assert real
behavioral outcomes (URL presence/absence in Gemini prompt string), not just `toBeDefined()`.
WARN-16 fix (assets./phenom. hostname anchoring) was probed manually across 8 boundary cases —
all correct. One WARN finding: no test for `assets.` subdomain false-positive regression (the
analogous gap to WARN-16 for the URL filter). Deferred — not a blocker.

## Telly Audit

### BLOCK Findings
_None._

### WARN Findings

| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| 1 | No test for `assets.` subdomain filter regression (WARN-16 analog). The old `lower.includes('assets.')` would have filtered `assetsolutions.com` or `assets-cdn.jobs.com`. The new `/^assets\./i` regex fixes this, but there is no test asserting `https://assetsolutions.com/careers` passes through. Mirrors the WARN-14 regression test pattern. | tests-local/job-finder-extractor.test.js (missing) | extractor.js:117 | Add: `it("does NOT filter assetsolutions.com URLs (WARN-16 regression)")` |

### PASS Verifications

| # | Check | Status |
|---|-------|--------|
| 1 | WARN-18: `go.example.com` anchor filtered — negative assertion on prompt string | PASS |
| 2 | WARN-18: `email.example.com` anchor filtered — negative assertion on prompt string | PASS |
| 3 | WARN-18 regression: `https://jobs.com/email-marketing` anchor KEPT — positive assertion verified | PASS |
| 4 | WARN-19: `go.example.com` URL filtered — negative assertion on prompt string | PASS |
| 5 | No `toBeDefined()`-only assertions — all 4 new tests check real prompt content | PASS |
| 6 | No mock leakage — each test uses fresh `jest.fn()` with `beforeEach clearAllMocks` | PASS |
| 7 | `assets.example.com/style.css` filtered; `myassets.com` kept; `jobs.com/assets/style.css` kept — manually probed | PASS |
| 8 | `phenom.example.com` filtered; `myphenom.com` kept; `jobs.com/phenom-people/apply` kept — manually probed | PASS |
| 9 | `google.com` NOT filtered by `go.` regex (go. not a subdomain of google.com) — probed | PASS |
| 10 | `goodjobs.com` NOT filtered by `go.` regex — probed | PASS |
| 11 | `go.greenhouse.io` filtered; `email.lever.co` filtered — probed both filter paths | PASS |
| 12 | `company.com/careers/email-specialist` anchor KEPT (email in path, not subdomain) — probed | PASS |
| 13 | `go.indeed.com` anchor filtered — probed | PASS |
| 14 | All 46 tests pass on actual execution | PASS |

## Status: PASS

_Signed: Zoe — 2026-06-05T00:00:00Z_
