/**
 * Test Drive Logging
 * Simple wrapper to test Gemini API logging to Google Drive
 */

/**
 * Test the Drive logging functionality
 * Creates a test file to verify logging is working
 */
function testDriveLogging() {
  try {
    Logger.log('Starting Drive logging test...');

    // Create or get the debug folder
    const folderName = "Gemini API Debug Logs";
    let folder = null;

    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
      Logger.log(`Found existing folder: ${folder.getUrl()}`);
    } else {
      folder = DriveApp.createFolder(folderName);
      Logger.log(`Created new folder: ${folder.getUrl()}`);
    }

    // Create a test file
    const timestamp = new Date().toISOString();
    const safeTimestamp = timestamp.replace(/:/g, '-').replace(/\./g, '-');
    const fileName = `TEST_gemini_request_${safeTimestamp}.txt`;

    const fileContent = `=== GEMINI API TEST ===
Timestamp: ${timestamp}
Operation Type: test

============================================================

This is a test file to verify Drive logging is working.

If you see this file in your Google Drive folder "Gemini API Debug Logs",
then the logging system is working correctly.

Folder URL: ${folder.getUrl()}
`;

    const blob = Utilities.newBlob(fileContent, 'text/plain', fileName);
    const file = folder.createFile(blob);

    Logger.log(`✅ Test file created successfully!`);
    Logger.log(`File URL: ${file.getUrl()}`);
    Logger.log(`Folder URL: ${folder.getUrl()}`);

    return {
      success: true,
      fileUrl: file.getUrl(),
      folderUrl: folder.getUrl(),
      fileName: fileName
    };

  } catch (error) {
    Logger.log(`❌ Error testing Drive logging: ${error}`);
    Logger.log(`Error stack: ${error.stack}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Test actual Gemini API call with logging
 * This will make a real API call and log it to Drive
 */
function testGeminiWithLogging() {
  try {
    Logger.log('=== STARTING TEST ===');
    Logger.log('[DEBUG] Test 1: Can we log DEBUG messages?');
    Logger.log('INFO: This is a regular log message');
    Logger.log('[DEBUG] Test 2: Another DEBUG message');
    Logger.log('Testing Gemini API call with Drive logging...');

    // Simple test prompt
    const testPrompt = "Categorize this email: 'Meeting reminder for tomorrow at 3pm'";

    Logger.log('[DEBUG] About to call callGeminiWithRateLimiting...');
    // Call Gemini with logging enabled
    const response = callGeminiWithRateLimiting(testPrompt, 'test_logging');
    Logger.log('[DEBUG] Returned from callGeminiWithRateLimiting');

    Logger.log('✅ Gemini call completed');
    Logger.log('Response length: ' + response.length);
    Logger.log('Check your Drive folder "Gemini API Debug Logs" for the files');

    return {
      success: true,
      responseLength: response.length,
      message: 'Check Google Drive folder "Gemini API Debug Logs" for request/response files'
    };

  } catch (error) {
    Logger.log(`❌ Error testing Gemini with logging: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * List all files in the debug folder
 */
function listDebugLogFiles() {
  try {
    const folderName = "Gemini API Debug Logs";
    const folders = DriveApp.getFoldersByName(folderName);

    if (!folders.hasNext()) {
      Logger.log('Debug folder does not exist yet');
      return {
        success: false,
        message: 'Folder does not exist. Run testDriveLogging() first.'
      };
    }

    const folder = folders.next();
    const files = folder.getFiles();
    const fileList = [];

    while (files.hasNext()) {
      const file = files.next();
      fileList.push({
        name: file.getName(),
        url: file.getUrl(),
        created: file.getDateCreated(),
        size: file.getSize()
      });
    }

    Logger.log(`Found ${fileList.length} files in debug folder`);
    fileList.forEach(f => {
      Logger.log(`  - ${f.name} (${f.size} bytes)`);
    });

    return {
      success: true,
      folderUrl: folder.getUrl(),
      fileCount: fileList.length,
      files: fileList
    };

  } catch (error) {
    Logger.log(`Error listing files: ${error}`);
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testDriveLogging,
    testGeminiWithLogging,
    listDebugLogFiles
  };
}
