# WBS — Repo Cleanup

**Leg:** repo-cleanup. Driven by Kermit → Oscar. Keep 100% coverage gate + boundary test green; deploy + push at end.

## Locked decisions
- D1: DELETE all root `*REVIEW*.md` (ARCH/CODE/DOCS/OSCAR/SECURITY/TEST/UX/ZOE + all -FIXED/-FIXED-2/-FIXED-3/-FINAL/-ux-fix-wave1 variants). Add `*REVIEW*.md` (root) to .gitignore so future Oscar runs stay untracked. EXCEPTION: preserve the lasting a11y record — `git mv UX-REVIEW.md docs/UX-REVIEW.md` (keep that one, relocated). KEEP ARCHITECTURE.md, .planning/adr/ADR-001-hexagonal.md, README.md.
- D2: tests-ux/artifacts — `git rm -r --cached tests-ux/artifacts` and add `tests-ux/artifacts/` to .gitignore (regenerable by bird-drive.js). KEEP harness scripts (capture-auth.js, launch-chrome-cdp.sh, bird-drive.js).
- D3: REMOVE src/dev/*.js scaffolds (simple-drive-test, test-drive-logging, test-gemini-api). Update .clasp.json filePushOrder (gitignored, on-disk) + .claspignore if they reference dev files. Confirm no app/test imports them first.
- D4: Archive stale docs → `docs/archive/`: PHASE-1-COMPLETION, PHASE-2-COMPLETE, PHASE-2-PROGRESS, REORGANIZATION-SUMMARY, TEST-COVERAGE-PLAN, IMPROVEMENT-RECOMMENDATIONS, TESTING-SUMMARY (+ any other point-in-time/superseded). KEEP: DEPLOYMENT, GAS-COMPATIBILITY, GEMINI-DEBUG-LOGGING, INDEX, README, guides/QUICK-START, FILE-STRUCTURE. Update docs/INDEX.md links.
- D5: REMOVE documented dead code + istanbul-ignores, keep 100% gate via test updates:
  - gmail-addon.js writeLog `estimatedSize>100000` branch (5000-cap runs first → dead).
  - cache-service.js LabelCategoriesCache `LABEL_CATEGORIES` vs `LABEL_CATEGORIES_MAP` collision dead branch.
  Verify each is truly unreachable before deleting; remove the branch + its `/* istanbul ignore */`; adjust tests so coverage stays 100/100/100/100.
- Also: root TEST-REGISTRY.md / TEST-RUN-LOG.md / TRACEABILITY-MATRIX.md — if stale/superseded by the 100% suite, archive to docs/archive/ (judgment: keep TRACEABILITY-MATRIX if it maps reqs→tests and is current; archive the run-log).

## Constraints
- TDD for any code change (dead-code removal): keep `npx jest --coverage --runInBand` → All files 100/100/100/100, 0 failed; architecture-boundary green.
- Use `git mv`/`git rm` (not raw rm) so history is clean. Explicit paths only, never `git add -A`.
- NEVER leave a planted mutation. `git diff --stat src/` clean of unintended changes before commit.
- Atomic commits per category (review-artifacts, tests-ux, dev-scaffolds, docs-archive, dead-code).
- Oscar gate before commits that touch src/**. clasp push + git push origin master at end; verify in sync.

## DoD
- Root has no `*REVIEW*.md` (except none); UX-REVIEW under docs/. tests-ux/artifacts gitignored + untracked. src/dev gone + clasp configs updated. Stale docs under docs/archive/ with INDEX updated. Dead code removed, gate still 100%. Suite green. Deployed + pushed. Working tree clean.
