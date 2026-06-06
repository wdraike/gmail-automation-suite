# ADR-001 — Full-Application Hexagonal Architecture

**Status:** Accepted
**Date:** 2026-06-06
**Leg:** full-hexagonal-conversion

## Context

The "email Tools" Google Apps Script project mixes domain logic, application
services, presentation (UI), and direct platform-SDK access throughout the
codebase. Direct references to Google Apps Script SDKs (`GmailApp`,
`SpreadsheetApp`, `DriveApp`, `UrlFetchApp`, `PropertiesService`, `CacheService`,
`MailApp`, `Session`, `Utilities`) and the Gemini HTTP call appear in feature
code, UI code, and utility code. This makes the code hard to unit-test in Node
(Jest), couples business logic to the platform, and gives no single place to
reason about external effects.

A prior leg (hexagonal-ports-refactor) converted `src/features/**` to route all
platform access through ports in `src/core/services`, and added a boundary guard
test that scans `src/features/**`. This ADR extends that invariant to the WHOLE
application.

## Decision

The application is organized as a hexagon with four layers (inner → outer):

1. **Domain / feature logic** — `src/features/**`. Pure logic + orchestration.
   No SDK. Routes through ports via the `serviceFactory` seam.
2. **Application services** — app-level services that coordinate domain + ports
   (e.g. `UnifiedCacheService`, label cache, config consumers). No direct SDK —
   use ports. `UnifiedCacheService` is itself an application-level service whose
   storage internals are an adapter (see D3); callers may use it directly.
3. **Ports / adapters (the ONLY SDK-touching ring)** — `src/core/services/**`.
   Wrap `GmailApp` / `SpreadsheetApp` / `DriveApp` / `UrlFetchApp` /
   `PropertiesService` / `CacheService` / `MailApp` / `Session` / `Utilities` +
   Gemini HTTP. Direct SDK use **here is correct**.
4. **Presentation** — `src/ui/**`. Calls application services / ports, never the
   SDK directly.

### Allowed-SDK ring

The **only** directory permitted to reference platform SDK globals is
`src/core/services/**`. Every other layer (`src/features`, `src/ui`,
`src/utils`, and the rest of `src/core`) routes through ports obtained from the
`serviceFactory` singleton. This is enforced by
`tests-local/architecture-boundary.test.js` (expanded scope) and by the Cookie
architecture reviewer.

The forbidden token set (outside `src/core/services/**`) is:

```
GmailApp  SpreadsheetApp  DriveApp  UrlFetchApp  PropertiesService
CacheService (the SDK; UnifiedCacheService is allowed)  MailApp
Session.  Utilities.  callGeminiApi  GmailService.
```

### Seam pattern

Files resolve the factory as a GAS global (concatenated scope) or a Node
`require` (tests), guarded for GAS compatibility:

```js
function _xxServiceFactory() {
  if (typeof serviceFactory !== 'undefined') return serviceFactory;
  if (typeof require !== 'undefined') {
    return require('<relative>/core/services/index.js').serviceFactory;
  }
  throw new Error('serviceFactory is not available');
}
```

New adapters use constructor dependency injection with a GAS-global fallback
default and a `module.exports` guard for Node tests. Every port is registered in
`serviceFactory` (`getXAdapter()` + `reset()`).

## Decisions D1–D6

- **D1 (allowed-SDK set):** ONLY `src/core/services/**` may reference platform
  SDKs. Everything else routes through ports. The boundary test + Cookie enforce
  this across `src/features`, `src/ui`, `src/utils`, and non-adapter `src/core`.

- **D2 (api-service.js Gemini HTTP):** The `UrlFetchApp` Gemini call is platform
  infrastructure. It is relocated behind an **HttpAdapter** (`http-adapter.js`)
  in the adapter ring; `api-service.js` (and `config.js#testGeminiApiKey`) call
  `serviceFactory.getHttpAdapter().fetch(url, options)` instead of `UrlFetchApp`
  directly. `api-service.js` then contains no SDK tokens except those routed
  through ports.

- **D3 (cache-service.js):** `UnifiedCacheService` wraps `CacheService`. A
  **CacheAdapter** (`cache-adapter.js`) wraps `CacheService.getScriptCache()`.
  `cache-service.js` routes its cache/properties/drive access through
  `CacheAdapter`, `PropertiesAdapter`, and `DriveAdapter`. `UnifiedCacheService`
  remains the app-level service callers use; it no longer touches SDK globals
  directly.

- **D4 (config.js):** `PropertiesService` reads/writes route through
  `PropertiesAdapter`.
  **Documented exception (approved, goal-driven run):**
  `JOB_FINDER_CONFIG.NOTIFICATION_EMAIL` is evaluated at module-load time via
  `Session.getActiveUser().getEmail()`. This is a load-order/bootstrap concern:
  the config object literal is constructed before the serviceFactory seam is
  guaranteed resolvable in the GAS concatenated scope, and moving a getter onto
  the literal would change its shape (it is consumed as a plain property). It is
  isolated to a single line and is read-only identity bootstrap. It is therefore
  routed through a lazy `_configSession()` seam where possible, and any residual
  direct reference is explicitly whitelisted in the boundary test with this ADR
  rationale. `getApiKey()` reads the `API_KEY` script property directly only as
  the bootstrap path the adapters' Gemini HTTP depends on; it is routed through
  `PropertiesAdapter` as well since the PropertiesAdapter has no dependency on
  the Gemini/HTTP layer (no circular dependency exists in practice).

- **D5 (gmail-service.js legacy):** `GmailLabelService` / `GmailThreadService`
  (the `GmailService` global) is the legacy Gmail wrapper. All remaining callers
  (`src/ui/dashboardController.js`, `src/ui/dashboard-api.js`) migrate onto
  `GmailAdapter` (extended with `getOrCreateLabel` nested-path support,
  `getLabelSafe`, `getAllLabels`, `getThreadsFromLabel`, `getThreadMetadata`,
  `getMessageById`). `src/core/gmail-service.js` is then DELETED. No two Gmail
  abstractions.

- **D6 (Utilities/MailApp/Session):** Adapter coverage is extended as needed.
  `UtilitiesAdapter` gains `getUuid()`. `GmailAdapter` already wraps `MailApp`
  (`sendEmail`) and `Session` (`getUserEmailAddress`). A `getScriptTimeZone()`
  accessor is added to `UtilitiesAdapter` (or surfaced via the existing
  Session-wrapping adapter) for `dashboard-api.getLastRunTime`.

## Consequences

- All business/UI/utility code is unit-testable in Node by injecting mock
  services into the `serviceFactory`.
- There is exactly one place (the adapter ring) to reason about external
  effects, retries, and quota.
- The boundary guard test fails CI on any new direct-SDK reference outside the
  ring, preventing architecture drift.
- Documented exceptions (D4) are explicitly whitelisted and justified here.
