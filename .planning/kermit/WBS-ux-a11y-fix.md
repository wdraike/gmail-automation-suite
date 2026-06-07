# WBS — Dashboard UX / A11y Fix

**Leg:** ux-a11y-fix
**Source:** UX-REVIEW.md (Bird, 2026-06-06). Verdict ISSUES — 4 critical / 5 high / 5 med / 4 low.
**Goal:** Fix the critical + high WCAG/UX blockers on the Gmail Automation Dashboard, keep the 100% coverage gate green, Bird re-verifies over CDP. Driven by Kermit → Oscar (Bert fixes, Telly tests, Bird re-review).

## CONCURRENCY GUARD (mandatory)
A `full-test-coverage` leg is running in parallel and OWNS `.planning/kermit/session.json` + all `src/**/*.js` + `tests-local/**`. To avoid git races and breaking the 100% gate:
- This leg uses its OWN state file `.planning/kermit/session-ux-fix.json`. Do NOT write session.json until the coverage leg is complete.
- Wave 1 (HTML/CSS partials, NOT in coverage scope) may start immediately — zero collision.
- Wave 2 (any `src/ui/*.js`) MUST wait until the coverage leg is done. Detect completion by polling: `.planning/HANDOFF.json` `last_leg === "full-test-coverage"`, OR `git log` shows the coverage leg's closing commit and `git status` clean of its files. Re-pull/rebase awareness: never edit a `.js` the coverage agent still has open.
- Any `.js` edited in Wave 2 MUST keep 100% coverage (add/adjust tests) or the gate fails.

## Fix scope (from UX-REVIEW.md)

### Wave 1 — HTML/CSS partials (collision-free, start now)
Files: src/ui/dashboard-html/* (DashboardMain.html, DashboardStyles.html, DashboardModals.html, CategoriesColumn.html, LabelTreeColumn.html, DashboardHeader.html, dashboard-*.html). NONE are in jest coverage.
- **Critical:** add `lang="en"` to `<html>` in DashboardMain.html; ensure a real `<title>` + a visible `<h1>` (page-has-heading-one).
- **Critical:** mobile reflow — add `@media (max-width:640px)` in DashboardStyles.html so the 3-column layout stacks to single column; stop card/chip clipping + horizontal scroll.
- **Critical:** modal → real dialog in DashboardModals.html: `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; (focus-trap/Escape/restore wiring may need the JS — if so defer that part to Wave 2).
- **High:** visible focus ring — replace any `outline:none` with a `:focus-visible` ring token in DashboardStyles.html.
- **High:** color-contrast — fix the 20 failing tokens (bump to WCAG AA 4.5:1) in DashboardStyles.html / :root vars.
- **High:** tap targets — icon buttons to min 44×44px (CSS).
- **High/Med:** static aria-labels on any icon buttons defined directly in the HTML partials (header gear/help/add/refresh/search-clear).

### Wave 2 — JS (serialized AFTER coverage leg; keep 100%)
Files: src/ui/dashboardController.js (dynamic category/label/X buttons), src/ui/dashboard-api.js (doGet — confirm setTitle + add lang/meta if served there).
- **Critical:** add specific `aria-label` to EVERY dynamically-created icon button (delete X, edit, expand/collapse, drag handle) at creation in dashboardController.js.
- **Critical:** modal focus management — move focus into dialog on open, trap Tab, close on Escape, restore focus to trigger on close.
- **High:** keyboard path for assignment (drag-drop is currently the only way) — add a keyboard-accessible alternative (e.g. move via menu/buttons).
- **High:** label all inputs (23) — `<label>`/`aria-label` for search + form fields.
- For each `.js` change: add Telly tests so coverage stays 100%.

### Wave 3 — Re-verify + ship
- Bird re-runs over CDP (bash tests-ux/launch-chrome-cdp.sh already authed; node tests-ux/bird-drive.js) → confirm axe critical/high cleared, mobile reflows, modal is a dialog. Update UX-REVIEW.md with re-verify results.
- Oscar full gate (Bird + ernie + telly). Full jest suite green + 100% gate intact.
- clasp push. git push origin master.

## Constraints
- TDD for any JS logic; keep architecture-boundary + 100% coverage green.
- No unapproved fallbacks. Behavior-preserving except the intended a11y/markup additions.
- Do NOT mutate the user's live Gmail data during Bird re-verify (no destructive clicks).
- Atomic commits per wave/group.

## DoD
- axe in-app: 0 critical, 0 serious (or documented-unavoidable). Mobile reflows at ≤640px. Modal is a focus-trapped dialog. lang+title+h1 present. Inputs labeled. Focus ring visible. 44px targets.
- 100% coverage gate still green; suite green. Bird re-verify PASS. Deployed + pushed.
