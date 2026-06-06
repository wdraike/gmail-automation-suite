# Architecture — email Tools (Google Apps Script)

This application uses a **hexagonal (ports-and-adapters) architecture**. Domain
logic, presentation, utilities, and application services are isolated from the
Google Apps Script platform behind a single adapter ring. This document is the
authoritative architecture reference; the machine-enforced invariant lives in
`src/CLAUDE.md` and the design rationale in
`.planning/adr/ADR-001-hexagonal.md`.

## The hexagon

```
                         ┌──────────────────────────────────────────┐
                         │            PRESENTATION (src/ui)           │
                         │  dashboardController · dashboard-api ·     │
                         │  gmail-addon                               │
                         └───────────────────┬──────────────────────┘
                                             │ calls ports via serviceFactory
   ┌─────────────────────────────────────────▼─────────────────────────────────┐
   │                       APPLICATION SERVICES (src/core, src/utils)            │
   │      UnifiedCacheService · label-cache · config · api-service (Gemini infra)│
   └─────────────────────────────────────────┬─────────────────────────────────┘
                                             │ calls ports via serviceFactory
   ┌─────────────────────────────────────────▼─────────────────────────────────┐
   │                          DOMAIN / FEATURES (src/features)                   │
   │   job-finder (main, extractor, sheets-handler) · email-sorter ·            │
   │   email-retention-manager · enhanced-label-manager                         │
   └─────────────────────────────────────────┬─────────────────────────────────┘
                                             │ ALL platform access flows through:
   ╔═════════════════════════════════════════▼═════════════════════════════════╗
   ║                ADAPTER RING — src/core/services/**  (ONLY SDK ring)         ║
   ║  GmailAdapter · SpreadsheetAdapter · DriveAdapter · GeminiAdapter ·        ║
   ║  PropertiesAdapter · UtilitiesAdapter · HttpAdapter · CacheAdapter         ║
   ║                      (resolved via the serviceFactory singleton)            ║
   ╚═════════════════════════════════════════┬═════════════════════════════════╝
                                             │ wraps
   ┌─────────────────────────────────────────▼─────────────────────────────────┐
   │   GOOGLE APPS SCRIPT PLATFORM  (GmailApp, SpreadsheetApp, DriveApp,         │
   │   UrlFetchApp, PropertiesService, CacheService, MailApp, Session,           │
   │   Utilities) + the Gemini HTTP API                                          │
   └────────────────────────────────────────────────────────────────────────────┘
```

## Layer model

| Layer | Location | Responsibility | SDK access |
|-------|----------|----------------|------------|
| Presentation | `src/ui/**` | Web-app dashboard + Gmail add-on cards | via ports only |
| Domain / features | `src/features/**` | Job finder, email sorter, retention, label mgmt | via ports only |
| Application services | `src/core/**` (excl. services), `src/utils/**` | Cache, config, label cache, Gemini infra | via ports only |
| **Adapter ring** | `src/core/services/**` | Wrap every platform SDK + Gemini HTTP | **direct SDK (correct)** |

**The allowed-SDK ring is `src/core/services/**` and nothing else.** Any direct
platform SDK reference outside that directory is an architecture violation
(enforced by `tests-local/architecture-boundary.test.js` and the Cookie
reviewer).

## Ports table

All ports are obtained from the `serviceFactory` singleton
(`src/core/services/index.js`).

| Port | Accessor | Wraps | Key methods |
|------|----------|-------|-------------|
| `GmailAdapter` | `getGmailAdapter()` | `GmailApp`, `MailApp`, `Session` | `getThreadById`, `getMessageById`, `getUserLabels`, `getUserLabelByName`, `createLabel`, `getOrCreateLabel` (nested), `getLabelSafe`, `getAllLabels`, `search`, `getThreadsFromLabel`, `getThreadMetadata`, `sendEmail`, `getUserEmailAddress` |
| `SpreadsheetAdapter` | `getSpreadsheetAdapter()` | `SpreadsheetApp` | `openById`, `create`, sheet helpers |
| `DriveAdapter` | `getDriveAdapter()` | `DriveApp` | `getFileById`, `createFile`, `getFoldersByName`, `createFolder`, file/folder helpers |
| `GeminiAdapter` | `getGeminiAdapter()` | `callGeminiApi` (global) | `call(prompt, operationType)` |
| `PropertiesAdapter` | `getPropertiesAdapter()` | `PropertiesService` script properties | `getProperty`, `setProperty`, `deleteProperty`, `getProperties` |
| `UtilitiesAdapter` | `getUtilitiesAdapter()` | `Utilities`, `Session.getScriptTimeZone` | `sleep`, `formatDate`, `getUuid`, `getScriptTimeZone` |
| `HttpAdapter` | `getHttpAdapter()` | `UrlFetchApp` | `fetch(url, options)` |
| `CacheAdapter` | `getCacheAdapter()` | `CacheService.getScriptCache()` | `get`, `put`, `remove`, `removeAll` |

## The seam pattern

Apps Script concatenates all files into one global scope; Jest tests run each
file as a Node module. Consumers resolve the factory **lazily at call time** so
load order never matters and there is no circular dependency:

```js
function _xxServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;            // GAS: global from services/index.js
  }
  if (typeof require !== 'undefined') {
    return require('<rel>/core/services/index.js').serviceFactory; // Node tests
  }
  throw new Error('serviceFactory is not available');
}

function _xxGmail() { return _xxServiceFactory().getGmailAdapter(); }
// ...then call _xxGmail().getUserLabelByName(name) instead of GmailApp.*
```

Each adapter uses constructor dependency injection with a GAS-global fallback
default and a `module.exports` guard:

```js
class HttpAdapter {
  constructor(urlFetchApp = (typeof UrlFetchApp !== 'undefined' ? UrlFetchApp : undefined)) {
    this.urlFetchApp = urlFetchApp;
  }
  fetch(url, options) { return this.urlFetchApp.fetch(url, options); }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HttpAdapter };
}
```

## How to add an adapter

1. **Create** `src/core/services/<name>-adapter.js` following the seam pattern
   above (constructor DI with GAS-global fallback + `module.exports` guard).
2. **Register** it in `src/core/services/index.js`:
   - add the Node `require` to the top block,
   - add a `getXAdapter()` accessor (lazy singleton, `this.services.X || global`),
   - null it in `reset()`,
   - add it to the `module.exports` block.
3. **Unit-test** it: `tests-local/<name>-adapter.test.js` — constructor (injected
   + global fallback) and one delegation/error test per method. Add a
   factory-registration + reset test to `tests-local/service-adapters.test.js`.
4. **Consume** it from app code via the `_xxServiceFactory().getXAdapter()` seam;
   never reference the SDK global directly.
5. **Document** it: add a row to the ports table here and in `src/CLAUDE.md`.

## Testing approach

Tests reset the factory in `beforeEach` (`serviceFactory.reset()`) and drive the
underlying global SDK mocks defined in `tests-local/setup.js`; the real adapters
delegate to those globals, so the same mocks exercise both the adapter and the
consumer.

## Enforcement

- **CI guard:** `tests-local/architecture-boundary.test.js` scans all four
  non-adapter layers for the forbidden tokens, fails on any match, and self-tests
  by planting a violation in each directory.
- **Cookie reviewer:** flags any forbidden-token reference outside the ring as
  **BLOCK**.

## Documented exceptions

See `.planning/adr/ADR-001-hexagonal.md` (D2, D4) and `src/CLAUDE.md`:
- `src/core/api-service.js` may **define/export** the `callGeminiApi` global it
  backs (whitelisted for that one token); all its SDK access is via ports.
- `GmailAdapter.getAllLabels()` returns `[]` on Gmail error (pre-existing
  behavior relocated verbatim into the port).
