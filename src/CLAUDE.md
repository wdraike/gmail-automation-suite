# src/ — Architecture Rules

## Hexagonal Ports Invariant (authoritative)

Domain and feature code under `src/features/**` MUST access the platform — Google
Apps Script SDKs and the Gemini API — **only** through the ports in
`src/core/services`. Direct references to platform SDKs in `src/features/**` are
architecture violations.

### Forbidden in `src/features/**`
Direct use of any of these is a **BLOCK**-level violation:

- `GmailApp`
- `SpreadsheetApp`
- `DriveApp`
- `UrlFetchApp`
- `PropertiesService`
- `CacheService` (the Apps Script SDK; `UnifiedCacheService` is an app-level service and is allowed)
- `Utilities.` (e.g. `Utilities.sleep`, `Utilities.formatDate`)
- `callGeminiApi` (the legacy Gemini global)
- `GmailService.` (the legacy Gmail wrapper — features must use `GmailAdapter`)

### Approved ports (`src/core/services`)
All platform access flows through the `serviceFactory` singleton:

| Port | Accessor | Wraps |
|------|----------|-------|
| `GmailAdapter` | `serviceFactory.getGmailAdapter()` | `GmailApp` (+ `MailApp`, `Session`, label cache) |
| `SpreadsheetAdapter` | `serviceFactory.getSpreadsheetAdapter()` | `SpreadsheetApp` |
| `DriveAdapter` | `serviceFactory.getDriveAdapter()` | `DriveApp` |
| `GeminiAdapter` | `serviceFactory.getGeminiAdapter()` | `callGeminiApi` |
| `PropertiesAdapter` | `serviceFactory.getPropertiesAdapter()` | `PropertiesService` script properties |
| `UtilitiesAdapter` | `serviceFactory.getUtilitiesAdapter()` | `Utilities.sleep` / `Utilities.formatDate` |

### Standard seam pattern
Feature files resolve the factory as a GAS global (concatenated scope) or a Node
`require` (tests), guarded for GAS compatibility:

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
Register every new port in `serviceFactory` (`getXAdapter()` + `reset()`).

### Enforcement
- **Test guard:** `tests-local/architecture-boundary.test.js` greps `src/features/**`
  for the forbidden tokens and fails CI on any violation.
- **Cookie reviewer:** flags any forbidden-token reference under `src/features/**`
  as **BLOCK** severity on all new development.

### Approved fallbacks (documented per global no-fallback rule)
- `GmailAdapter.getAllLabels()` returns `[]` on Gmail error. This is the
  pre-existing behavior of the legacy `GmailLabelService.getAllLabels`, relocated
  verbatim into the port during the hexagonal-ports-refactor — not a new fallback.
