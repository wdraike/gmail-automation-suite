/**
 * Job Finder Workflow Test
 * Test functions to verify the complete workflow from email to spreadsheet
 */

/**
 * Test the complete job finder workflow
 * Runs through all steps and reports what's happening
 * @returns {Object} Test results
 */
function testCompleteJobWorkflow() {
  Logger.log("========================================");
  Logger.log("TESTING COMPLETE JOB FINDER WORKFLOW");
  Logger.log("========================================\n");

  const results = {
    step1_emailProcessing: null,
    step2_csvCreation: null,
    step3_csvImport: null,
    spreadsheetUrl: null,
    errors: []
  };

  try {
    // STEP 1: Process job emails to create CSVs
    Logger.log("STEP 1: Processing job emails...");
    Logger.log("---------------------------------------");

    const emailResult = processJobEmailsMain();
    results.step1_emailProcessing = emailResult;

    Logger.log(`✓ Processed ${emailResult.processedCount || 0} emails`);
    Logger.log(`✓ Found ${emailResult.totalJobs || 0} jobs`);

    if (emailResult.totalJobs === 0) {
      Logger.log("⚠ No jobs found in emails. Check:");
      Logger.log("  - Do you have emails with 'JobAlerts' label?");
      Logger.log("  - Are the emails job alert emails?");
      Logger.log("  - Check 'Gemini API Debug Logs' folder in Drive for prompts/responses\n");
    }

    // STEP 2: Check for CSV files
    Logger.log("\nSTEP 2: Checking for CSV files...");
    Logger.log("---------------------------------------");

    const csvFiles = findPendingJobCsvs(10);
    results.step2_csvCreation = {
      csvFilesFound: csvFiles.length,
      files: csvFiles.map(f => f.getName())
    };

    Logger.log(`✓ Found ${csvFiles.length} CSV file(s) to import`);

    if (csvFiles.length > 0) {
      csvFiles.forEach((file, i) => {
        Logger.log(`  ${i + 1}. ${file.getName()} (created: ${file.getDateCreated()})`);
      });
    } else {
      Logger.log("⚠ No CSV files found. This means:");
      Logger.log("  - Either no jobs were extracted from emails");
      Logger.log("  - Or CSV files have already been imported\n");

      // Check processed folder
      const processedFolderId = getOrCreateProcessedCsvFolder();
      const processedFolder = DriveApp.getFolderById(processedFolderId);
      const processedFiles = processedFolder.getFiles();
      let processedCount = 0;
      while (processedFiles.hasNext()) {
        processedFiles.next();
        processedCount++;
      }
      Logger.log(`  - Found ${processedCount} file(s) in 'Processed Job CSVs' folder`);
    }

    // STEP 3: Import CSV files to spreadsheet
    Logger.log("\nSTEP 3: Importing CSV files to spreadsheet...");
    Logger.log("---------------------------------------");

    const importResult = processFewCsvFiles();
    results.step3_csvImport = importResult;

    Logger.log(`✓ Imported ${importResult.importedFiles || 0} file(s)`);
    Logger.log(`✓ Total jobs imported: ${importResult.totalJobsImported || 0}`);

    if (importResult.spreadsheetUrl) {
      results.spreadsheetUrl = importResult.spreadsheetUrl;
      Logger.log(`✓ Spreadsheet URL: ${importResult.spreadsheetUrl}`);
    }

    // STEP 4: Verify spreadsheet has data
    Logger.log("\nSTEP 4: Verifying spreadsheet...");
    Logger.log("---------------------------------------");

    const spreadsheetId = getJobFinderSpreadsheetId();
    if (spreadsheetId) {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      const sheet = spreadsheet.getSheetByName(JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME);

      if (sheet) {
        const lastRow = sheet.getLastRow();
        const jobCount = lastRow - 1; // Subtract header row

        Logger.log(`✓ Spreadsheet exists: "${spreadsheet.getName()}"`);
        Logger.log(`✓ Sheet name: "${sheet.getName()}"`);
        Logger.log(`✓ Total rows: ${lastRow} (including header)`);
        Logger.log(`✓ Job count: ${jobCount}`);
        Logger.log(`✓ Spreadsheet URL: ${spreadsheet.getUrl()}`);

        results.spreadsheetUrl = spreadsheet.getUrl();

        if (jobCount === 0) {
          Logger.log("\n⚠ WARNING: Spreadsheet is empty!");
          Logger.log("This could mean:");
          Logger.log("  - No CSV files were imported yet");
          Logger.log("  - CSV files had no valid job data");
          Logger.log("  - Check the execution logs for errors");
        }
      } else {
        Logger.log(`⚠ Sheet "${JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME}" not found`);
        results.errors.push("Active sheet not found");
      }
    } else {
      Logger.log("⚠ No spreadsheet ID found");
      results.errors.push("No spreadsheet ID");
    }

    // FINAL SUMMARY
    Logger.log("\n========================================");
    Logger.log("WORKFLOW TEST COMPLETE");
    Logger.log("========================================");
    Logger.log(`Emails processed: ${emailResult.processedCount || 0}`);
    Logger.log(`Jobs found: ${emailResult.totalJobs || 0}`);
    Logger.log(`CSV files pending: ${csvFiles.length}`);
    Logger.log(`CSV files imported: ${importResult.importedFiles || 0}`);
    Logger.log(`Jobs in spreadsheet: ${importResult.totalJobsImported || 0}`);

    if (results.spreadsheetUrl) {
      Logger.log(`\n📊 VIEW JOBS: ${results.spreadsheetUrl}`);
    }

    Logger.log("========================================\n");

    return results;

  } catch (error) {
    Logger.log(`\n❌ ERROR in workflow test: ${error}`);
    Logger.log(`Stack trace: ${error.stack}`);
    results.errors.push(error.toString());
    return results;
  }
}

/**
 * Quick test to just show the spreadsheet URL
 */
function showJobSpreadsheet() {
  const spreadsheetId = getJobFinderSpreadsheetId();

  if (!spreadsheetId) {
    Logger.log("No job spreadsheet exists yet. Run processJobEmailsMain() first.");
    return;
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME);
  const jobCount = sheet ? sheet.getLastRow() - 1 : 0;

  Logger.log("========================================");
  Logger.log("JOB SPREADSHEET INFO");
  Logger.log("========================================");
  Logger.log(`Name: ${spreadsheet.getName()}`);
  Logger.log(`Jobs: ${jobCount}`);
  Logger.log(`URL: ${spreadsheet.getUrl()}`);
  Logger.log("========================================");

  return {
    name: spreadsheet.getName(),
    url: spreadsheet.getUrl(),
    jobCount: jobCount,
    spreadsheetId: spreadsheetId
  };
}

/**
 * List all CSV files waiting to be imported
 */
function listPendingCsvFiles() {
  Logger.log("========================================");
  Logger.log("PENDING CSV FILES");
  Logger.log("========================================");

  const csvFiles = findPendingJobCsvs(50);

  if (csvFiles.length === 0) {
    Logger.log("No pending CSV files found.\n");

    // Check processed folder
    const processedFolderId = getOrCreateProcessedCsvFolder();
    const processedFolder = DriveApp.getFolderById(processedFolderId);
    Logger.log(`Processed folder: ${processedFolder.getName()}`);
    Logger.log(`URL: ${processedFolder.getUrl()}`);

    const processedFiles = processedFolder.getFiles();
    let count = 0;
    while (processedFiles.hasNext()) {
      const file = processedFiles.next();
      count++;
      Logger.log(`  ${count}. ${file.getName()} (imported: ${file.getDateCreated()})`);
    }

    if (count === 0) {
      Logger.log("  (No processed files either)");
    }
  } else {
    Logger.log(`Found ${csvFiles.length} pending CSV file(s):\n`);
    csvFiles.forEach((file, i) => {
      Logger.log(`${i + 1}. ${file.getName()}`);
      Logger.log(`   Created: ${file.getDateCreated()}`);
      Logger.log(`   URL: ${file.getUrl()}\n`);
    });
  }

  Logger.log("========================================");

  return {
    pendingCount: csvFiles.length,
    files: csvFiles.map(f => ({
      name: f.getName(),
      created: f.getDateCreated(),
      url: f.getUrl()
    }))
  };
}

// Conditional exports for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    testCompleteJobWorkflow,
    showJobSpreadsheet,
    listPendingCsvFiles
  };
}
