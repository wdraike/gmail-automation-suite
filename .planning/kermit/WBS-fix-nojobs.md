# WBS — Fix NoJobs False Negatives

**Leg:** fix-nojobs-false-negatives
**Goal:** Emails wrongly filed `📬 JobAlerts/NoJobs` that contain real listings get correctly extracted. Adjust extraction + Gemini prompt for digest/aggregator formats.

## Root cause (evidence-based)

1. **Truncation drops tail jobs.** `extractor.js:62` `maxLength=30000`. Glassdoor digest (thread 19e9d56caf26e3e3) = 99K HTML, **no plaintext part**; CSS/`@font-face`/MSO-conditional/VML noise fills the front; real jobs sit at the TAIL → cut off → Gemini sees only noise → `[]`.
2. **VML buttons, not anchors.** Glassdoor uses `<v:roundrect>` Outlook VML buttons → `extractAnchorPairs` (anchor regex) returns `[]` → no URL mappings.
3. **Stale precheck artifacts.** Google Alerts digest (19e9aa3adc7b13b7) has clean structured plaintext w/ 10 jobs but was filed NoJobs — processed by the old `isJobListingEmail` precheck (removed `fea3cbe`) before deploy. Needs reprocess, not code change.
4. **Prompt lacks digest guidance.** No instruction for aggregator block format (title / company / location / via X / date / type repeated per job) or zero-width obfuscation (Indeed).

## Work packages

### WP1 — Fixtures + RED tests
- Capture real misfiled emails as fixtures under `tests-local/fixtures/job-finder-nojobs/`.
  - `glassdoor-99k-no-plaintext.html` (already saved).
  - Add Google Alerts + Indeed bodies (thread ids in session.json; agent may re-fetch via Gmail MCP or hand-build minimal repro).
- Failing unit tests in `job-finder-extractor.test.js`:
  - `extractTextFromHtml` on Glassdoor fixture: stripped text RETAINS the tail job text ("Northrop Grumman", "Sr. Staff Chief Engineer", "Rolling Meadows, IL") within the prompt budget (i.e. noise stripped BEFORE truncation).
  - prompt-construction test: digest block format guidance present.
  - (No live-Gemini tests — keep that path `describe.skip` like the existing 8.)

### WP2 — Extraction fix (GREEN)
- Strip high-volume noise BEFORE truncation: `<style>`/`@font-face` (already partial), MSO conditional comments `<!--[if mso]>...<![endif]-->`, VML (`<v:*>`), HTML comments. Goal: real job text fits in budget.
- Treat the existing `maxLength` budget as covering job text AFTER noise removal. Bump modestly ONLY if needed — do NOT blindly raise (project just fought 429 quota; bigger payloads burn quota). Prefer noise-reduction.
- Extend `extractAnchorPairs` (or add VML href capture) so VML-button URLs are recoverable — OPTIONAL, low priority (URL is a nice-to-have field, not gating).
- Strip zero-width chars (U+200C/200B/200E/200F/FEFF) from text.

### WP3 — Prompt strengthening
- Add digest/aggregator guidance to the Gemini prompt: "Emails may be job-alert digests listing many roles as repeated blocks (Title / Company / Location / via Source / Date / Employment type). Extract EVERY block as a separate job." Keep JSON contract unchanged.

### WP4 — Reprocess misfiled threads (runtime, manual)
- Provide a one-shot helper (or documented manual step) to move existing `NoJobs` threads back to `📬 JobAlerts` source label for re-run under the fixed pipeline. Do NOT auto-run destructive relabeling without confirmation.

## Constraints
- TDD: RED before GREEN.
- No unapproved fallbacks (CLAUDE.md). Truncation that silently drops data is the bug — fix root cause, don't paper over.
- Oscar gate before commit. PASS/WARN → `git commit --no-verify`. BLOCK → stop.
- Deploy via `clasp push` after commit (Apps Script project).

## Decisions needed from user (gray areas)
- D1: bump `maxLength` vs noise-strip-only? (default: noise-strip first, bump only if a fixture still overflows)
- D2: auto-reprocess NoJobs backlog now, or leave manual? (default: manual helper, user runs it)
