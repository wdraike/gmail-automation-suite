# Gemini API Debug Logging

## Overview

Every call to the Gemini API now automatically saves the prompt and response to Google Drive for debugging and analysis.

## What Gets Logged

For each Gemini API call, two timestamped files are created:

### Request File
```
gemini_request_2025-10-04T12-30-45-123Z.txt
```

Contains:
- Timestamp
- Operation type (e.g., "job_extraction", "test_categorization")
- Full prompt text sent to Gemini

### Response File
```
gemini_response_2025-10-04T12-30-45-456Z.txt
```

Contains:
- Timestamp
- Operation type
- Response length
- Full response text from Gemini

## Where Files Are Saved

All debug logs are saved to a Google Drive folder:
- **Folder name:** `Gemini API Debug Logs`
- **Location:** Root of your Google Drive
- **Created automatically** on first API call

## How to Access

1. **View in Google Drive:**
   - Navigate to "Gemini API Debug Logs" folder
   - Files are sorted by timestamp (newest first)

2. **View folder URL in logs:**
   - Check execution logs: **View → Executions**
   - Look for: `Created debug folder: [URL]`

3. **Download files:**
   - Right-click any file → Download
   - Open in text editor for analysis

## File Format

### Request File Example:
```
=== Gemini API REQUEST ===
Timestamp: 2025-10-04T12:30:45.123Z
Operation Type: job_extraction

============================================================

PROMPT:

Extract job listings from the following email content...
[Full prompt text here]
```

### Response File Example:
```
=== Gemini API RESPONSE ===
Timestamp: 2025-10-04T12:30:45.456Z
Operation Type: job_extraction
RESPONSE LENGTH: 1234

============================================================

FULL RESPONSE:

[Full JSON or text response from Gemini]
```

## Use Cases

1. **Debugging prompts** - See exactly what was sent to Gemini
2. **Analyzing responses** - Inspect raw responses before parsing
3. **Improving prompts** - Compare different prompts and results
4. **Troubleshooting errors** - Check what caused parsing failures
5. **Rate limit analysis** - Review timing of API calls

## Implementation Details

The logging is automatic and happens in [src/core/api-service.js](../src/core/api-service.js):

- `logGeminiInteraction()` - Main logging function
- `saveGeminiInteractionToDrive()` - Saves to Drive
- Called automatically by `callGeminiApi()`

## Performance Impact

- **Minimal** - File creation is async and doesn't block API calls
- **Storage** - Each file ~1-10KB depending on prompt/response size
- **Quota** - Uses Google Drive storage quota

## Disable Logging (if needed)

To disable Drive logging, comment out this line in `api-service.js`:

```javascript
// Comment this out to disable Drive logging:
if (type === "request" || type === "response") {
  saveGeminiInteractionToDrive(type, content, timestamp);
}
```

## Cleanup

Files accumulate over time. To clean up:

1. Sort by date in Drive folder
2. Delete old files you no longer need
3. Or delete entire folder (will be recreated on next call)

## Example Workflow

1. Run email categorization
2. Check Drive folder for new files
3. Open request file to see prompt
4. Open response file to see Gemini's answer
5. Compare multiple requests to improve prompts
