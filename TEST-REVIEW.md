# Test Review — 2026-06-06 (fix-nojobs-output-truncation)

## Summary
574 passed / 0 failed / 9 skipped across the full suite (24 of 25 suites; 1
suite is the live-Gemini describe.skip). The count dropped from the prior 577
because ~13 obsolete URL/anchor-injection + WARN-14/15/18/19 filter tests were
removed (they asserted behavior this leg intentionally deletes) and 9 new tests
were added. All four leg behaviors are covered by substantive (non-shallow)
tests. Architecture-boundary suite green.

## Test Results

| Suite | Tests | Passed | Failed | Skipped |
|-------|-------|--------|--------|---------|
| job-finder-extractor + api-service (focused) | 113 | 112 | 0 | 1 |
| full suite | 583 | 574 | 0 | 9 |

## Coverage of Leg Behaviors

| Behavior | Test(s) | Assertion quality |
|----------|---------|-------------------|
| Prompt drops URL/anchor injection | "does NOT inject any URL or anchor sections", "does NOT inject anchor pairs into the prompt", "does NOT inject extracted URLs into the prompt" | Asserts specific URLs + section headers + "→" absent |
| Prompt drops jobUrl | "does NOT reference jobUrl in the schema or rules" | Asserts `jobUrl` token absent |
| Wanted fields retained | "retains the wanted fields in the schema" | Asserts company/location/salary/employmentType/workArrangement/experienceLevel/confidence present |
| Salvage recovers truncated array | "salvages the complete jobs from a truncated (no closing ]) array" | Exact count (19) + exact field values (Company0, Title18) |
| Salvage returns [] when unsalvageable | "still returns [] when there is no salvageable complete object" | Exact `[]` |
| Salvage leaves valid arrays intact | "does not affect a well-formed (non-truncated) array" | Count + value |
| Job URL / URL Status always "" | "always sets Job URL and URL Status to empty string" | Both "" + wanted fields still carried |
| finishReason logged | "logs finishReason from the candidate" | Logger called with "finishReason" |
| MAX_TOKENS warned + no throw | "logs a MAX_TOKENS truncation warning and still returns the text" | Returns text AND warning logged |

## Obsolete Tests
Removed/flipped the prior URL-injection, anchor-injection, WARN-14/15/18/19
filter tests and the "URL Status to Found" test — they asserted the exact
behavior the leg removes. Correctly replaced with negative-assertion tests.

## Assertion Strength
Strong. The salvage test builds 19 valid records, truncates mid-20th, and asserts
exactly 19 recovered with correct first/last values — it would fail if salvage
over- or under-recovered. The MAX_TOKENS test asserts a two-part invariant
(no throw + returns the partial text + warning logged), so it cannot pass
vacuously. Prompt tests assert specific absent substrings.

## Flakiness
None — Gemini is mocked via global.callGeminiApi + serviceFactory.reset();
UrlFetchApp/Logger are mocked. No real timers, network, or randomness.

## Failed Tests
None.

## Coverage Gaps
None for the changed surface.

## Status: PASS

_Signed: Telly — 2026-06-06T00:00:00Z_
