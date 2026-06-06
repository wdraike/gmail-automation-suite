# WBS — Full-Application Hexagonal Conversion

**Leg:** full-hexagonal-conversion
**Goal:** Every layer of the app is hexagonal: domain/app code accesses the platform ONLY through ports in `src/core/services`. The adapter ring is the single SDK-touching layer. Documented (ADR + ARCHITECTURE.md + src/CLAUDE.md), tested (port tests + boundary guard expanded), reviewed (Oscar: ernie/telly/zoe/cookie), built (clasp), committed + pushed.

## Locked architecture decisions (ADR-001)
Layers, inner → outer:
1. **Domain / feature logic** — `src/features/**`. Pure logic + orchestration. NO SDK. (already compliant)
2. **Application services** — app-level services that coordinate domain + ports (e.g. UnifiedCacheService usage, label cache, config consumers). NO direct SDK — use ports.
3. **Ports / adapters (the ONLY SDK-touching ring)** — `src/core/services/**`. Wrap GmailApp/SpreadsheetApp/DriveApp/UrlFetchApp/PropertiesService/CacheService/MailApp/Session/Utilities + Gemini HTTP. Direct SDK use here is CORRECT.
4. **Presentation** — `src/ui/**`. Calls application services / ports, NEVER the SDK directly.

### Decisions
- **D1 (allowed-SDK set):** ONLY `src/core/services/**` may reference platform SDKs. Everything else (features, ui, utils, other core) routes through ports. Boundary test + Cookie expand to enforce this across `src/features`, `src/ui`, `src/utils`, and non-adapter `src/core`.
- **D2 (api-service.js):** It is the Gemini HTTP infra behind GeminiAdapter. RELOCATE its `UrlFetchApp` call into a proper adapter under `src/core/services/` (e.g. fold the HTTP into gemini-adapter or a new http-adapter), OR move api-service.js under `src/core/services/`. Prefer relocation so the allowed-SDK set stays exactly `core/services/**`. If full relocation is too risky in one leg, wrap the SDK calls and whitelist api-service.js explicitly in the boundary test with a documented ADR rationale.
- **D3 (cache-service.js):** UnifiedCacheService wraps CacheService — it IS an adapter. Move it under `src/core/services/` (CacheAdapter) or formally classify it as part of the adapter ring. App code uses it via the service, not raw CacheService.
- **D4 (config.js):** Route `PropertiesService` reads/writes through PropertiesAdapter. EXCEPTION: the bootstrap path that the adapters themselves depend on (e.g. getApiKey) may read properties directly to avoid a circular dependency — if so, isolate that into the adapter ring or document the exception in ADR + src/CLAUDE.md per the no-undocumented-exceptions rule.
- **D5 (gmail-service.js legacy):** Migrate ALL remaining callers (ui, core) onto GmailAdapter, then DELETE gmail-service.js. No two Gmail abstractions.
- **D6 (Utilities/MailApp/Session):** add adapter coverage as needed (UtilitiesAdapter exists; extend GmailAdapter for MailApp/Session, already partially done).

## Waves (each: TDD RED→GREEN, Oscar gate, atomic commit, clasp push)

### Wave 1 — Architecture spec + adapter ring completion
- Write ADR-001 (`.planning/adr/ADR-001-hexagonal.md`) capturing layers + D1–D6.
- Ensure adapter ring covers every SDK currently used: add/extend CacheAdapter (D3), HTTP/Gemini relocation (D2), any missing Utilities/MailApp/Session methods. Register all in serviceFactory. Unit-test each new/extended adapter.

### Wave 2 — Convert `src/ui/**`
- dashboardController.js (21), dashboard-api.js (6), gmail-addon.js (4): replace all direct SDK with port calls via serviceFactory seam. Update/author tests (dashboard-api.test.js, dashboardController.test.js, gmail-addon.test.js).

### Wave 3 — Convert `src/utils/**` + non-adapter `src/core`
- utils/label-cache.js (10) → ports.
- core/config.js (21) → PropertiesAdapter (D4 exception isolated/documented).
- Deprecate + DELETE core/gmail-service.js (D5); migrate callers.

### Wave 4 — Relocate infra into adapter ring
- api-service.js HTTP (D2) + cache-service.js (D3) into/behind `src/core/services/**`. Keep behavior identical. Update tests.

### Wave 5 — Enforcement expansion
- Expand `tests-local/architecture-boundary.test.js`: scan `src/features`, `src/ui`, `src/utils`, and `src/core` EXCEPT `src/core/services/**` (the allowed ring) for forbidden tokens; fail on any. Verify it catches a planted violation in each newly-covered dir.
- Update Cookie SKILL.md rubric: BLOCK scope = all non-adapter layers (not just features).
- Update `src/CLAUDE.md` invariant: new layer model + allowed-SDK set = `src/core/services/**` only.

### Wave 6 — Documentation + final review
- `ARCHITECTURE.md` (root or docs/): the hexagon, layers, ports table, seam pattern, how to add an adapter, diagram (ASCII ok). Verified by prairie/abby standards if available.
- Full suite green + grown. Oscar full pass (ernie/telly/zoe + cookie on boundary). clasp push. git push origin master.

## Constraints
- TDD RED→GREEN per wave. NO unapproved fallbacks (document any in src/CLAUDE.md/ADR). Behavior identical (structural). Atomic commits. Boundary test must end GREEN with expanded scope.
- DoD: grep of `src/features` + `src/ui` + `src/utils` + `src/core` (excl `src/core/services/**`) for the forbidden token set = CLEAN (only documented exceptions). Docs written. Tests green + reviewed. Built + deployed + pushed.
