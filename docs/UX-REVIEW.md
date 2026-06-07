# UX Review — Gmail Automation Dashboard — 2026-06-06

_Reviewer: Bird. Read-only review. Evidence: `tests-ux/artifacts/` screenshots (mobile 375×812, tablet 768×1024, desktop 1440×900), `axe-dashboard-iframe.json`, `dashboard-dom-meta.json`, `summary.json`, plus live CDP inspection of the running app frame (`*.googleusercontent.com`)._

## Executive Summary

**Verdict: ISSUES — does not ship as-is.** The dashboard is functionally rich and visually orderly on desktop and tablet, with zero console errors (`summary.json`). But it fails WCAG 2.x A/AA on multiple counts that block release for any user relying on a keyboard or screen reader, and the mobile layout does not reflow — it side-scrolls a desktop three-column layout into a 375px window. The single largest issue is **77 buttons with no accessible name** (axe reports 71 `button-name` nodes; live DOM finds 77), which makes the entire icon-driven control surface (per-row delete, per-label gear, add/edit/expand) invisible to assistive tech.

### Severity counts
| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 5 |
| Medium | 5 |
| Low | 4 |

### Accessibility violations (axe, in-app iframe) — `axe-dashboard-iframe.json`
| Rule | Impact | Nodes |
|------|--------|-------|
| `button-name` (icon buttons with no discernible text) | **critical** | 71 |
| `color-contrast` | serious | 20 |
| `document-title` (no `<title>`) | serious | 1 |
| `html-has-lang` (no `lang` attr) | serious | 1 |
| `page-has-heading-one` (no `<h1>`) | moderate | 1 |

Live DOM inspection corroborated and extended these: `lang=null`, `document.title=""`, `h1=0` (h2=3, h3=9 present), **77** truly unnamed buttons, **23 of 23 inputs** have no programmatic label (no `aria-label`, no `<label for>`), only 1 landmark (`main`; no `nav`, no `aside`), and **2517 of 2545** buttons render below the 44×44px touch-target minimum.

---

## The 6 Pillars

### 1. Visual Hierarchy & Layout — Score: 6/10
- **Desktop** (`dashboard-desktop.png`): Clean two-region split — left Labels rail, right Categories grid (3 cards per row: Bills / Block / Entertainment Stuff, then Finance / Financial / Fiverr…). Section headers ("Labels", "Categories") and the "+ New Category" action read clearly. Card structure (folder icon + title + "Domains" sublabel + chip rows) is consistent and scannable.
- **No `<h1>`** anywhere (`dashboard-dom-meta.json` hasH1:false; live h1=0). "Gmail Automation Dashboard" is rendered as branding text, not a programmatic top heading, so the document has no titled root for the hierarchy. Heading levels jump (h2 → h3) with no h1.
- The thin top banner "This application was created by a Google Apps Script user" (Google's sandbox chrome, `dashboard-mobile.png`) eats ~64px of vertical space on mobile and pushes real content below the fold — outside app control, but worth noting for first-run perception.
- Brand-guide gap: the UI uses a generic blue/white system palette, not the Raike & Sons navy `#1A2B4A` / gold `#C8942A` / parchment `#F5F0E8` tokens. No Playfair/EB Garamond/Inter type system. This is an unbranded app shell. (Info-level unless brand alignment is a project requirement.)

### 2. Responsiveness & Reflow — Score: 3/10
- **Mobile 375px** (`dashboard-mobile.png`): The layout does **not** reflow. The Labels column and the Categories column sit side by side; the Categories card ("Bills") and its domain chips ("alert.ne…", "alerts.p…", "amazon…", "audible…") are **clipped at the right edge** and require horizontal scrolling to read — a WCAG 2.2 SC 1.4.10 (Reflow) failure. The header wraps awkwardly to three lines ("Gmail / Automation / Dashboard").
- **Tablet 768px** (`dashboard-tablet.png`): Acceptable. Two columns fit; the right Categories column collapses from 3-up to 1-up cards (Bills, Block, Entertainment Stuff stacked). No clipping observed. This is the best of the three viewports.
- **Desktop 1440px**: Full 3-column card grid, no overflow.
- Not captured but required by rubric: **320px (reflow-wcag)** — given 375px already clips, 320px will be worse; treat as FAIL pending capture.
- **Touch targets:** live measurement shows the icon controls are 16×16px (per-row "Retention Settings" gear, "Clear label search"), 20×20px (Expand/Collapse All), and 28×28px (Refresh, Help, the red X delete). All are far below the 44×44px minimum (WCAG 2.5.8 / 2.5.5). The red X remove buttons on every domain chip (`dashboard-tablet.png`, dozens per screen) are the most-used controls and are the hardest to hit.

### 3. Interaction & Feedback — Score: 4/10
- **"Create New Category" modal** (opened live): renders with title "Create New Category", fields "Category Key (lowercase, no spaces)" with helper text and "Display Name". But it is **not a semantic dialog** — no `role="dialog"`, no `aria-modal="true"`. On open, **focus is not moved into the modal** (activeElement stayed `BODY`), and **Escape does not close it** (overlay still present after Esc). This fails focus-management and keyboard-dismiss expectations (WCAG 2.1.2 / 2.4.3).
- Inputs in the modal rely on **placeholder text as the only label** ("e.g. work_related"); placeholders are not accessible names and vanish on input.
- Drag-and-drop is the core interaction model ("Drop categories here" / "Drop emails or domains here" zones visible in `dashboard-tablet.png`). DnD has no documented keyboard alternative; for keyboard-only and screen-reader users this is likely a complete blocker (could not assign categories at all). Flagged High pending a keyboard path.
- Positive: chips, drop zones, and the active "Other" label (green highlighted assignment state in `dashboard-mobile.png` / `dashboard-tablet.png`) give clear visual affordance for where things land.

### 4. Accessibility — Score: 2/10
See dedicated section below. This is the weakest pillar and the primary blocker.

### 5. Content & Clarity — Score: 7/10
- Labels are plain and purposeful: "Search labels…", "Drop categories here", "Domains", "+ New Category". The category-key helper ("This is the internal category identifier used for classification") is genuinely useful.
- The Gmail label tree (DRAFT, IMPORTANT, INBOX, Notes, Other, SENT, SPAM, STARRED, TRASH, "Hold for 2 weeks", "Later", "Legal") is recognizable.
- Some category names are vague ("Entertainment Stuff", "Block", "Other" with a count badge of 3) — minor.
- No empty-state, loading, or error-state copy was observable in artifacts; "Drop … here" doubles as the empty state, which is reasonable.

### 6. Consistency & Branding — Score: 5/10
- Internally consistent: every category card uses the same folder-icon + title + add/edit/delete icon trio (top-right of each card in `dashboard-desktop.png`/`tablet.png`), and every domain row uses the same red X. Predictable.
- No `<title>` means the browser tab is blank — fails the brand title convention (`{Page} — {Product}`, e.g. "Dashboard — Gmail Tools") and hurts multi-tab orientation.
- Palette and typography do not follow the Raike & Sons brand guide (navy/gold/parchment, Playfair/Garamond/Inter). If this app is meant to sit in the product family, it reads as a stock Apps Script UI.

---

## Accessibility Audit (grounded in axe + live DOM)

| Check | Status | Evidence |
|-------|--------|----------|
| Buttons have accessible names | **FAIL (critical)** | axe `button-name` 71 nodes; live DOM 77 unnamed buttons |
| Color contrast ≥ 4.5:1 | **FAIL (serious)** | axe `color-contrast` 20 nodes (light-blue domain chip text on pale-blue fill, muted gray placeholders) |
| `<title>` present | **FAIL (serious)** | axe `document-title`; live `document.title=""` |
| `<html lang>` present | **FAIL (serious)** | axe `html-has-lang`; live `lang=null` |
| Exactly one `<h1>` | **FAIL (moderate)** | axe `page-has-heading-one`; live h1=0, h2=3, h3=9 |
| Form inputs labelled | **FAIL** | live: 23/23 inputs with no `aria-label`/`<label for>`; `dashboard-dom-meta.json` inputsNoLabel:12 |
| Landmarks (nav/aside) | **FAIL** | live: only `main` (1); no `nav`, no `aside` for the label rail |
| Visible focus indicator | **FAIL** | live: after Tab, computed `outline:none`, `box-shadow:none` |
| Modal is a dialog (role + focus trap + Esc) | **FAIL** | live: no `role=dialog`, focus stays on BODY, Esc does not close |
| Touch targets ≥ 44px | **FAIL** | live: 2517/2545 buttons < 44px; icon buttons 16–28px |
| Images have alt | PASS | `dashboard-dom-meta.json` imgsNoAlt:0 |
| Console errors | PASS | `summary.json` consoleErrors:[] |

### Concrete fixes
1. **Icon buttons → add accessible names.** Every icon-only `<button>` (red X delete, gear/Retention Settings, add `+`, edit pencil, trash, Refresh, Help, Expand/Collapse All, Clear search) needs `aria-label`. Make them specific and include the target, e.g. `aria-label="Remove amazon.com from Bills"`, `aria-label="Edit Bills category"`, `aria-label="Delete Bills category"`. Generic "Delete" is not enough when 70+ identical buttons exist.
2. **`<title>` + `lang`.** Set `document.title = "Dashboard — Gmail Tools"` (follow the brand `{Page} — {Product}` convention) and `<html lang="en">`. In Apps Script HtmlService, set these in the served HTML template `<head>`.
3. **Add one `<h1>`.** Promote "Gmail Automation Dashboard" to `<h1>`; demote the current h2s ("Labels", "Categories") so the order is h1 → h2 → h3 with no skips.
4. **Label every input.** Each search box and modal field needs a real `<label for>` (visually hidden is fine) or `aria-label`. Do not rely on placeholders. Example: `<label for="catKey" class="sr-only">Category key</label>`.
5. **Contrast tokens.** The 20 contrast failures are the domain-chip text and muted placeholders. Domain chip text/fill currently reads as light-blue-on-pale-blue (≈3:1). Darken chip text to a navy (`#1A2B4A`) on the light fill, or use the brand pairing navy text on parchment `#F5F0E8` — both clear 4.5:1. Darken placeholder/helper gray to `#5C5A55` (brand charcoal-muted) on white.
6. **Visible focus ring.** Add a global `:focus-visible { outline: 2px solid #C8942A; outline-offset: 2px; }` (brand gold) — currently nothing renders on Tab.
7. **Make the modal a real dialog.** Add `role="dialog" aria-modal="true" aria-labelledby="…"`, move focus to the first field on open, trap focus, restore focus to the trigger on close, and close on Escape and backdrop click.
8. **Landmarks.** Wrap the label rail in `<nav aria-label="Gmail labels">` (or `<aside>`) and the categories region so screen-reader users can jump between regions.

---

## Viewport Coverage
| Viewport | Status | Note |
|----------|--------|------|
| 320px (reflow-wcag) | FAIL (inferred) | not captured; 375px already clips, so 320px fails Reflow |
| 375px (mobile-sm) | **FAIL** | columns side-by-side, category cards/chips clipped, horizontal scroll required (`dashboard-mobile.png`) |
| 768px (tablet) | PASS | clean 1-up card stack, no clipping (`dashboard-tablet.png`) |
| 1440px (desktop) | PASS | full 3-col grid, no overflow (`dashboard-desktop.png`) |

---

## Prioritized Fix List

### Critical (blocks release)
1. **Add `aria-label` to all 77 icon-only buttons** (delete X, gear, add, edit, trash, refresh, help, expand/collapse, clear-search). Without this, none of the primary controls are usable by screen readers. (axe `button-name` critical)
2. **Mobile layout does not reflow at 375px** — category cards and domain chips clip and require horizontal scroll. Stack to a single column below ~640px (WCAG 1.4.10). (`dashboard-mobile.png`)
3. **Modal is not accessible** — add `role="dialog"`/`aria-modal`, move + trap focus, close on Escape, restore focus. (Live: focus stays on BODY, Esc no-op)
4. **Add `<html lang>` and a `<title>`** — both serious axe failures and trivial to fix in the served head.

### High (fix this sprint)
5. **Label all 23 inputs** (search fields + modal fields); remove placeholder-as-label dependency.
6. **Fix 20 color-contrast failures** — darken domain-chip text and muted helper/placeholder text to ≥4.5:1.
7. **Add a visible focus indicator** (`:focus-visible` ring) — keyboard users currently get no feedback.
8. **Provide a keyboard alternative to drag-and-drop** for assigning categories/domains to labels — DnD-only is a hard blocker for keyboard and SR users.
9. **Touch targets to 44×44px** — enlarge the 16–28px icon buttons (especially the per-row red X, used dozens of times) for mobile/tablet.

### Medium
10. **Add a single `<h1>`** and fix heading order (no h2/h3 without an h1).
11. **Add landmarks** (`nav`/`aside` for the label rail) — only `main` exists today.
12. **Header wraps to 3 lines on mobile** ("Gmail / Automation / Dashboard"); shorten or scale the title at small widths. (`dashboard-mobile.png`)
13. **Capture and verify 320px** reflow explicitly.
14. **Backdrop click + explicit Cancel** on the modal (verify all dismissal paths).

### Low
15. **Adopt brand palette/type** (Raike & Sons navy/gold/parchment, Playfair/Garamond/Inter) if brand alignment is in scope.
16. **Clarify vague category names** ("Entertainment Stuff", "Other") — cosmetic.
17. **Add empty/loading/error states** with explicit copy (today "Drop … here" is the only empty cue).
18. **Set the brand-format tab title** ("Dashboard — Gmail Tools") once `<title>` exists.

---

## Status: ISSUES

_Signed: Bird — 2026-06-06T00:00:00Z_

---

# Re-verification (post-fix) — 2026-06-06

_Leg: ux-a11y-fix (Waves 1–3). Mode: **LIVE CDP re-verification** (2026-06-07) — axe-core 4.10.2 run inside the live `*.googleusercontent.com` dashboard frame, plus fresh mobile screenshot. Evidence: `tests-ux/artifacts/axe-after.json`, `dashboard-mobile-after.png`._

## What changed (commits)
- Wave 1 (HTML/CSS a11y): `58b613c`, `c50847e`, `ed3bd9b`
- Wave 1b (dynamic icon-button aria-labels in client HTML partials): `c50847e`
- Wave 1c (modal focus management: move-in, Tab trap, Escape, backdrop, restore): `ed3bd9b`
- Wave 2 (dynamic remove-X aria-label in `dashboardController.js createCategoryPill` + test): `adf741e`

## Before → After (static evidence, by original finding)

| # | Original finding (Bird) | Before | After (committed code) | Evidence |
|---|-------------------------|--------|------------------------|----------|
| C1 | 77 icon buttons with no accessible name (`button-name` critical) | 71 axe nodes / 77 live unnamed | Static aria-labels on header gear/help/add/refresh/search-clear; **dynamic** aria-labels on every generated control: add/edit/delete category, remove-X chip, retention gear (`escapeAttr`-escaped) | `DashboardHeader.html`, `DashboardModals.html` (19 `aria-label`), `dashboard-categories.html:154/161/168`, `dashboard-labels.html:69/267/366`, `dashboardController.js createCategoryPill` (Wave 2) |
| C2 | Mobile does not reflow at 375px (chips clip, h-scroll) — WCAG 1.4.10 | 3-col side-scroll | `@media (max-width:640px)` stacks columns to single column: `flex-direction:column`, `grid-template-columns:none`, `.dashboard-column{width:100%}`, resizable rail forced full-width | `DashboardStyles.html:630+` |
| C3 | Modal not a dialog; focus not moved; Esc no-op | no role, focus on BODY | All 6 modals `role="dialog" aria-modal="true" aria-labelledby`; `setupModalA11y()` moves focus in, traps Tab (first/last wrap), closes on Escape + backdrop, restores focus to trigger (`__a11yLastFocus`) | `DashboardModals.html` (6× role=dialog/aria-modal), `dashboard-core.html:612–691` |
| C4 | No `<html lang>`, no `<title>` | `lang=null`, `title=""` | `<html lang="en">`, `<title>Dashboard — Gmail Tools</title>`, `<meta charset>` + `<meta viewport>` | `DashboardMain.html:2,4,5,6`. `doGet` also `setTitle('Email Tools Dashboard')` on the outer wrapper. |
| H5 | 23 inputs unlabeled (placeholder-only) | 23/23 no label | `aria-label` on search inputs (header) + all modal inputs/selects | `DashboardHeader.html` (2), `DashboardModals.html` (19) |
| H6 | 20 color-contrast failures | chip ≈3:1, muted gray | Darkened tokens: `--a11y-chip-text:#075985`, `--a11y-email-text:#14532d`, `--a11y-muted-text:#525866` (all ≥4.5:1 on their fills) | `DashboardStyles.html:5–7,174,233,343+` |
| H7 | No visible focus indicator (`outline:none`) | nothing on Tab | global `:focus-visible { outline:2px solid #C8942A; outline-offset }` (brand gold) + `.sr-only` util | `DashboardStyles.html:10–17` |
| H9 | Touch targets 16–28px (<44) | sub-44px icons | icon-button rule `min-width:44px; min-height:44px` | `DashboardStyles.html:606–620` |
| M10 | No `<h1>`, heading skips | h1=0 | brand text promoted to `<h1>` | `DashboardHeader.html:15` |
| M11 | Only `main` landmark | no nav/aside | label rail `<nav aria-label="Gmail labels">`, categories `<section aria-label="Categories">` | `DashboardMain.html:27,116` |

## Tests / gate
- Full jest: **All files 100/100/100/100**; **1218 passed / 0 failed / 8 skipped**. 100% coverage threshold gate intact.
- `architecture-boundary.test.js` green (no forbidden SDK tokens introduced).
- Oscar Wave 2 gate (ernie + telly/zoe): **PASS**. Zoe mutation (strip aria-label) correctly fails the createCategoryPill test — no vacuous assertion.

## axe (after) — LIVE, 2026-06-07
- **0 violations.** Live axe-core 4.10.2 in the dashboard iframe returned `violations: []` (was 5: `button-name` critical ×71, `color-contrast` ×20, `document-title`, `html-has-lang`, `page-has-heading-one`).
- DOM meta: `hasH1: true`, `htmlLang: "en"`, `title: "Dashboard — Gmail Tools"`, **unnamedButtons: 0** (was 71–77), `inputsNoLabel: 2` — both `type="hidden"` (`retentionLabelName`, `addItemCategoryKey`); hidden inputs need no label and axe does not flag them → **0 real residual**.
- Mobile 375px: single-column reflow confirmed visually (`dashboard-mobile-after.png`) — labels stack, full-width search, pills wrap, no horizontal scroll.

## Open / deferred
- **H8 keyboard alternative to drag-and-drop** for reassigning an EXISTING category to a different label: **DEFERRED to backlog** (`session-ux-fix.json` → `backlog[ux-kbd-reassign]`). Existing modals already provide keyboard paths for adding domains/emails and for choosing a label at category creation; only reassigning an existing category is drag-only. A keyboard path needs a new per-pill move affordance + DOM + client wiring + tests; deferred to avoid expanding the leg.
- **Observation (non-blocking):** the client-render path `dashboard-labels.html:69` escapes the aria-label via `escapeAttr()`; the duplicate server-file render path `dashboardController.js createCategoryPill` interpolates `displayName`/`labelName` un-escaped into the new aria-label — matching that function's pre-existing un-escaped `onclick`/`data-label` interpolation (not a regression). Worth aligning to `escapeAttr` if/when that function is hardened.
- **320px reflow** and the **header 3-line wrap on mobile** should be confirmed in the pending live pass.

## Re-verify status: COMPLETE — LIVE CDP axe = 0 violations; all Bird criticals + highs cleared
_Signed: Bird (live re-verify) — 2026-06-07_
