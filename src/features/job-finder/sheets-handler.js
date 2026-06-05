/**
 * Job Finder Sheets Module
 * Handles all spreadsheet operations for job listings
 */

/**
 * Add a job to the spreadsheet
 * @param {Object} job - Job object with all details
 * @param {boolean} isDuplicate - Whether this is a duplicate
 * @param {Date} emailDate - Date the email was received
 * @param {string} emailSource - Source of the email
 * @param {string} emailTitle - Email subject line
 * @param {number} jobsInEmail - Total jobs found in the email
 * @returns {boolean} Success status
 */
function addJobToSpreadsheet(job, isDuplicate = false, emailDate = null, emailSource = '', emailTitle = '', jobsInEmail = 1) {
  try {
    // Get the spreadsheet
    const spreadsheetId = getJobFinderSpreadsheetId();
    if (!spreadsheetId) {
      Logger.log("No spreadsheet ID found");
      return false;
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheetName = isDuplicate ? JOB_FINDER_CONFIG.BACKUP_SHEET_NAME : JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME;
    
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      // Create the sheet if it doesn't exist
      sheet = spreadsheet.insertSheet(sheetName);
      setupSheetHeaders(sheet);
    }
    
    // Build the row data according to the column configuration
    const rowData = JOB_FINDER_CONFIG.SHEET_COLUMNS.map(column => {
      // Use job object properties directly, with fallback to function parameters
      switch (column) {
        case "Company":
          return job["Company"] || "";
        case "Company Description":
          return job["Company Description"] || "";
        case "Job Title":
          return job["Job Title"] || "";
        case "Employment Type":
          return job["Employment Type"] || "Unknown";
        case "Work Arrangement":
          return job["Work Arrangement"] || "Unknown";
        case "Experience Level":
          return job["Experience Level"] || "Unknown";
        case "Location":
          return job["Location"] || "";
        case "Minimum Salary":
          return job["Minimum Salary"] || "";
        case "Maximum Salary":
          return job["Maximum Salary"] || "";
        case "Salary Period":
          return job["Salary Period"] || "";
        case "Job URL":
          return job["Job URL"] || "";
        case "URL Status":
          return job["URL Status"] || "";
        case "Careers URL":
          return job["Careers URL"] || "";
        case "Careers URL Status":
          return job["Careers URL Status"] || "";
        case "Email Received Date":
          return job["Email Received Date"] || (emailDate ? formatDateTime(emailDate) : "");
        case "Email Source":
          return job["Email Source"] || emailSource || "";
        case "Date Added":
          return job["Date Added"] || formatDateTime(new Date());
        case "Interest":
          return job["Interest"] || "";
        case "Email Title":
          return job["Email Title"] || emailTitle || "";
        case "Jobs Found In Email":
          return job["Jobs Found In Email"] || jobsInEmail || "";
        default:
          return "";
      }
    });
    
    // Append the row
    sheet.appendRow(rowData);
    
    // Format the new row
    const lastRow = sheet.getLastRow();
    const range = sheet.getRange(lastRow, 1, 1, rowData.length);
    
    // Apply formatting
    formatJobRow(sheet, lastRow);
    
    return true;
    
  } catch (error) {
    Logger.log(`Error adding job to spreadsheet: ${error}`);
    return false;
  }
}

/**
 * Set up headers for a sheet
 * @param {Sheet} sheet - The sheet to set up
 */
function setupSheetHeaders(sheet) {
  try {
    // Use column configuration directly
    const headers = JOB_FINDER_CONFIG.SHEET_COLUMNS;

    // Set headers
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4285f4");
    headerRange.setFontColor("#ffffff");
    
    // Freeze header row
    sheet.setFrozenRows(1);
    
    // Set column widths
    setColumnWidths(sheet, headers);
    
  } catch (error) {
    Logger.log(`Error setting up sheet headers: ${error}`);
  }
}

/**
 * Set appropriate column widths
 * @param {Sheet} sheet - The sheet
 * @param {Array} headers - Array of header names
 */
function setColumnWidths(sheet, headers) {
  const columnWidths = {
    "Company": 150,
    "Company Description": 200,
    "Job Title": 200,
    "Employment Type": 100,
    "Work Arrangement": 100,
    "Experience Level": 100,
    "Location": 150,
    "Minimum Salary": 100,
    "Maximum Salary": 100,
    "Salary Period": 80,
    "Job URL": 200,
    "URL Status": 80,
    "Careers URL": 200,
    "Careers URL Status": 80,
    "Email Received Date": 120,
    "Email Source": 100,
    "Date Added": 120,
    "Interest": 80,
    "Email Title": 250,
    "Jobs Found In Email": 100
  };
  
  headers.forEach((header, index) => {
    const width = columnWidths[header] || 100;
    sheet.setColumnWidth(index + 1, width);
  });
}

/**
 * Format a job row
 * @param {Sheet} sheet - The sheet
 * @param {number} row - Row number
 */
function formatJobRow(sheet, row) {
  try {
    const lastColumn = sheet.getLastColumn();
    const range = sheet.getRange(row, 1, 1, lastColumn);
    
    // Alternate row colors
    if (row % 2 === 0) {
      range.setBackground("#f8f9fa");
    }
    
    // Format salary columns
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const minSalaryCol = headers.indexOf("Minimum Salary") + 1;
    const maxSalaryCol = headers.indexOf("Maximum Salary") + 1;
    
    if (minSalaryCol > 0) {
      const minSalaryCell = sheet.getRange(row, minSalaryCol);
      const minValue = minSalaryCell.getValue();
      if (minValue && !isNaN(minValue)) {
        minSalaryCell.setNumberFormat("$#,##0");
      }
    }
    
    if (maxSalaryCol > 0) {
      const maxSalaryCell = sheet.getRange(row, maxSalaryCol);
      const maxValue = maxSalaryCell.getValue();
      if (maxValue && !isNaN(maxValue)) {
        maxSalaryCell.setNumberFormat("$#,##0");
      }
    }
    
    // Format URLs as hyperlinks
    const jobUrlCol = headers.indexOf("Job URL") + 1;
    const careersUrlCol = headers.indexOf("Careers URL") + 1;
    
    if (jobUrlCol > 0) {
      const urlCell = sheet.getRange(row, jobUrlCol);
      const url = urlCell.getValue();
      if (url && url.startsWith("http")) {
        urlCell.setFormula(`=HYPERLINK("${url}","View Job")`);
      }
    }
    
    if (careersUrlCol > 0) {
      const urlCell = sheet.getRange(row, careersUrlCol);
      const url = urlCell.getValue();
      if (url && url.startsWith("http")) {
        urlCell.setFormula(`=HYPERLINK("${url}","Careers Page")`);
      }
    }
    
  } catch (error) {
    Logger.log(`Error formatting job row: ${error}`);
  }
}

/**
 * Get existing jobs from spreadsheet for duplicate checking
 * @returns {Array} Array of existing job signatures
 */
function getExistingJobs() {
  try {
    const spreadsheetId = getJobFinderSpreadsheetId();
    if (!spreadsheetId) {
      return [];
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return [];
    }
    
    // Get all data except headers
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Find column indices
    const companyCol = headers.indexOf("Company");
    const titleCol = headers.indexOf("Job Title");
    const locationCol = headers.indexOf("Location");
    
    // Create signatures for existing jobs
    const existingJobs = data.map(row => ({
      company: row[companyCol] || "",
      title: row[titleCol] || "",
      location: row[locationCol] || "",
      signature: createJobSignature(row[companyCol], row[titleCol], row[locationCol])
    }));
    
    return existingJobs;
    
  } catch (error) {
    Logger.log(`Error getting existing jobs: ${error}`);
    return [];
  }
}

/**
 * Create a signature for a job for duplicate detection
 * @param {string} company - Company name
 * @param {string} title - Job title
 * @param {string} location - Location
 * @returns {string} Job signature
 */
function createJobSignature(company, title, location) {
  const normalize = (str) => (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${normalize(company)}-${normalize(title)}-${normalize(location)}`;
}

/**
 * Check if a job already exists
 * @param {Object} job - Job to check
 * @param {Array} existingJobs - Array of existing jobs
 * @returns {boolean} True if duplicate
 */
function isDuplicateJob(job, existingJobs) {
  const jobSignature = createJobSignature(
    job["Company"],
    job["Job Title"],
    job["Location"]
  );
  
  return existingJobs.some(existing => existing.signature === jobSignature);
}

/**
 * Get summary statistics from the spreadsheet
 * @returns {Object} Statistics object
 */
function getJobStatistics() {
  try {
    const spreadsheetId = getJobFinderSpreadsheetId();
    if (!spreadsheetId) {
      return { error: "No spreadsheet configured" };
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return {
        totalJobs: 0,
        companies: 0,
        locations: 0,
        withSalary: 0,
        bySource: {}
      };
    }
    
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Get column indices
    const companyCol = headers.indexOf("Company");
    const locationCol = headers.indexOf("Location");
    const minSalaryCol = headers.indexOf("Minimum Salary");
    const sourceCol = headers.indexOf("Email Source");
    
    // Calculate statistics
    const companies = new Set();
    const locations = new Set();
    const sources = {};
    let withSalary = 0;
    
    data.forEach(row => {
      if (row[companyCol]) companies.add(row[companyCol]);
      if (row[locationCol]) locations.add(row[locationCol]);
      if (row[minSalaryCol]) withSalary++;
      
      const source = row[sourceCol] || "Unknown";
      sources[source] = (sources[source] || 0) + 1;
    });
    
    return {
      totalJobs: data.length,
      companies: companies.size,
      locations: locations.size,
      withSalary: withSalary,
      bySource: sources,
      spreadsheetUrl: spreadsheet.getUrl()
    };
    
  } catch (error) {
    Logger.log(`Error getting job statistics: ${error}`);
    return { error: error.toString() };
  }
}

/**
 * Clean up duplicate entries in the spreadsheet
 * @returns {Object} Cleanup results
 */
function cleanupDuplicates() {
  try {
    const spreadsheetId = getJobFinderSpreadsheetId();
    if (!spreadsheetId) {
      return { error: "No spreadsheet configured" };
    }
    
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME);
    
    if (!sheet || sheet.getLastRow() <= 1) {
      return { duplicatesFound: 0, duplicatesRemoved: 0 };
    }
    
    // Get all data
    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Find duplicates
    const seen = new Set();
    const duplicateRows = [];
    
    const companyCol = headers.indexOf("Company");
    const titleCol = headers.indexOf("Job Title");
    const locationCol = headers.indexOf("Location");
    
    data.forEach((row, index) => {
      const signature = createJobSignature(
        row[companyCol],
        row[titleCol],
        row[locationCol]
      );
      
      if (seen.has(signature)) {
        duplicateRows.push(index + 2); // +2 for header and 0-index
      } else {
        seen.add(signature);
      }
    });
    
    // Remove duplicates (from bottom to top to maintain indices)
    duplicateRows.reverse().forEach(rowNum => {
      sheet.deleteRow(rowNum);
    });
    
    return {
      duplicatesFound: duplicateRows.length,
      duplicatesRemoved: duplicateRows.length
    };
    
  } catch (error) {
    Logger.log(`Error cleaning up duplicates: ${error}`);
    return { error: error.toString() };
  }
}

/**
 * Format date time for spreadsheet
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateTime(date) {
  if (!date) return "";
  
  try {
    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd HH:mm:ss"
    );
  } catch (error) {
    return date.toString();
  }
}

/**
 * Sanitize string for spreadsheet
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (!str) return "";
  
  return str
    .toString()
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .substring(0, 50000); // Limit length for cell size
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addJobToSpreadsheet,
    setupSheetHeaders,
    setColumnWidths,
    formatJobRow,
    getExistingJobs,
    createJobSignature,
    isDuplicateJob,
    getJobStatistics,
    cleanupDuplicates,
    formatDateTime,
    sanitizeString
  };
}
