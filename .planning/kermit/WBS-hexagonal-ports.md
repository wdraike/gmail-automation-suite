# WBS — Route Everything Through Ports + Enforce Hexagonal

**Leg:** hexagonal-ports-refactor
**Goal:** All feature/domain code reaches Google SDKs + Gemini ONLY through ports (adapters). No direct `GmailApp`/`SpreadsheetApp`/`DriveApp`/`UrlFetchApp`/`PropertiesService`/`CacheService`/`Utilities`/`callGeminiApi` in `src/features/`. Cookie reviewer enforces this on ALL new development.

## Approved decisions (locked by user)
- D1 scope: **ALL features** — job-finder, email-sorter, email-retention-manager, enhanced-label-manager.
- D2 ports: **create all missing** — GeminiAdapter (wrap `callGeminiApi`/`ApiService`), PropertiesAdapter (a.k.a. ConfigPort, wrap `PropertiesService`), UtilitiesAdapter (wrap `Utilities.sleep`/`formatDate`). Plus existing Gmail/Sheets/Drive adapters.
- D3 Gmail dup: **consolidate to GmailAdapter** — migrate feature code off the legacy `GmailService` wrapper onto the injectable `GmailAdapter`; deprecate `GmailService` usage in features.
- Cookie: **strict** — direct SDK access in `src/features/` (or any domain layer) = BLOCK severity. Enforced on all new dev going forward.

## Violation inventory (evidence)
- `src/features/job-finder/main.js`: `GmailService.labels.*` x8, `SpreadsheetApp.openById/create` x3, `PropertiesService.getScriptProperties()` x3, `Utilities.sleep`.
- `src/features/job-finder/sheets-handler.js`: `SpreadsheetApp.openById`, `SpreadsheetApp.BandingTheme`, `Utilities.formatDate`.
- `src/features/job-finder/extractor.js`: `PropertiesService` x2 (GEMINI_ERRORS), `callGeminiApi` (global, no port).
- `src/features/email-sorter/sorter.js`: `GmailApp.*` (search/getInboxThreads/getUserLabelByName/createLabel), `PropertiesService`.
- `src/features/email-sorter/categorizer-cache.js`: `DriveApp.*`, `GmailApp.*`, `PropertiesService`.
- `src/features/email-retention-manager.js`: `GmailApp.*`, `PropertiesService`, `Utilities.sleep`, `GmailService.labels`.
- `src/features/enhanced-label-manager.js`: `GmailApp.getUserLabelByName/createLabel`.

## Port surface
- Existing: `src/core/services/{gmail,spreadsheet,drive}-adapter.js` + `index.js` `serviceFactory`.
- New: `gemini-adapter.js`, `properties-adapter.js`, `utilities-adapter.js`. Register all in `serviceFactory` (getGeminiAdapter/getPropertiesAdapter/getUtilitiesAdapter) with DI + GAS-global fallback, matching existing adapter pattern (constructor injection, Node require + GAS global, module.exports guard).

## Work packages (wave-ordered)

### Wave 1 — Build missing ports (TDD)
- WP1.1 GeminiAdapter: wrap `callGeminiApi(prompt, type)`. Unit-test with injected mock.
- WP1.2 PropertiesAdapter: get/set/delete script properties. Unit-test.
- WP1.3 UtilitiesAdapter: `sleep`, `formatDate`. Unit-test.
- WP1.4 Register all three in `serviceFactory` + exports. Update `core/services/index.js` tests.

### Wave 2 — Migrate job-finder onto ports (TDD)
- WP2.1 main.js: replace `GmailService.labels.*`->GmailAdapter, `SpreadsheetApp`->SpreadsheetAdapter, `PropertiesService`->PropertiesAdapter, `Utilities.sleep`->UtilitiesAdapter.
- WP2.2 extractor.js: `callGeminiApi`->GeminiAdapter, `PropertiesService`->PropertiesAdapter.
- WP2.3 sheets-handler.js: `SpreadsheetApp`/`Utilities.formatDate`->adapters.
- Keep behavior identical. Update job-finder tests to inject mocks via serviceFactory.

### Wave 3 — Migrate remaining features (TDD)
- WP3.1 email-sorter (sorter.js, categorizer-cache.js).
- WP3.2 email-retention-manager.js.
- WP3.3 enhanced-label-manager.js.
- Consolidate all Gmail access onto GmailAdapter; deprecate legacy GmailService in features (leave GmailService file if other non-feature callers exist, but features must not touch it).

### Wave 4 — Enforce (Cookie strict + invariant doc)
- WP4.1 Add hexagonal invariant to a CLAUDE.md (root or src/) + an ADR in `.planning/`: "Domain/feature layer MUST access platform (Google SDK, Gemini, Properties, Cache, Utilities) only through `src/core/services` ports. Direct SDK in `src/features/**` = architecture violation."
- WP4.2 Update the `cookie` skill (architecture reviewer) rubric: add a hard rule that flags any `GmailApp|SpreadsheetApp|DriveApp|UrlFetchApp|PropertiesService|CacheService|Utilities\.|callGeminiApi` reference under `src/features/` (or non-core domain) as **BLOCK**. Applies to all new development.
- WP4.3 (optional) add a guard test or lint grep that fails CI if features import SDKs directly — gives Cookie teeth in tests.

## Constraints
- TDD: RED before GREEN, per wave.
- No unapproved fallbacks (CLAUDE.md). Behavior must stay identical — this is a structural refactor, not a behavior change.
- Full suite must stay green (baseline 544 passed / 0 / 9 skipped) and grow with new port tests.
- Oscar gate per wave (or at end if waves committed atomically). PASS/WARN -> `git commit --no-verify`. BLOCK -> stop, fix.
- Deploy via `clasp push` after commits.
- Atomic commits per wave (conventional commit messages).
