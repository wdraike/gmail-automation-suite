/**
 * SIMPLE Drive Write Test - No dependencies, no complexity
 */
function SIMPLE_DRIVE_TEST() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const folderName = "Gemini API Debug Logs";

  // Get or create folder
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  // Create file
  const fileName = `SIMPLE_TEST_${timestamp}.txt`;
  const content = `This is a simple test file created at ${new Date().toISOString()}`;
  const file = folder.createFile(fileName, content);

  Logger.log('SUCCESS: File created at ' + file.getUrl());
  return file.getUrl();
}

/**
 * Test that logs the Gemini call DIRECTLY without logGeminiInteraction
 */
function DIRECT_GEMINI_TEST() {
  const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\./g, '-');
  const folderName = "Gemini API Debug Logs";

  Logger.log('Step 1: Getting folder');
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  Logger.log('Step 2: Got folder');

  const prompt = "Categorize this email: 'Meeting at 3pm'";
  Logger.log('Step 3: Calling Gemini API directly');

  const response = callGemini(prompt); // Direct call, bypass all logging

  Logger.log('Step 4: Got response, length: ' + response.length);

  // Write request file
  const requestFile = folder.createFile(`request_${timestamp}.txt`, 'PROMPT:\n\n' + prompt);
  Logger.log('Step 5: Created request file: ' + requestFile.getUrl());

  // Write response file
  const responseFile = folder.createFile(`response_${timestamp}.txt`, 'RESPONSE:\n\n' + response);
  Logger.log('Step 6: Created response file: ' + responseFile.getUrl());

  return {
    requestUrl: requestFile.getUrl(),
    responseUrl: responseFile.getUrl()
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SIMPLE_DRIVE_TEST,
    DIRECT_GEMINI_TEST
  };
}
