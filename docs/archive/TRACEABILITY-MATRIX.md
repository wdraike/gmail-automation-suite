# Traceability Matrix — Gmail Automation Dashboard

**Last updated:** 2026-05-25  
**Purpose:** Map functional requirements / UI surfaces to tests and review artifacts.

---

## Dashboard (HtmlService Web App)

| Requirement / Surface | Source File(s) | Tests | Review Artifact | Coverage |
|-----------------------|----------------|-------|-----------------|----------|
| Dashboard shell renders with correct includes | `DashboardMain.html` | DASH-001 | UX-REVIEW #2, #9, #10 | Gap |
| Tailwind + custom styles load without conflict | `DashboardStyles.html` | DASH-001 | UX-REVIEW #3 | Gap |
| Header navigation buttons switch views reliably | `DashboardHeader.html`, `dashboard-core.html` | DASH-002, DASH-003 | UX-REVIEW #5, #6, #7 | Gap |
| Labels tree displays nested Gmail label hierarchy | `dashboard-labels.html` | DASH-004 | UX-REVIEW #1 | Gap |
| Category pills can be dragged between label drop zones | `dashboard-labels.html` | DASH-007 | UX-REVIEW #1, #8 | Gap |
| Label search filters tree in real time | `dashboard-labels.html` | DASH-008 | UX-REVIEW #14 | Gap |
| Category tiles render with assigned emails/domains | `dashboard-categories.html` | DASH-005 | UX-REVIEW #4, #8 | Gap |
| Items can be dragged between category tiles | `dashboard-core.html`, `dashboard-categories.html` | DASH-006 | UX-REVIEW #4, #8 | Gap |
| Category search filters tiles and items | `dashboard-categories.html` | DASH-009 | UX-REVIEW #14 | Gap |
| New category modal validates and creates category | `DashboardModals.html`, `dashboard-categories.html` | DASH-010 | UX-REVIEW #13 | Gap |
| Delete confirmation modal prevents accidental deletion | `DashboardModals.html`, `dashboard-categories.html` | DASH-011 | UX-REVIEW #13, #18 | Gap |
| Retention policy modal CRUD operations | `dashboard-retention.html`, `DashboardModals.html` | DASH-012, DASH-013 | UX-REVIEW #22 | Gap |
| Settings view loads/saves API key and preferences | `dashboard-settings.html` | DASH-014 | UX-REVIEW #23 | Gap |
| Toast notifications appear and dismiss | `dashboard-utils.html` | DASH-015 | UX-REVIEW #12 | Gap |
| Auto-scroll during drag operations | `dashboard-utils.html` | DASH-016 | UX-REVIEW (interaction notes) | Gap |
| Keyboard-only users can categorize without mouse | All DnD surfaces | DASH-017 | UX-REVIEW #8 | Gap |
| Modal focus trapping and A semantics | `DashboardModals.html` | DASH-018, DASH-019 | UX-REVIEW #13 | Gap |
| Responsive layout on narrow viewports | `DashboardMain.html`, `DashboardStyles.html` | DASH-020 | UX-REVIEW #9 | Gap |
| Server API returns consistent JSON payloads | `dashboard-api.js` | API-001..004 | UX-REVIEW #17 | Covered |
| Controller builds label/category mappings | `dashboardController.js` | CTRL-001..003 | — | Covered |

---

## Gmail Add-on (CardService)

| Requirement / Surface | Source File(s) | Tests | Review Artifact | Coverage |
|-----------------------|----------------|-------|-----------------|----------|
| Contextual add-on returns category or dashboard card | `gmail-addon.js` | ADDON-001 | — | Gap |
| Category card displays sender, domain, current categories | `gmail-addon.js` | ADDON-002 | — | Gap |
| Category selector lists actual categories (not hardcoded) | `gmail-addon.js` | ADDON-003, ADDON-004 | UX-REVIEW #15, #16 | Gap |
| Apply category updates email and/or domain correctly | `gmail-addon.js` | ADDON-005 | — | Gap |
| Errors render an actionable error card | `gmail-addon.js` | ADDON-006 | — | Gap |
| Homepage shows dashboard access button | `gmail-addon.js` | ADDON-007 | — | Gap |

---

## Legend

- **Covered** — Automated tests exist and are referenced.
- **Gap** — No automated tests exist for this requirement; manual testing or static review is the only verification.
- **Partial** — Some tests exist but do not fully cover the surface.

---

## Action Items

1. Write DASH-001 through DASH-020 in a JSDOM/Happy DOM harness.
2. Write ADDON-001 through ADDON-007 using a mock `CardService` factory.
3. Run the full matrix against CI once tests exist and update statuses to `Covered`.
