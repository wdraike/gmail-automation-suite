# Test Registry — Gmail Automation Dashboard

**Last updated:** 2026-05-25  
**Scope:** Frontend surfaces (dashboard HTML/JS) and Gmail add-on (CardService)

---

## Legend
- **P0** — Required before release (blocks user flows or security)
- **P1** — Required for confidence (covers primary workflows)
- **P2** — Recommended (edge cases, accessibility, performance)
- **Status:** `Exists` / `Missing` / `Stub`

---

## Dashboard UI Tests

| ID | Test Name | Target | Prio | Status | Notes |
|----|-----------|--------|------|--------|-------|
| DASH-001 | Dashboard renders without JS errors | `DashboardMain.html` | P0 | Missing | Need HtmlService/JSDOM smoke test |
| DASH-002 | View switching (Labels <-> Settings) works | `dashboard-core.html` | P0 | Missing | Verify `showView`/`hideAllViews` |
| DASH-003 | Navigation buttons do not duplicate listeners | `dashboard-core.html` | P0 | Missing | Regression guard for duplicate `loadData()` calls |
| DASH-004 | Labels tree renders with nested hierarchy | `dashboard-labels.html` | P1 | Missing | Requires mock `allLabels` data |
| DASH-005 | Category tiles render with items | `dashboard-categories.html` | P1 | Missing | Requires mock `allItems` / `allCategories` |
| DASH-006 | Drag-and-drop: item moves between categories | `dashboard-core.html` + `dashboard-categories.html` | P0 | Missing | Fire synthetic `dragstart`/`drop` events |
| DASH-007 | Drag-and-drop: category pill moves between labels | `dashboard-labels.html` | P0 | Missing | Synthetic DnD + assert DOM update |
| DASH-008 | Search filters labels correctly | `dashboard-labels.html` | P1 | Missing | Input "Work" and assert visibility |
| DASH-009 | Search filters categories correctly | `dashboard-categories.html` | P1 | Missing | Input query and assert tile visibility |
| DASH-010 | New category modal opens and creates category | `DashboardModals.html` + `dashboard-categories.html` | P1 | Missing | Mock `google.script.run` |
| DASH-011 | Delete confirmation modal prevents accidental deletion | `DashboardModals.html` + `dashboard-categories.html` | P1 | Missing | Assert `isDeleting` flag behavior |
| DASH-012 | Retention modal loads existing rule data | `dashboard-retention.html` | P1 | Missing | Mock `getRetentionRuleByLabel` |
| DASH-013 | Retention modal saves and removes policies | `dashboard-retention.html` | P1 | Missing | Assert `google.script.run` calls |
| DASH-014 | Settings view loads and saves API key | `dashboard-settings.html` | P1 | Missing | Mock server responses |
| DASH-015 | Toast notifications appear and dismiss | `dashboard-utils.html` | P2 | Missing | Assert CSS class toggles |
| DASH-016 | Auto-scroll during drag within column-body | `dashboard-utils.html` | P2 | Missing | Fire `dragover` at edges |
| DASH-017 | Keyboard-only user can move items (no mouse) | `dashboard-categories.html` | P0 | Missing | Move controls not yet implemented |
| DASH-018 | Modal focus is trapped while open | `DashboardModals.html` | P1 | Missing | Tab-cycle test |
| DASH-019 | Screen reader announces toast updates | `dashboard-utils.html` | P1 | Missing | Assert `aria-live` region |
| DASH-020 | Dashboard renders on mobile-width viewport | `DashboardMain.html` | P1 | Missing | Responsive layout validation |

---

## Dashboard API / Controller Tests

| ID | Test Name | Target | Prio | Status | Notes |
|----|-----------|--------|------|--------|-------|
| API-001 | `doGet` returns HtmlOutput with title | `dashboard-api.js` | P1 | Exists | Covered by api.test.js (backend) |
| API-002 | `getDashboardData` returns shaped JSON | `dashboard-api.js` | P1 | Exists | Covered by api.test.js |
| API-003 | `updateEmailCategory` validates input | `dashboard-api.js` | P1 | Exists | Covered by api.test.js |
| API-004 | `saveRetentionRule` rejects missing fields | `dashboard-api.js` | P1 | Exists | Covered by retention.test.js |
| CTRL-001 | `getAllLabelsAndCategories` builds reverse mapping | `dashboardController.js` | P1 | Exists | Covered by backend tests |
| CTRL-002 | `createLabel` prevents duplicates | `dashboardController.js` | P1 | Exists | Covered by backend tests |
| CTRL-003 | `moveGmailLabel` handles nested paths | `dashboardController.js` | P1 | Exists | Covered by backend tests |

---

## Gmail Add-on Tests

| ID | Test Name | Target | Prio | Status | Notes |
|----|-----------|--------|------|--------|-------|
| ADDON-001 | `getContextualAddOn` returns a card | `gmail-addon.js` | P1 | Missing | Mock `CardService` |
| ADDON-002 | `createCategoryCard` includes sender info | `gmail-addon.js` | P1 | Missing | Mock Gmail message metadata |
| ADDON-003 | `showCategorySelector` lists all categories | `gmail-addon.js` | P1 | Missing | Assert dropdown is populated from `getAllCategories()` |
| ADDON-004 | `filterCategories` does not use hardcoded list | `gmail-addon.js` | P0 | Missing | Regression guard for BLOCK finding #15 |
| ADDON-005 | `applyCategory` handles email+domain assignment | `gmail-addon.js` | P1 | Missing | Mock form input and parameters |
| ADDON-006 | Error card renders on exception | `gmail-addon.js` | P1 | Missing | Assert `createErrorCard` structure |
| ADDON-007 | `onHomepage` returns dashboard card | `gmail-addon.js` | P1 | Missing | Simple CardService assertion |

---

## Test Infrastructure Needed

1. **JSDOM / Happy DOM harness** for dashboard client scripts, because they depend on DOM APIs (`document`, `google.script.run`).
2. **Mock `google.script.run`** that resolves/rejects with configurable payloads.
3. **Mock `CardService`** for add-on unit tests.
4. **CSS snapshot tests** for `DashboardStyles.html` to catch duplicate-rule regressions.
5. **Accessibility scanning** (e.g., `axe-core` via JSDOM) for modal and input semantics.

---

## Summary

- **Dashboard UI tests:** 20 tests identified; **0 exist**.
- **Dashboard API tests:** 4 identified; **4 exist** (backend coverage).
- **Gmail add-on tests:** 7 identified; **0 exist**.
- **Total gaps:** 27 frontend tests missing.
