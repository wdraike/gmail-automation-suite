# Oscar Review — 2026-06-05 (leg3-formatting-cleanup, job-finder Phase 3)

## Verdict: WARN

## Summary
Work complete and ready to commit. Phase 3 formatting normalization (salary→Number, native row banding replacing per-row striping, conservative location normalization) plus carried-forward Leg 1 alignment cleanup (Careers URL columns removed from the CSV path). All reviewers PASS; Zoe found and fixed 1 false-pass test inline. 2 items deferred to backlog. Full suite 590 passed / 6 pre-existing failures / 9 skipped — zero new failures.

## Agent Findings

### Ernie (code quality) — PASS
- No Critical. 1 WARN: `addJobToSpreadsheet` rowData `job["Minimum Salary"] || ""` would coerce a `0` Number to "" now that salary is numeric (latent; salaries >0, so not a live bug) — flagged, NOT fixed (changing the coercion is an unapproved logic change out of scope). 2 Info: CSV still omits Employment/Work/Experience cols (separate pre-existing divergence, documented inline); getMaxRows()-wide banding range is correct for GAS.

### Telly (tests) — PASS
- 13 net-new tests across 3 suites; 121/121 green in touched suites. Full suite 590p/6f(pre-existing)/9s, zero new failures. Mutation-verified salary-Number tests and banding-idempotency test are load-bearing.

### Zoe (adversarial) — PASS
- Probed 4 challenges. Found + FIXED 1 FALSE PASS: the no-striping test asserted only `'#f8f9fa'` absent and would pass if striping switched to any other colour; tightened to `bgColors.toHaveLength(0)` and re-verified it now fails under a different-colour striping mutation. Confirmed native-banding tests exercise real production calls (not mock artifacts) and cleanSalaryValue correctly rejects partial-numeric ("120k", "$120,000/yr", etc.). 1 WARN: normalizeLocation trailing/double-comma behavior untested.

## Fix Loop
- No bert iterations required (no BLOCK). Zoe's false-pass fixed inline during audit.

## Completeness
| Check | Result |
|-------|--------|
| Tests exist for changed code | PASS |
| Tests passing (no new failures) | PASS |
| Docs updated (if API changed) | N/A (GAS internal; JSDoc present on new helpers) |
| Security review run (if auth/payment) | N/A (no security-sensitive files) |
| No dead staged files | PASS |
| No unapproved fallbacks | PASS |

## Backlog Items (WARN)
| Finding | File |
|---------|------|
| `addJobToSpreadsheet` rowData `job["Minimum Salary"]/["Maximum Salary"] \|\| ""` coerces a numeric 0 to "" — consider explicit `=== "" ? "" : value` guard now salary is a Number | sheets-handler.js:54-57 |
| normalizeLocation trailing-comma / double-comma behavior unspecified + untested — add edge tests or decide on dangling-comma stripping | extractor.js normalizeLocation |

## Kermit Report
Verdict: WARN
Completeness gaps: none
Backlog items: 2
Ready to commit: yes

## Status: PASS
_Signed: Oscar — 2026-06-05T00:00:00Z_
