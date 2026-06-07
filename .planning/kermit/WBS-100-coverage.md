# WBS — 100% Test Coverage + All-Green

**Leg:** full-test-coverage
**Goal:** Every testable source file reaches 100% coverage (statements/functions/lines; branches 100% where reachable). Full jest suite GREEN. A 100% coverage threshold is enforced in jest config so regressions fail CI. Kermit-orchestrator agent dispatches test-writing agents (via Oscar → Telly/Zoe) and LOOPS until the 100% gate passes.

## Baseline (measured)
- 590 passed / 0 failed / 9 skipped. Coverage: 56.6% stmt / 53.5% branch / 66% func / 56.5% lines.

## Locked decisions
- **D1 (what "can be tested" = coverage scope):** EXCLUDE from coverage —
  - `src/dev/**` (manual GAS scaffolds that call live DriveApp/Gemini — not unit-testable),
  - `src/core/local-secrets.js` (gitignored API-key stub),
  - `*.integration.test.js` real-Gemini suite (needs live key/quota; stays `describe.skip`).
  Everything else in `src/**` is in scope and must hit 100%.
- **D2 (honest 100%):** target 100% statements/functions/lines. For branches that are genuinely unreachable in Node tests (GAS-only `typeof X !== 'undefined'` global guards, defensive `throw` on impossible states), wrap with `/* istanbul ignore next -- <reason> */` and a one-line justification. No blanket ignores; each must be justified. Aim true 100% branch where reachable.
- **D3 (skipped tests):** the 8 real-Gemini integration tests stay skipped+excluded (D1). The 1 `it.skip` rate-limit-wait test in api-service.test.js MUST be un-skipped and made to pass with proper mocking (it CAN be tested).
- **D4 (gate):** raise jest `coverageThreshold.global` to 100 for branches/functions/lines/statements after scope exclusions are set. Add `coveragePathIgnorePatterns` / update `collectCoverageFrom` for D1. Add npm script `test:coverage`.

## Waves

### Wave 0 — Coverage gate + scope (TDD-config)
- Update jest.config.js: collectCoverageFrom excludes `src/dev/**`, `src/core/local-secrets.js`; add `coveragePathIgnorePatterns`. Set `coverageThreshold.global` to 100 (all four metrics). Add `test:coverage` script to package.json.
- Un-skip the api-service rate-limit `it.skip` (D3) and make it pass.
- Commit. (Suite will now FAIL the 100 threshold — that failing gate IS the RED for the whole leg.)

### Per-file waves — lowest coverage first (each: write tests → 100% for that file → Oscar/Telly review → commit)
Order by current stmt%:
1. `features/email-sorter/sorter.js` (21%)
2. `core/services/spreadsheet-adapter.js` (29%)  ← port, must be high
3. `ui/dashboardController.js` (37%)
4. `ui/gmail-addon.js` (39%)
5. `utils/label-cache.js` (40%)
6. `core/cache-service.js` (42%)
7. `features/email-retention-manager.js` (58%)
8. `core/services/drive-adapter.js` (58%)  ← port
9. `core/api-service.js` (59%)
10. `features/enhanced-label-manager.js` (60%)
11. `features/email-sorter/categorizer-cache.js` (68%)
12. `core/config.js` (69%)
13. `ui/dashboard-api.js` (71%)
14. `features/job-finder/extractor.js` (74%)
15. `features/job-finder/main.js` (77%)
16. `core/services/gmail-adapter.js` (81%) + branch backfill on the 100%-stmt adapters (gemini/http/cache/properties/utilities/index — push branch to 100%)
17. `features/job-finder/sheets-handler.js` (95%) — finish off

### Final wave — Gate green + review
- `npx jest --coverage` passes the 100 threshold (after D1 exclusions). Full suite GREEN.
- Oscar full pass; Zoe audits the NEW tests for vacuous/false-pass assertions (mutation spot-checks) — coverage must be REAL, not assertion-free line-execution.
- Update tests-local/README.md with the coverage policy + how to run `test:coverage`.
- clasp push (no src behavior change expected — test-only, but config changed). git push origin master.

## Constraints
- TDD: tests are the product here. Each test must ASSERT behavior, not just execute lines (Zoe gate). No `expect(true).toBe(true)` filler.
- Respect hexagonal boundary (architecture-boundary.test.js stays green). Test files may touch SDK mocks via setup.js; no production-code SDK leaks.
- No production behavior changes unless a test reveals a real bug (then fix + note). Atomic commits per file/group.
- NO unapproved fallbacks. If a file has dead/unreachable product code that blocks 100%, surface it (delete dead code or istanbul-ignore w/ justification) rather than faking a test.

## DoD
- jest coverageThreshold.global = 100 and the suite PASSES it (scope per D1).
- 0 failed tests; the only skips are the D1 integration suite.
- Zoe-reviewed: new tests assert real behavior.
- Docs updated; deployed; pushed.
