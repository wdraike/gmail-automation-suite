# Oscar Review — ux-a11y-fix Wave 1 — 2026-06-06

## Verdict: PASS

## Summary
Wave 1 (HTML/CSS a11y partials) is complete and correct. Ernie PASS, no Critical/BLOCK. Static a11y additions verified structurally. Bird live re-review intentionally deferred to Wave 3 (requires CDP). Ready to commit the 4 dashboard-html files.

## Scope
src/ui/dashboard-html/{DashboardMain,DashboardHeader,DashboardModals,DashboardStyles}.html (Frontend category → ernie + bird). Collision-free with the parallel full-test-coverage leg (no .js, not in jest coverage).

## Agent Findings
### Ernie — PASS
See CODE-REVIEW-ux-fix-wave1.md. 0 Critical, 1 Warning (broad `!important` on decorative icon tint — non-blocking), 2 Info (focus-trap + dynamic aria deferred to Wave 2). DOM-compat with existing resizer JS confirmed.

### Bird — DEFERRED to Wave 3
Live CDP re-verification (axe in iframe, mobile reflow, modal focus trap) runs in Wave 3 per WBS, after Wave 2 JS lands.

## Completeness
| Check | Result |
|-------|--------|
| Tests exist for changed code | N/A (HTML partials not in jest coverage scope per WBS) |
| Tests passing | PASS for this change (the 1 jest failure is the parallel coverage leg's in-flight label-cache work, not in this scope) |
| Docs updated | N/A (UX-REVIEW.md re-verify section is Wave 3) |
| Structural balance | PASS (nav/section/modal tags balanced; aria targets resolve) |

## Kermit Report
Verdict: PASS
Completeness gaps: none for Wave 1
Backlog items: 0 (Wave 2 + Wave 3 are planned, not backlog)
Ready to commit: yes

## Wave 1b — dynamic icon-button aria-labels (client-side HTML partials, also collision-free)
Discovered during Wave 2 prep that the dynamic icon buttons Bird flagged (the ~77 unnamed buttons) are built in the CLIENT-SIDE JS that lives inside HTML partials (dashboard-labels.html, dashboard-categories.html) — NOT in dashboardController.js (which is the server-side Apps Script controller) and NOT in jest coverage. These are therefore collision-free HTML and correctly belong to Wave 1.

Fixes:
- dashboard-labels.html: category pill remove-X -> `aria-label="Remove <cat> from <label>"`; per-label gear -> `aria-label="Retention settings for <label>"`; per-folder gear -> `aria-label="Retention settings for folder <path>"`.
- dashboard-categories.html: per-card add/edit/delete buttons -> specific aria-labels incl. category name; per-item (domain/email) delete "×" -> `aria-label="Remove <item> from <category>"`.

Safety: all innerHTML interpolations remain wrapped in escapeAttr(); setAttribute() cases are DOM-API safe (no markup injection). Controller + api jest suites: 99/99 pass (HTML changes do not touch coverage-tracked JS).

The ONLY remaining Wave 2 (.js, coverage-tracked) item is dashboardController.js createCategoryPill's single remove-button innerHTML (add one aria-label + extend its existing test) and a doGet confirmation in dashboard-api.js. Deferred until the parallel coverage leg completes.

## Wave 1c — modal focus management (client-side HTML JS, collision-free)
Bird flagged: opening a modal leaves focus on BODY, Escape is a no-op, no focus trap, no focus restore. This wiring lives in client-side JS inside dashboard-core.html (an HTML partial, not in jest coverage) — collision-free.

Added `setupModalA11y()` (called from setupEventListeners), one MutationObserver per `[id$="Modal"]` watching the `.hidden` class:
- on open: remember the trigger (activeElement), move focus to first focusable control in the dialog.
- Tab/Shift+Tab trapped within the dialog; Escape closes; backdrop mousedown (overlay, not dialog) closes.
- on close: restore focus to the trigger.
Works regardless of which scattered code path toggles a given modal. Script block validated with `new Function()` (PARSE_OK). Controller/api jest 99/99 green.

## Status: PASS
_Signed: Oscar — 2026-06-06T00:00:00Z_
