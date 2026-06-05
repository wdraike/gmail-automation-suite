# Zoe Review — WARN-14 + WARN-15 URL Filter Fixes — 2026-06-05

## Summary
42/42 tests pass. No false passes, no shallow assertions. The regex logic is provably correct
across 17 manually probed edge cases. Two WARN findings: Telly missed tests for the broader
false-positive class this PR also fixes (go.chicago.com, email.acme.com as false-positives in
the OLD anchor filter — now also fixed by the new regex). Not BLOCK because the implementation
is correct; the tests just don't document this wider win. Both deferrable.

## Telly Audit

### BLOCK Findings
_None._

### WARN Findings

| # | Finding | Evidence | File | Remediation |
|---|---------|----------|------|-------------|
| 1 | No test for `go.` and `email.` subdomain false-positives in the anchor filter. The old `ANCHOR_NOISE_DOMAINS` substring filter `'go.'` would have filtered `chicago.com` and `mango.com` anchors; `'email.'` would have filtered `email-solutions.com`. The new hostname-anchored regex fixes these, but there are zero tests exercising those corrections. The WARN-14/15 fix is broader than the four cases Telly tested. | tests-local/job-finder-extractor.test.js (missing) | extractor.js:173 | Add tests: `chicago.com/jobs` anchor kept; `go.jobvite.com` anchor filtered; `email.acme.com` URL filtered; `my-email-tools.com` URL NOT filtered |
| 2 | No test for `go.` subdomain in the URL filter. The old code had `click.` and `track.` but NOT `go.` — so `go.jobvite.com` tracking URLs were never filtered before. The new regex adds `go.` to the URL filter. This is new behavior with no test documenting the before/after. | tests-local/job-finder-extractor.test.js (missing) | extractor.js:88 | Add: `it("filters out go.jobvite.com URLs")` |

### PASS Verifications

| # | Check | Status |
|---|-------|--------|
| 1 | Regression test for `career.com` URL not filtered — asserts exact URL appears in prompt | PASS |
| 2 | Regression test for `director.jobs` URL not filtered — asserts exact URL appears in prompt | PASS |
| 3 | `click.example.com` filtered — asserts URL does NOT appear in prompt | PASS |
| 4 | `r.example.com` redirect filtered (URL filter path) — negative assertion verified | PASS |
| 5 | `career.com` anchor pair kept (WARN-14 anchor path) — asserts URL in prompt | PASS |
| 6 | `r.example.com` anchor filtered, `jobs.acme.com` kept — both directions verified | PASS |
| 7 | `track.foobar.com` still filtered after regex change — existing test covers this | PASS |
| 8 | Malformed anchor URL (no scheme) is silently kept — verified manually via node probe | PASS |
| 9 | `recruiter-email.acme.com` NOT filtered (email. anchored to start) — verified via probe | PASS |
| 10 | `gojobs.com` NOT filtered (go. not at hostname start) — verified via probe | PASS |
| 11 | No `toBeDefined()`-only assertions — all new tests assert content in/out of prompt string | PASS |
| 12 | No mock leakage — each new test uses fresh `jest.fn()` with `beforeEach clearAllMocks` | PASS |
| 13 | All 42 tests pass on actual execution | PASS |

## Status: PASS

_Signed: Zoe — 2026-06-05T00:00:00Z_
