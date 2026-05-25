# Security Review - Gmail Automation (Google Apps Script)

**Review Date:** 2026-05-25
**Scope:** src/core/, src/ui/, src/features/
**Focus:** Injection, XSS, CSRF, improper auth, data leakage, insecure API usage, GAS-specific issues

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3 |
| HIGH | 4 |
| MEDIUM | 5 |
| LOW | 3 |

---

## CRITICAL FINDINGS

### CRIT-1: Email Data and Prompts Logged to Google Drive in Plain Text
**File:** `src/core/api-service.js` (`callGeminiWithRateLimiting`, `saveGeminiInteractionToDrive`)
**Finding:** Every Gemini API interaction is written to a Google Drive folder named "Gemini API Debug Logs" in plain text. The logged content includes full prompts containing email subjects, sender addresses, domains, and (for job finder) entire email bodies. These files are created without restricted permissions and persist indefinitely.
**Impact:** Sensitive email metadata and content is leaked to Drive. If the Drive account is compromised, shared, or subject to compliance audits, this data is exposed.
**Evidence:**
```javascript
// api-service.js:228-241
const folderName = "Gemini API Debug Logs";
const folders = DriveApp.getFoldersByName(folderName);
const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
let fileContent = `=== GEMINI API INTERACTION ===\n`;
fileContent += `PROMPT:\n\n${prompt}\n\n`;
fileContent += `RESPONSE (${response.length} chars):\n\n${response}\n`;
const file = folder.createFile(`gemini_${operationType}_${safeTimestamp}.txt`, fileContent);
```
**Recommendation:** Remove automatic Drive logging of prompts/responses. If debug logging is required, log only response metadata (status code, latency, error flags) and redact all prompt content.

---

### CRIT-2: Stored XSS via Category Keys in Dashboard onclick Attributes
**File:** `src/ui/dashboard-html/dashboard-categories.html` (`renderCategoryTiles`)
**Finding:** Category keys (user-controlled data) are injected directly into HTML onclick attributes via innerHTML without any HTML/JS escaping. A malicious category key containing quotes or HTML tags will break out of the attribute context and execute arbitrary JavaScript.
**Impact:** An attacker who can influence category keys (e.g., via dynamic category creation from email content, or by importing malicious data) can execute scripts in the user's browser, steal the Gmail auth token, or perform actions on behalf of the user.
**Evidence:**
```javascript
// dashboard-categories.html:140-155
header.innerHTML = `
  ...
  <button ... onclick="showAddItemModal('${category.key}')"> ... </button>
  <button ... onclick="editCategory('${category.key}')"> ... </button>
  <button ... onclick="confirmDeleteCategory('${category.key}')"> ... </button>
  ...`;
```
**Recommendation:** Never build HTML with innerHTML using untrusted data. Use document.createElement() and addEventListener() instead. If innerHTML must be used, escape category.key with a proper HTML/attribute escaping function before interpolation.

---

### CRIT-3: Stored XSS via Label Names and Category Keys in Label Tree
**File:** `src/ui/dashboard-html/dashboard-labels.html` (`createCategoryPill`)
**Finding:** Label names and category keys are injected into onclick handlers without escaping. Because Gmail labels can contain special characters and category keys are derived from user input, this creates a stored XSS vector.
**Impact:** Same as CRIT-2. An attacker who can create labels with malicious names or control category keys can execute arbitrary JavaScript in the dashboard context.
**Evidence:**
```javascript
// dashboard-labels.html:52-61
pill.innerHTML = `
  ...
  <button ... onclick="removeCategoryFromLabel('${labelName}', '${categoryKey}')">
  ...`;
```
**Recommendation:** Refactor createCategoryPill to use DOM APIs (document.createElement, addEventListener) instead of innerHTML with interpolated values.

---

## HIGH FINDINGS

### HIGH-1: Prompt Injection via Email Subject and Body Content
**File:** `src/features/email-sorter/sorter.js` (`buildGeminiPrompt`), `src/features/job-finder/extractor.js` (`extractJobDetailsSimple`), `src/ui/dashboard-api.js` (`testEmailCategorization`)
**Finding:** Email subjects, sender addresses, and body text from untrusted third-party senders are directly interpolated into Gemini API prompts without sanitization. An attacker who sends a crafted email can inject prompt instructions, causing the model to ignore its task and execute attacker-controlled instructions.
**Impact:** An attacker can manipulate categorization results, exfiltrate data through the API response, or force the creation of arbitrary categories/labels. In the job finder feature, an email could inject instructions to leak other email content.
**Evidence:**
```javascript
// sorter.js:64
return `TASK: Categorize this email into EXACTLY ONE category from this list: ${categoryList}
EMAIL:
From: ${emailAddress}
Domain: ${domain}
Subject: ${subject}
...`;

// extractor.js:128-155
const prompt = `You are a job listing extraction assistant...
EMAIL CONTENT:
${textToProcess}
JSON ARRAY:`;

// dashboard-api.js:451-453
const prompt = `Analyze this email and suggest appropriate categories...
Email: ${emailText}`;
```
**Recommendation:** Sanitize or escape user-provided text before inserting it into prompts. Use clear delimiter boundaries and instruct the model to treat the enclosed content as data, not instructions. For testEmailCategorization, validate that emailText is not attempting prompt injection.

---

### HIGH-2: Clickjacking via X-Frame-Options ALLOWALL
**File:** `src/ui/dashboard-api.js` (`doGet`)
**Finding:** The dashboard web app explicitly sets HtmlService.XFrameOptionsMode.ALLOWALL, allowing it to be embedded in any third-party iframe. The dashboard contains sensitive Gmail management functions and API key configuration.
**Impact:** An attacker can iframe the dashboard on a malicious site and trick the user into performing unintended actions (clickjacking), such as deleting categories, changing retention rules, or revealing the API key.
**Evidence:**
```javascript
// dashboard-api.js:13-18
function doGet(e) {
  return HtmlService.createTemplateFromFile('ui/dashboard-html/DashboardMain')
    .evaluate()
    .setTitle('Email Tools Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```
**Recommendation:** Remove setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL) and let it default to SAMEORIGIN, or explicitly set it to SAMEORIGIN.

---

### HIGH-3: Unrestricted Web App Access (Missing Authorization)
**File:** `src/ui/dashboard-api.js` (`doGet` and all exposed server functions)
**Finding:** The web app dashboard has no authorization checks. Anyone who obtains the web app URL can load the dashboard and invoke google.script.run endpoints (e.g., updateEmailCategory, executeRetentionRules, saveApplicationSettings, testEmailCategorization).
**Impact:** Unauthorized users can modify Gmail labels/categories, delete retention rules, run retention cleanup (potentially deleting emails), and consume Gemini API quota.
**Evidence:**
```javascript
// dashboard-api.js - doGet has no Session.getActiveUser() check
function doGet(e) { ... }

// No authorization wrapper on any API function
function updateEmailCategory(email, category) { ... }
function executeRetentionRules() { ... }
```
**Recommendation:** Add authorization checks at the top of doGet and every server-side function exposed to the client. Verify Session.getActiveUser().getEmail() matches an allowed list, or at minimum ensure the web app is deployed with "Execute as: Me" and "Who has access: Only myself".

---

### HIGH-4: Arbitrary Text Sent to Gemini via Test Endpoint
**File:** `src/ui/dashboard-api.js` (`testEmailCategorization`)
**Finding:** The testEmailCategorization endpoint accepts arbitrary user-provided text and sends it to the Gemini API using the stored API key. The response is returned in full to the caller. There is no rate limiting, authentication, or input validation beyond a simple empty check.
**Impact:** An attacker can abuse this endpoint to consume API quota, exfiltrate the API key (indirectly via prompt injection), or use the project's API key for unauthorized purposes.
**Evidence:**
```javascript
// dashboard-api.js:441-455
function testEmailCategorization(emailText) {
  const prompt = `Analyze this email and suggest appropriate categories...
Email: ${emailText}`;
  const result = callGeminiApi(prompt, "test_categorization");
  if (result.success) {
    return { success: true, categories: result.categories || [], rawResponse: result.response };
  }
}
```
**Recommendation:** Remove the rawResponse field from the response, add strict rate limiting, and require explicit user confirmation before making test API calls. Consider removing this endpoint entirely if not needed.

---

## MEDIUM FINDINGS

### MED-1: API Key Metadata Leaked in Logs
**File:** `src/core/api-service.js` (`callGemini`)
**Finding:** The API key length is logged to the execution log. While this does not expose the key itself, it leaks metadata that could aid an attacker in key reconstruction or validation.
**Evidence:**
```javascript
// api-service.js:402
Logger.log(`API key length: ${API_KEY.length}`);
```
**Recommendation:** Remove this log line entirely.

---

### MED-2: Gmail Search Query Construction from User-Controlled Label Names
**File:** `src/features/email-retention-manager.js` (`processRetentionRule`)
**Finding:** Retention rules construct Gmail search queries by interpolating rule.labelName directly. If a label name contains special characters (spaces, quotes, operators), the query semantics could be altered.
**Impact:** A label name like "in:sent" could expand the search scope beyond the intended label, causing the wrong emails to be archived or deleted.
**Evidence:**
```javascript
// email-retention-manager.js:469
const query = `label:${rule.labelName} before:${formatDateForQuery(cutoffDate)}`;
```
**Recommendation:** Sanitize or quote labelName when constructing Gmail search queries. Validate label names on creation to reject Gmail search operators and special characters.

---

### MED-3: UrlFetchApp.fetch with muteHttpExceptions Masking Errors
**File:** `src/core/api-service.js` (`callGemini`), `src/core/config.js` (`testGeminiApiKey`)
**Finding:** API calls use muteHttpExceptions: true without comprehensive certificate or response validation. While the code does check response codes, errors like TLS handshake failures or DNS hijacking could be silently suppressed in other contexts.
**Evidence:**
```javascript
// api-service.js:426-431
const options = {
  method: "post",
  contentType: "application/json",
  payload: JSON.stringify(payload),
  headers: headers,
  muteHttpExceptions: true,
};
```
**Recommendation:** Ensure all muteHttpExceptions usage is paired with explicit response code validation. Consider validating the endpoint URL against an allowlist.

---

### MED-4: Unvalidated Settings Stored in Script Properties
**File:** `src/ui/dashboardController.js` (`saveSettings`)
**Finding:** Settings values from the client are stored directly in PropertiesService without type validation, length limits, or sanitization. An attacker could store very large strings, causing property storage exhaustion.
**Evidence:**
```javascript
// dashboardController.js:97-115
scriptProperties.setProperty("CATEGORIZATION_FREQUENCY", settings.categorizationFrequency.toString());
scriptProperties.setProperty("RETENTION_FREQUENCY", settings.retentionFrequency);
scriptProperties.setProperty("CLEANUP_TIME", settings.cleanupTime.toString());
```
**Recommendation:** Add input validation for type, range, and maximum length before persisting settings.

---

### MED-5: Unrestricted Batch Changes Processing
**File:** `src/ui/dashboardController.js` (`processBatchedChanges`)
**Finding:** The processBatchedChanges endpoint accepts an array of change objects and processes them without validating the structure of each change. While individual functions have some validation, the batch entry point does not verify change.type, change.item, or change.targetCategory before dispatching.
**Evidence:**
```javascript
// dashboardController.js:864-921
for (const change of changes) {
  if (change.type === "moveItem") {
    updateCategoryForEmail(item, targetCategory); // item/targetCategory not validated
  } else if (change.type === "moveCategory") {
    removeCategoryFromLabel(sourceLabel, categoryKey);
    addCategoryToLabel(targetLabel, categoryKey);
  }
}
```
**Recommendation:** Add strict schema validation for each change object before processing. Validate that item is a valid email/domain string, targetCategory exists, and sourceLabel/targetLabel are valid Gmail labels.

---

## LOW FINDINGS

### LOW-1: Error Messages Returned to Client May Leak System Information
**File:** Multiple files
**Finding:** Many API functions return error.toString() directly to the client. In GAS, error strings can contain stack traces or internal function names that leak implementation details.
**Recommendation:** Return generic error messages to the client and log detailed errors server-side.

---

### LOW-2: Retention Manager Logs Potentially Sensitive Rule Details
**File:** `src/features/email-retention-manager.js` (`logRetentionActivity`)
**Finding:** Retention activity logs store detailed messages including label names and action details in Script Properties. These logs are not access-controlled.
**Recommendation:** Ensure logs do not contain PII or sensitive email metadata. Implement log rotation and access restrictions if needed.

---

### LOW-3: Potential for Infinite Trigger Creation
**File:** `src/features/email-sorter/sorter.js` (`setupEmailSorterTrigger`), `src/features/job-finder/main.js` (`setupJobFinderTrigger`)
**Finding:** Trigger setup functions delete existing triggers by handler name, then create new ones. If called rapidly or concurrently, they could create duplicate triggers or race conditions.
**Recommendation:** Add a lock mechanism (e.g., Script Properties-based lock) around trigger management operations.

---

## GAS-Specific Security Notes

1. **Script Properties Security:** The Gemini API key is stored in PropertiesService.getScriptProperties(). This is accessible to anyone with editor access to the Apps Script project. Ensure the project sharing settings are restricted.

2. **Web App Deployment:** If the web app is deployed with "Who has access: Anyone," the entire world can invoke doGet and any google.script.run function. Verify deployment settings.

3. **Drive File Permissions:** Files created by DriveApp.createFile() are owned by the script owner. Ensure the script owner's Google Drive is properly secured and 2FA-enabled.

4. **OAuth Scope Exposure:** The project requests broad Gmail and Drive scopes. Review the appsscript.json manifest to ensure only required scopes are requested.

---

## Remediation Priority

1. **Immediate (CRITICAL):** Fix XSS vulnerabilities (CRIT-2, CRIT-3) and stop logging email content to Drive (CRIT-1).
2. **Short-term (HIGH):** Restrict web app access, remove ALLOWALL framing, and sanitize prompt inputs.
3. **Medium-term (MEDIUM):** Add input validation, secure query construction, and improve error handling.
4. **Ongoing (LOW):** Review logging practices, implement access controls, and audit trigger configurations.
