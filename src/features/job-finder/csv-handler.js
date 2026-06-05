/**
 * Job Finder CSV Module
 * Handles CSV import/export operations for job listings
 */

/**
 * Import pending job CSV files using batch processing
 * @param {number} maxFiles - Maximum number of files to process
 * @returns {Object} Import results
 */
function importPendingJobCsvs(maxFiles = 5) {
  try {
    const startTime = new Date().getTime();
    Logger.log("Starting CSV import with batch processing (oldest files first)...");
    
    // Find pending CSV files
    const pendingFiles = findPendingJobCsvs(maxFiles);
    
    if (pendingFiles.length === 0) {
      Logger.log("No pending CSV files found to import");
      return {
        status: "info",
        message: "No pending CSV files found",
        totalFiles: 0,
      };
    }
    
    Logger.log(`Found ${pendingFiles.length} pending CSV files to import`);
    
    // Get or create the processed folder
    const processedFolderId = getOrCreateProcessedCsvFolder();
    const processedFolder = DriveApp.getFolderById(processedFolderId);
    
    // Make sure spreadsheet exists
    const spreadsheetId = getJobFinderSpreadsheetId();
    if (!spreadsheetId) {
      const initResult = initializeJobFinder();
      if (!initResult.success) {
        return {
          status: "error",
          message: initResult.message,
          totalFiles: pendingFiles.length,
          importedFiles: 0,
        };
      }
    }
    
    const results = {
      totalFiles: pendingFiles.length,
      importedFiles: 0,
      failedFiles: 0,
      totalJobsImported: 0,
      errors: [],
      fileResults: [],
    };
    
    // Process each CSV file
    for (let i = 0; i < pendingFiles.length; i++) {
      const file = pendingFiles[i];
      const fileName = file.getName();
      
      Logger.log(`Processing file ${i + 1}/${pendingFiles.length}: ${fileName}`);
      
      try {
        // Import the CSV
        const importResult = importCsvToSpreadsheet(file.getId());
        
        if (importResult.success) {
          // Move to processed folder
          const moved = moveFileSafely(file, processedFolder);
          
          results.importedFiles++;
          results.totalJobsImported += importResult.jobsImported || 0;
          results.fileResults.push({
            fileName: fileName,
            fileId: file.getId(),
            status: "success",
            jobsImported: importResult.jobsImported || 0,
            moved: moved,
          });
          
          Logger.log(`Successfully imported ${importResult.jobsImported || 0} jobs from ${fileName}`);
        } else {
          results.failedFiles++;
          results.errors.push(`${fileName}: ${importResult.message}`);
          results.fileResults.push({
            fileName: fileName,
            fileId: file.getId(),
            status: "failed",
            error: importResult.message,
          });
          
          // Send notification for file import errors
          sendNotificationEmail({
            isError: true,
            errorMessage: `Error importing CSV file ${fileName}: ${importResult.message}`,
            jobCount: 0,
            jobs: []
          });
        }
      } catch (fileError) {
        Logger.log(`Error processing file ${fileName}: ${fileError}`);
        results.failedFiles++;
        results.errors.push(`${fileName}: ${fileError.toString()}`);
        results.fileResults.push({
          fileName: fileName,
          fileId: file.getId(),
          status: "failed",
          error: fileError.toString(),
        });
        
        // Send notification for file processing errors
        sendNotificationEmail({
          isError: true,
          errorMessage: `Error processing CSV file ${fileName}: ${fileError.toString()}`,
          jobCount: 0,
          jobs: []
        });
      }
    }
    
    // Calculate elapsed time
    const endTime = new Date().getTime();
    const elapsedSeconds = (endTime - startTime) / 1000;
    
    // Summary
    const summary = `Processed ${results.totalFiles} CSV files in ${elapsedSeconds.toFixed(1)}s. ` +
                   `Imported: ${results.importedFiles}, Failed: ${results.failedFiles}, ` +
                   `Total jobs: ${results.totalJobsImported}`;
    
    Logger.log(summary);
    
    return {
      status: results.failedFiles === 0 ? "success" : "warning",
      message: summary,
      ...results,
    };
    
  } catch (error) {
    Logger.log(`Error in importPendingJobCsvs: ${error}`);
    
    // Send error notification
    sendNotificationEmail({
      isError: true,
      errorMessage: `Error importing CSV files: ${error.toString()}`,
      jobCount: 0,
      jobs: []
    });
    
    return {
      status: "error",
      message: `Error importing CSV files: ${error.toString()}`,
      totalFiles: 0,
      importedFiles: 0,
    };
  }
}

/**
 * Find pending CSV files to import
 * @param {number} maxFiles - Maximum files to return
 * @returns {Array} Array of File objects
 */
function findPendingJobCsvs(maxFiles = 10) {
  try {
    const pendingFiles = [];
    
    // Search for CSV files containing "job" in the name
    const searchQuery = 'mimeType="text/csv" and (title contains "job" or title contains "Job")';
    const files = DriveApp.searchFiles(searchQuery);
    
    // Get processed folder ID to exclude processed files
    let processedFolderId;
    try {
      processedFolderId = getOrCreateProcessedCsvFolder();
    } catch (e) {
      Logger.log(`Warning: Could not get processed folder: ${e}`);
    }
    
    while (files.hasNext() && pendingFiles.length < maxFiles) {
      const file = files.next();
      
      // Skip if in processed folder
      if (processedFolderId) {
        const parents = file.getParents();
        let isInProcessedFolder = false;
        
        while (parents.hasNext()) {
          const parent = parents.next();
          if (parent.getId() === processedFolderId) {
            isInProcessedFolder = true;
            break;
          }
        }
        
        if (isInProcessedFolder) {
          continue;
        }
      }
      
      // Add file with metadata
      pendingFiles.push({
        file: file,
        getName: () => file.getName(),
        getId: () => file.getId(),
        getDateCreated: () => file.getDateCreated(),
      });
    }
    
    // Sort by creation date (oldest first)
    pendingFiles.sort((a, b) => a.getDateCreated() - b.getDateCreated());
    
    // Return file objects
    return pendingFiles.map(item => item.file);
    
  } catch (error) {
    Logger.log(`Error finding pending CSV files: ${error}`);
    return [];
  }
}

/**
 * Import a CSV file to the spreadsheet
 * @param {string} csvFileId - ID of the CSV file
 * @param {boolean} testMode - If true, only process first 10 rows
 * @returns {Object} Import result
 */
function importCsvToSpreadsheet(csvFileId, testMode = false) {
  try {
    // Get the CSV file
    const csvFile = DriveApp.getFileById(csvFileId);
    const csvContent = csvFile.getBlob().getDataAsString();

    // Log first 500 chars of CSV for debugging
    Logger.log(`CSV content preview: ${csvContent.substring(0, 500)}`);

    // Parse CSV
    const rows = Utilities.parseCsv(csvContent);
    if (rows.length === 0) {
      return {
        success: false,
        message: "CSV file is empty",
      };
    }
    
    // Get headers from first row
    const csvHeaders = rows[0];
    const dataRows = testMode ? rows.slice(1, 11) : rows.slice(1);

    Logger.log(`CSV has ${csvHeaders.length} columns and ${dataRows.length} data rows`);
    Logger.log(`Headers: ${csvHeaders.join(" | ")}`);
    if (dataRows.length > 0) {
      Logger.log(`First row has ${dataRows[0].length} values`);
      Logger.log(`Sample: Company="${dataRows[0][0]}", Title="${dataRows[0][2]}", Jobs="${dataRows[0][16]}"`);
    }

    // Validate CSV format - must have required columns
    const requiredColumns = ["Company", "Job Title", "Email Received Date", "Email Source"];
    const missingColumns = requiredColumns.filter(col => !csvHeaders.includes(col));

    if (missingColumns.length > 0) {
      Logger.log(`Skipping incompatible CSV file ${csvFile.getName()}: missing columns ${missingColumns.join(", ")}`);
      return {
        success: false,
        message: `Incompatible CSV format - missing columns: ${missingColumns.join(", ")}. This appears to be an old format CSV.`,
      };
    }

    // Map CSV columns to job object fields
    const columnMap = createCsvColumnMap(csvHeaders);
    
    // Process each row
    let importedCount = 0;
    let skippedCount = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      try {
        // Create job object from CSV row
        const job = createJobFromCsvRow(row, columnMap);
        
        if (isValidJobListing(job)) {
          // Add to spreadsheet - use job object values
          const added = addJobToSpreadsheet(
            job,
            job["Email Received Date"] ? new Date(job["Email Received Date"]) : new Date(),
            job["Email Source"] || "",
            job["Email Title"] || "",
            parseInt(job["Jobs Found In Email"]) || 1
          );
          
          if (added) {
            importedCount++;
          } else {
            skippedCount++;
          }
        } else {
          skippedCount++;
        }
      } catch (rowError) {
        Logger.log(`Error processing row ${i + 2}: ${rowError}`);
        skippedCount++;
      }
      
      // Brief pause every 100 rows
      if (i > 0 && i % 100 === 0) {
        Utilities.sleep(100);
      }
    }
    
    Logger.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped`);
    
    return {
      success: true,
      message: `Imported ${importedCount} jobs from ${csvFile.getName()}`,
      jobsImported: importedCount,
      jobsSkipped: skippedCount,
    };
    
  } catch (error) {
    Logger.log(`Error importing CSV: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Create a column mapping from CSV headers
 * @param {Array} headers - CSV header row
 * @returns {Object} Column index mapping
 */
function createCsvColumnMap(headers) {
  const map = {};

  // Common CSV column name variations
  const columnMappings = {
    company: ["company", "company name", "employer", "organization"],
    description: ["company description", "description", "job description", "details"],
    jobTitle: ["job title", "title", "position", "role", "job"],
    location: ["location", "city", "place", "where"],
    minSalary: ["minimum salary", "min salary", "salary min", "salary from"],
    maxSalary: ["maximum salary", "max salary", "salary max", "salary to"],
    salaryPeriod: ["salary period", "pay period", "salary type"],
    jobUrl: ["job url", "url", "link", "job link", "apply link"],
    urlStatus: ["url status"],
    emailReceivedDate: ["email received date", "received date", "email date"],
    emailSource: ["email source", "source", "from"],
    dateAdded: ["date added", "added date", "created date"],
    interest: ["interest", "priority", "rating"],
    emailTitle: ["email title", "subject", "email subject"],
    jobsFoundInEmail: ["jobs found in email", "job count", "jobs count"]
  };

  headers.forEach((header, index) => {
    const normalized = header.toLowerCase().trim();

    for (const [field, variations] of Object.entries(columnMappings)) {
      // Use exact match only - no substring matching
      if (variations.some(v => normalized === v)) {
        map[field] = index;
        break;
      }
    }
  });

  return map;
}

/**
 * Create a job object from a CSV row
 * @param {Array} row - CSV data row
 * @param {Object} columnMap - Column index mapping
 * @returns {Object} Job object with all spreadsheet columns
 */
function createJobFromCsvRow(row, columnMap) {
  const getValue = (field) => {
    const index = columnMap[field];
    return index !== undefined && row[index] ? row[index].trim() : "";
  };

  return {
    "Company": getValue("company") || "Unknown",
    "Company Description": getValue("description") || "",
    "Job Title": getValue("jobTitle") || "Unknown Position",
    "Location": getValue("location") || "Not specified",
    "Minimum Salary": cleanSalaryValue(getValue("minSalary")),
    "Maximum Salary": cleanSalaryValue(getValue("maxSalary")),
    "Salary Period": getValue("salaryPeriod") || "",
    "Job URL": getValue("jobUrl") || "",
    "URL Status": getValue("urlStatus") || (getValue("jobUrl") ? "Found" : "Not found"),
    "Email Received Date": getValue("emailReceivedDate") || "",
    "Email Source": getValue("emailSource") || "",
    "Date Added": getValue("dateAdded") || "",
    "Interest": getValue("interest") || "",
    "Email Title": getValue("emailTitle") || "",
    "Jobs Found In Email": getValue("jobsFoundInEmail") || ""
  };
}

/**
 * Export jobs to CSV format
 * @param {Array} jobs - Array of job objects
 * @returns {string} CSV content
 */
function convertJobsToCsv(jobs) {
  if (!jobs || jobs.length === 0) {
    return "";
  }

  // Define CSV columns. Careers URL / Careers URL Status were removed to match
  // the 18-column sheet shape (JOB_FINDER_CONFIG.SHEET_COLUMNS). Note: the CSV
  // shape still omits Employment Type / Work Arrangement / Experience Level,
  // which the sheet carries — that is a separate pre-existing divergence.
  const columns = [
    "Company",
    "Company Description",
    "Job Title",
    "Location",
    "Minimum Salary",
    "Maximum Salary",
    "Salary Period",
    "Job URL",
    "URL Status",
    "Email Received Date",
    "Email Source",
    "Date Added",
    "Interest",
    "Email Title",
    "Jobs Found In Email"
  ];

  // Create header row
  const csvRows = [columns.join(",")];

  // Add data rows
  jobs.forEach(job => {
    const row = columns.map(col => {
      const value = job[col] || "";
      return sanitizeCsvValue(value);
    });
    csvRows.push(row.join(","));
  });

  return csvRows.join("\n");
}

/**
 * Sanitize a value for CSV export
 * @param {*} value - Value to sanitize
 * @returns {string} Sanitized value
 */
function sanitizeCsvValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  
  const stringValue = value.toString();
  
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

/**
 * Write jobs to a CSV file in Drive
 * @param {Array} jobs - Jobs to write
 * @returns {Object} Result with file ID
 */
function writeJobsToCsv(jobs) {
  try {
    const csvContent = convertJobsToCsv(jobs);
    
    if (!csvContent) {
      return {
        success: false,
        message: "No jobs to export",
      };
    }
    
    // Create filename with timestamp
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
    const filename = `job_listings_${timestamp}.csv`;
    
    // Create the file
    const blob = Utilities.newBlob(csvContent, "text/csv", filename);
    const file = DriveApp.createFile(blob);
    
    // Move to exports folder if configured
    try {
      const exportsFolderId = PropertiesService.getScriptProperties().getProperty("JOB_EXPORTS_FOLDER_ID");
      if (exportsFolderId) {
        const exportsFolder = DriveApp.getFolderById(exportsFolderId);
        exportsFolder.addFile(file);
        DriveApp.getRootFolder().removeFile(file);
      }
    } catch (folderError) {
      Logger.log(`Could not move to exports folder: ${folderError}`);
    }
    
    return {
      success: true,
      message: `Exported ${jobs.length} jobs to ${filename}`,
      fileId: file.getId(),
      fileName: filename,
      fileUrl: file.getUrl(),
    };
    
  } catch (error) {
    Logger.log(`Error writing jobs to CSV: ${error}`);
    return {
      success: false,
      message: error.toString(),
    };
  }
}

/**
 * Get or create the processed CSV folder
 * @returns {string} Folder ID
 */
function getOrCreateProcessedCsvFolder() {
  const folderName = "Processed Job CSVs";
  
  // Check if folder ID is stored
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty("PROCESSED_CSV_FOLDER_ID");
  
  if (folderId) {
    try {
      // Verify folder still exists
      const folder = DriveApp.getFolderById(folderId);
      return folderId;
    } catch (e) {
      // Folder no longer exists
      Logger.log("Processed CSV folder no longer exists, creating new one");
    }
  }
  
  // Create new folder
  const folders = DriveApp.getFoldersByName(folderName);
  let folder;
  
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(folderName);
  }
  
  folderId = folder.getId();
  props.setProperty("PROCESSED_CSV_FOLDER_ID", folderId);
  
  return folderId;
}

/**
 * Safely move a file to a folder
 * @param {File} file - File to move
 * @param {Folder} targetFolder - Target folder
 * @returns {boolean} Success status
 */
function moveFileSafely(file, targetFolder) {
  try {
    // Add to target folder
    targetFolder.addFile(file);
    
    // Remove from all parent folders
    const parents = file.getParents();
    while (parents.hasNext()) {
      const parent = parents.next();
      if (parent.getId() !== targetFolder.getId()) {
        parent.removeFile(file);
      }
    }
    
    return true;
  } catch (error) {
    Logger.log(`Error moving file: ${error}`);
    return false;
  }
}

/**
 * Schedule batch CSV processing
 * @returns {Object} Scheduling result
 */
function scheduleBatchProcessing() {
  try {
    // Check for pending files
    const pendingFiles = findPendingJobCsvs(1);
    
    if (pendingFiles.length === 0) {
      return {
        scheduled: false,
        message: "No pending CSV files to process",
      };
    }
    
    // Schedule processing in 1 minute
    const trigger = ScriptApp.newTrigger("processFewCsvFiles")
      .timeBased()
      .after(60 * 1000) // 1 minute
      .create();
    
    return {
      scheduled: true,
      message: `Scheduled processing of ${pendingFiles.length} CSV files`,
      triggerId: trigger.getUniqueId(),
    };
    
  } catch (error) {
    Logger.log(`Error scheduling batch processing: ${error}`);
    return {
      scheduled: false,
      message: error.toString(),
    };
  }
}

/**
 * Process a small batch of CSV files (for triggered execution)
 * @returns {Object} Processing results with spreadsheet URL
 */
function processFewCsvFiles() {
  const result = importPendingJobCsvs(3); // Process only 3 files at a time

  // Get the spreadsheet URL to show user where jobs are
  const spreadsheetId = getJobFinderSpreadsheetId();
  if (spreadsheetId) {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const spreadsheetUrl = spreadsheet.getUrl();

    Logger.log(`===== CSV IMPORT COMPLETE =====`);
    Logger.log(`Imported: ${result.importedFiles || 0} files`);
    Logger.log(`Total jobs: ${result.totalJobsImported || 0}`);
    Logger.log(`View jobs in spreadsheet: ${spreadsheetUrl}`);
    Logger.log(`================================`);

    return {
      ...result,
      spreadsheetUrl: spreadsheetUrl,
      spreadsheetId: spreadsheetId
    };
  }

  return result;
}

/**
 * Set up a trigger to import CSV files periodically
 * @returns {string} Success message
 */
function setupCsvImportTrigger() {
  try {
    // Remove existing CSV import triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === "importPendingJobCsvs" ||
          trigger.getHandlerFunction() === "processFewCsvFiles") {
        ScriptApp.deleteTrigger(trigger);
      }
    }
    
    // Create new daily trigger
    ScriptApp.newTrigger("processFewCsvFiles")
      .timeBased()
      .everyDays(1)
      .atHour(2) // Run at 2 AM
      .create();
    
    const message = "CSV import trigger set up to run daily at 2 AM";
    Logger.log(message);
    return message;
    
  } catch (error) {
    Logger.log(`Error setting up CSV import trigger: ${error}`);
    return `Error: ${error.toString()}`;
  }
}

/**
 * Send notification email about job processing
 * @param {Object} options - Notification options
 * @param {boolean} options.isError - Whether this is an error notification
 * @param {string} options.errorMessage - Error message (required if isError is true)
 * @param {number} options.jobCount - Number of jobs found (optional)
 * @param {Array} options.jobs - Array of job objects (optional)
 */
function sendNotificationEmail(options) {
  try {
    // Default to success notification for backward compatibility
    const isError = options.isError === true;
    const jobCount = options.jobCount || 0;
    const jobs = options.jobs || [];
    const errorMessage = options.errorMessage || "Unknown error";
    
    // Skip notification for successful processing (new behavior)
    if (!isError) {
      Logger.log(`Processing completed successfully with ${jobCount} jobs found. No notification sent (success notifications disabled).`);
      return;
    }
    
    const userEmail = JOB_FINDER_CONFIG.NOTIFICATION_EMAIL || Session.getActiveUser().getEmail();
    
    if (!userEmail) {
      Logger.log("No email address available for notifications");
      return;
    }
    
    // Create subject line based on notification type
    const subject = isError 
      ? `[Job Finder] Error processing jobs: ${errorMessage.substring(0, 50)}` 
      : `[Job Finder] ${jobCount} new job opportunities found`;
    
    // Create email body
    let body = '';
    
    if (isError) {
      body = `Hello,\n\nThere was an error processing job emails:\n\n${errorMessage}\n\n`;
      
      // Add info about any jobs that were processed before the error
      if (jobCount > 0) {
        body += `Before the error occurred, ${jobCount} jobs were successfully processed.\n\n`;
      }
    } else {
      // This section is kept for backward compatibility but won't be used with new logic
      body = `Hello,\n\nYour job finder has discovered ${jobCount} new job opportunities:\n\n`;
      
      // Add job summaries (limit to first 10)
      const jobsToShow = jobs.slice(0, 10);
      jobsToShow.forEach((job, index) => {
        body += `${index + 1}. ${job["Company"] || "Unknown Company"} - ${job["Job Title"] || "Unknown Position"}\n`;
        body += `   Location: ${job["Location"] || "Not specified"}\n`;
        
        if (job["Minimum Salary"] || job["Maximum Salary"]) {
          body += `   Salary: $${job["Minimum Salary"] || "?"} - $${job["Maximum Salary"] || "?"} ${job["Salary Period"] || ""}\n`;
        }
        
        if (job["Job URL"]) {
          body += `   Apply: ${job["Job URL"]}\n`;
        }
        
        body += "\n";
      });
      
      if (jobs.length > 10) {
        body += `... and ${jobs.length - 10} more jobs.\n\n`;
      }
    }
    
    // Add link to spreadsheet
    const spreadsheetId = getJobFinderSpreadsheetId();
    if (spreadsheetId) {
      const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
      body += `View all jobs in your spreadsheet:\n${spreadsheet.getUrl()}\n\n`;
    }
    
    body += isError 
      ? "Please check the system logs for more information.\n\n" 
      : "Happy job hunting!\n\n";
    
    body += "This is an automated notification from your Job Finder script.";
    
    // Send email
    GmailApp.sendEmail(userEmail, subject, body);
    Logger.log(`Notification email sent to ${userEmail}`);
    
  } catch (error) {
    Logger.log(`Error sending notification email: ${error}`);
  }
}

/**
 * DEBUG: Test CSV import with a specific file
 */
function debugCsvImport() {
  // Use one of the recent CSV files that should have Capital One data
  const fileName = "job_listings_20251004_102231.csv";

  Logger.log(`=== DEBUGGING CSV IMPORT: ${fileName} ===\n`);

  // Find the file
  const files = DriveApp.searchFiles(`title = "${fileName}"`);

  if (!files.hasNext()) {
    Logger.log(`ERROR: File not found: ${fileName}`);
    return;
  }

  const file = files.next();
  Logger.log(`Found file: ${file.getName()}`);
  Logger.log(`File ID: ${file.getId()}\n`);

  // Read the CSV content
  const csvContent = file.getBlob().getDataAsString();
  Logger.log(`CSV content length: ${csvContent.length} characters\n`);

  // Show first 3 lines of raw CSV
  const lines = csvContent.split('\n');
  Logger.log('=== RAW CSV CONTENT (first 3 lines) ===');
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    Logger.log(`Line ${i}: ${lines[i]}`);
  }
  Logger.log('');

  // Parse with Utilities.parseCsv()
  Logger.log('=== PARSING WITH Utilities.parseCsv() ===');
  const rows = Utilities.parseCsv(csvContent);
  Logger.log(`Parsed ${rows.length} rows\n`);

  // Check header
  Logger.log('=== HEADER ROW ===');
  Logger.log(`Header has ${rows[0].length} columns`);
  Logger.log(`Headers: ${rows[0].join(' | ')}\n`);

  // Check first data row
  if (rows.length > 1) {
    Logger.log('=== FIRST DATA ROW ===');
    Logger.log(`Data row has ${rows[1].length} values\n`);

    Logger.log('All values in first data row:');
    for (let i = 0; i < rows[1].length; i++) {
      Logger.log(`  [${i}] ${rows[0][i]}: "${rows[1][i]}"`);
    }
    Logger.log('');

    // Expected mapping
    Logger.log('=== EXPECTED vs ACTUAL ===');
    Logger.log(`Expected 17 columns, got ${rows[1].length} columns`);
    Logger.log(`Company (should be "Capital One"): "${rows[1][0]}"`);
    Logger.log(`Company Description (should be empty): "${rows[1][1]}"`);
    Logger.log(`Job Title (should be "Director, Technical Program Manager..."): "${rows[1][2]}"`);
    Logger.log(`Location (should be "Richmond, VA"): "${rows[1][3]}"`);
    Logger.log(`Email Title (col 15, should have text): "${rows[1][15] || 'UNDEFINED'}"`);
    Logger.log(`Jobs Found (col 16, should be "6"): "${rows[1][16] || 'UNDEFINED'}"`);
    Logger.log('');
  }

  // Now test the mapping function
  Logger.log('=== TESTING COLUMN MAPPING ===');
  const columnMap = createCsvColumnMap(rows[0]);
  Logger.log('Column map:');
  for (const [field, index] of Object.entries(columnMap)) {
    Logger.log(`  ${field} -> column ${index}`);
  }
  Logger.log('');

  // Test job object creation
  if (rows.length > 1) {
    Logger.log('=== TESTING JOB OBJECT CREATION ===');
    const job = createJobFromCsvRow(rows[1], columnMap);
    Logger.log('Created job object:');
    Logger.log(`  Company: "${job["Company"]}"`);
    Logger.log(`  Company Description: "${job["Company Description"]}"`);
    Logger.log(`  Job Title: "${job["Job Title"]}"`);
    Logger.log(`  Location: "${job["Location"]}"`);
    Logger.log(`  Email Received Date: "${job["Email Received Date"]}"`);
    Logger.log(`  Email Source: "${job["Email Source"]}"`);
    Logger.log(`  Email Title: "${job["Email Title"]}"`);
    Logger.log(`  Jobs Found In Email: "${job["Jobs Found In Email"]}"`);
  }
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    importPendingJobCsvs,
    findPendingJobCsvs,
    importCsvToSpreadsheet,
    createCsvColumnMap,
    createJobFromCsvRow,
    convertJobsToCsv,
    sanitizeCsvValue,
    writeJobsToCsv,
    getOrCreateProcessedCsvFolder,
    moveFileSafely,
    scheduleBatchProcessing,
    processFewCsvFiles,
    setupCsvImportTrigger,
    sendNotificationEmail,
    debugCsvImport
  };
}
