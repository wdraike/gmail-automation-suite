# src/ — Architecture Rules

## Hexagonal Ports Invariant (authoritative)

The application is a hexagon with four layers. ONLY the adapter ring
(`src/core/services/**`) may touch platform SDKs. Every other layer — domain,
presentation, utilities, and the rest of `core` — accesses the platform
(Google Apps Script SDKs + the Gemini API) **only** through the ports in
`src/core/services`, resolved via the `serviceFactory` seam. Any direct platform
SDK reference outside `src/core/services/**` is an architecture **BLOCK**-level
violation.

See `.planning/adr/ADR-001-hexagonal.md` and `ARCHITECTURE.md` for the full model.

### Layers (inner → outer)
1. **Domain / feature logic** — `src/features/**`. Pure logic + orchestration.
2. **Application services** — app-level services that coordinate domain + ports
   (e.g. `UnifiedCacheService`, the label cache, config consumers). Use ports.
3. **Ports / adapters (the ONLY SDK-touching ring)** — `src/core/services/**`.
   Wrap the platform SDKs + Gemini HTTP. Direct SDK use here is CORRECT.
4. **Presentation** — `src/ui/**`. Calls application services / ports.

### Allowed-SDK ring
`src/core/services/**` is the single directory permitted to reference platform
SDK globals.

### Forbidden OUTSIDE `src/core/services/**`
Direct use of any of these (in `src/features`, `src/ui`, `src/utils`, or
`src/core` except `src/core/services/**`) is a **BLOCK**-level violation:

- `GmailApp`
- `SpreadsheetApp`
- `DriveApp`
- `UrlFetchApp`
- `PropertiesService`
- `CacheService` (the Apps Script SDK; `UnifiedCacheService` is an app-level service and is allowed)
- `MailApp`
- `Session.` (e.g. `Session.getActiveUser`, `Session.getScriptTimeZone`)
- `Utilities.` (e.g. `Utilities.sleep`, `Utilities.formatDate`, `Utilities.getUuid`)
- `callGeminiApi` (the Gemini global — use `GeminiAdapter`)
- `GmailService.` (the legacy Gmail wrapper — DELETED; use `GmailAdapter`)

### Approved ports (`src/core/services`)
All platform access flows through the `serviceFactory` singleton:

| Port | Accessor | Wraps |
|------|----------|-------|
| `GmailAdapter` | `serviceFactory.getGmailAdapter()` | `GmailApp` (+ `MailApp`, `Session`, label cache, threads, messages) |
| `SpreadsheetAdapter` | `serviceFactory.getSpreadsheetAdapter()` | `SpreadsheetApp` |
| `DriveAdapter` | `serviceFactory.getDriveAdapter()` | `DriveApp` |
| `GeminiAdapter` | `serviceFactory.getGeminiAdapter()` | `callGeminiApi` |
| `PropertiesAdapter` | `serviceFactory.getPropertiesAdapter()` | `PropertiesService` script properties |
| `UtilitiesAdapter` | `serviceFactory.getUtilitiesAdapter()` | `Utilities.sleep` / `formatDate` / `getUuid` / `Session.getScriptTimeZone` |
| `HttpAdapter` | `serviceFactory.getHttpAdapter()` | `UrlFetchApp` |
| `CacheAdapter` | `serviceFactory.getCacheAdapter()` | `CacheService.getScriptCache()` |

### Standard seam pattern
Files resolve the factory as a GAS global (concatenated scope) or a Node
`require` (tests), guarded for GAS compatibility, resolved **lazily at call
time** so any file (even one loaded first) can use it without a circular
dependency:

```js
function _xxServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  if (typeof require !== 'undefined') {
    return require('<relative>/core/services/index.js').serviceFactory;
  }
  throw new Error('serviceFactory is not available');
}
```

New adapters must match the existing pattern: constructor dependency injection
with a GAS-global fallback default, and a `module.exports` guard for Node tests.
Register every new port in `serviceFactory` (`getXAdapter()` + `reset()`). See
ARCHITECTURE.md → "How to add an adapter".

### Tests
Tests reset the factory in `beforeEach` (`serviceFactory.reset()`) and drive the
underlying global SDK mocks (`tests-local/setup.js`); the real adapters delegate
to those globals.

### Enforcement
- **Test guard:** `tests-local/architecture-boundary.test.js` greps
  `src/features/**`, `src/ui/**`, `src/utils/**`, and `src/core/**` (EXCEPT
  `src/core/services/**`) for the forbidden tokens and fails CI on any violation.
  It also self-tests by planting a violation in each covered directory.
- **Cookie reviewer:** flags any forbidden-token reference in any non-adapter
  layer as **BLOCK** severity.

### Documented exceptions (per global no-fallback / no-undocumented-exception rule)
- **ADR-001 D2 — `src/core/api-service.js` defines `callGeminiApi`.** This file
  is the Gemini infrastructure that the `GeminiAdapter` wraps. It is whitelisted
  in the boundary test for the single `callGeminiApi` token (its own definition +
  export). All of its platform SDK access (UrlFetchApp, Properties, Drive,
  Utilities) is routed through ports. No other file may reference `callGeminiApi`.
- `GmailAdapter.getAllLabels()` returns `[]` on Gmail error — pre-existing
  behavior of the legacy `GmailLabelService.getAllLabels`, relocated verbatim
  into the port during the hexagonal-ports-refactor (not a new fallback).
- **ADR-001 D4 — config.js `NOTIFICATION_EMAIL` removed.** The former
  module-load `Session.getActiveUser().getEmail()` had zero consumers and was
  deleted, so no runtime exception remains. Code needing the user email uses
  `serviceFactory.getGmailAdapter().getUserEmailAddress()`.
