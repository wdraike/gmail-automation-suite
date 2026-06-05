# Zoe Review — 2026-06-05 (leg3 formatting cleanup — adversarial audit of Telly)

## Summary
4 challenges probed empirically. Found + FIXED 1 false pass (no-striping test asserted only a single colour literal). 1 WARN backlog (normalizeLocation trailing/double-comma untested). cleanSalaryValue and the native-banding tests are robust and load-bearing. No remaining false passes.

## Telly Audit

### BLOCK Findings
| # | Finding | Evidence | Status |
|---|---------|----------|--------|
| — | None remaining after fix | — | — |

### Fixed During Audit
| # | Finding | Evidence | Fix |
|---|---------|----------|-----|
| 1 | FALSE PASS: "formatJobRow does NOT stripe" only asserted `'#f8f9fa'` absent. Mutation injecting `setBackground("#abcdef")` striping still PASSED. | sheets-handler.test.js no-striping test | Tightened to assert `bgColors.toHaveLength(0)` — ANY per-row background fails. Re-verified: passes on correct code, FAILS under different-colour striping mutation. |

### WARN Findings
| # | Finding | Evidence | Remediation |
|---|---------|----------|-------------|
| 1 | normalizeLocation trailing-comma ("Austin, " -> "Austin,") and double-comma ("A,,B" -> "A, , B") behavior is unspecified and untested. Not wrong per the conservative spec (separator standardization only, no dangling-comma stripping), and real Gemini output rarely has these. | direct node probe | Backlog: add edge tests or decide whether to strip dangling commas. |

### PASS Verifications
| # | Check | Evidence |
|---|-------|----------|
| 1 | cleanSalaryValue rejects partial-numeric | "120k","$120,000/yr","100000 USD","1.2.3","1e5","-50000" all -> "". Regex `/^\d+(\.\d+)?$/` is strict. |
| 2 | cleanSalaryValue Number tests load-bearing | string-return mutation fails 4 typeof tests |
| 3 | Native banding tests NOT mock artifacts | removing production applyRowBanding call fails both banding tests |
| 4 | Banding idempotency load-bearing | removing the getBandings().remove() dedup fails the idempotency test |
| 5 | normalizeLocation collapses tab/newline whitespace | "New\tYork,\nNY" -> "New York, NY" |
| 6 | Full suite no new failures | 590p / 6f (pre-existing) / 9s |

## Status: PASS

_Signed: Zoe — 2026-06-05T00:00:00Z_
