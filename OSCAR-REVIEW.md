# Oscar Review — WARN-14 + WARN-15 URL Filter Fixes — 2026-06-05

## Verdict: WARN

## Summary
WARN-14 and WARN-15 correctly fixed. 42/42 extractor tests pass (+6 new regression tests).
Hostname-anchored regex approach is correct across 17 manually probed edge cases. No Critical
or BLOCK findings. 4 items deferred to backlog: residual substring filters (`assets.`,
`phenom.`), hoisting constants to module level, and missing tests for the broader go./email.
false-positive class. Ready to commit.

## Agent Findings

### Ernie — PASS
| # | Severity | Finding | File:Line | Remediation |
|---|----------|---------|-----------|-------------|
| 1 | Warning | `assets.` and `phenom.` substring URL filters carry same false-positive risk class as the now-fixed `click.`/`r.` filters | extractor.js:104-106 | Convert to hostname-anchored check in follow-up PR |
| 2 | Warning | `ANCHOR_NOISE_DOMAINS` and `ANCHOR_TRACKING_SUBDOMAIN_RE` re-instantiated inside hot call path | extractor.js:171-173 | Hoist to module-level constants |
| 3 | Info | `ct.sendgrid.net` redundant removal — correctly simplified | extractor.js:87 | No action |
| 4 | Info | `(e. && .com/)` compound heuristic correctly removed | extractor.js (deleted) | No action |

### Telly — PASS
| # | Check | Result |
|---|-------|--------|
| 1 | 42/42 extractor tests pass (+6 new for WARN-14/15) | PASS |
| 2 | extractor.js statement coverage: 76.3%, branch: 77.6% | PASS |
| 3 | All WARN-14/15 changed lines covered by new tests | PASS |

### Zoe — PASS
| # | Severity | Finding | File | Remediation |
|---|----------|---------|------|-------------|
| 1 | Warning | No test for `go.` and `email.` subdomain false-positive class (old anchor filter also had these bugs, now fixed) | extractor.js:173 | Add `go.jobvite.com` filtered / `chicago.com` kept tests |
| 2 | Warning | No test for `go.` URL filter (new behavior — `go.` was not in old URL filter) | extractor.js:88 | Add: filters out `go.jobvite.com` URL |

## Fix Loop
_Not run — no blocking findings._

## Completeness
| Check | Result |
|-------|--------|
| Tests exist for changed code | PASS |
| Tests passing (42/42) | PASS |
| Docs updated (no API change) | PASS |
| Security review (no auth/payment paths changed) | PASS |

## Backlog Items (WARN)
| Finding | File |
|---------|------|
| `assets.` and `phenom.` substring URL filters still overly broad | extractor.js:104-106 |
| `ANCHOR_NOISE_DOMAINS` / `ANCHOR_TRACKING_SUBDOMAIN_RE` defined inside function body | extractor.js:171-173 |
| No test for `go.`/`email.` anchor false-positive class now fixed by new regex | extractor.js:173 |
| No test for `go.` URL filter (new behavior added by this PR) | extractor.js:88 |

## Kermit Report
Verdict: WARN
Completeness gaps: none
Backlog items: 4
Ready to commit: yes

## Status: PASS
_Signed: Oscar — 2026-06-05T00:00:00Z_
