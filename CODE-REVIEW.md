# Code Review — fix-gemini-429-pipeline — 2026-06-05

## Summary
Ship-ready. The 429/503 handling is correct and the precheck no longer swallows
API failures into a false "no jobs" (the root cause of silent email loss). No
unapproved fallbacks were introduced — both functions FAIL LOUDLY or surface
RATE_LIMIT_REACHED for the caller to queue. No Critical or Warning findings.

## Critical Findings (must fix before merge)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| — | None | — | — |

## Warning Findings (fix this sprint)
| # | Finding | File:Line | Remediation |
|---|---------|-----------|-------------|
| — | None | — | — |

## Info / Suggestions
| # | Finding | File:Line | Suggestion |
|---|---------|-----------|------------|
| 1 | `isRateLimitSignal` regex uses `\b429\b`/`\b503\b`, which could match a non-rate-limit error message that happens to contain those bare numbers, causing it to be treated as rate-limited (queued/retried). | extractor.js:26 | Acceptable: on the `{success:false}` path the alternative is a genuine API failure, and queue-for-retry is the safe, non-data-losing choice. No action required. |
| 2 | callGemini throws RATE_LIMIT_REACHED for 503 (server overload) which is technically "unavailable" not "rate limit", but is routed through the same backoff path. | api-service.js:433 | Intentional and correct — 503 is transient and benefits from the same exponential backoff. Comment documents this. |
| 3 | The `{success:false}` non-rate-limit branch throws a descriptive error; processOneEmail's generic catch marks the thread processed (no retry loop) without marking NoJobs. | extractor.js:52 | Confirmed correct against main.js:369-386 — thrown non-RL error does NOT archive as NoJobs. |

## Trace Verification
- callGemini (429/503) throws RATE_LIMIT_REACHED -> callGeminiWithRateLimiting
  catch (api-service.js:235) sets backoff and re-throws -> callGeminiApi catch
  (api-service.js:157) returns `{success:false, error:"Error: RATE_LIMIT_REACHED"}`.
- isJobListingEmail `{success:false}` branch matches isRateLimitSignal
  -> throws RATE_LIMIT_REACHED -> processOneEmail catch (main.js:373) calls
  markEmailAsRateLimited + re-throws to stop the batch. Email is QUEUED, not lost.
- Genuine "NO" -> `{success:true, response:"NO"}` -> returns false -> markEmailAsNoJobs
  (legitimate). Behavior preserved.

## Checklist Status
- [x] Complexity — PASS (small, localized changes)
- [x] Error handling — PASS (fails loudly / queues; no swallowed errors)
- [x] Test coverage — PASS (RED-first tests added for all new branches)
- [x] Observability — PASS (Logger.log retained on the re-throw path)
- [x] Scalability — PASS (no I/O / loop changes)
- [x] No unapproved fallbacks — PASS (no `|| false` / `?? default` added)
- [x] Dead code — PASS

## Status: PASS

_Signed: Ernie — 2026-06-05T00:00:00Z_
