/**
 * Job Finder Sheets Module
 * Handles all spreadsheet operations for job listings
 *
 * Platform access (Sheets, Utilities) is routed exclusively through
 * src/core/services ports via the serviceFactory (hexagonal-ports-refactor).
 */

/**
 * Resolve the shared serviceFactory singleton (global in Apps Script, required in Node).
 */
function _shServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  if (typeof require !== 'undefined') {
    return require('../../core/services/index.js').serviceFactory;
  }
  throw new Error('serviceFactory is not available');
}

function _shSheets() {
  return _shServiceFactory().getSpreadsheetAdapter();
}

function _shUtils() {
  return _shServiceFactory().getUtilitiesAdapter();
}

/**
 * Add a job to the spreadsheet
 * @param {Object} job - Job object with all details
 * @param {Date} emailDate - Date the email was received
 * @param {string} emailSource - Source of the email
 * @param {string} emailTitle - Email subject line
 * @param {number} jobsInEmail - Total jobs found in the email
 * @returns {boolean} Success status
 */
function addJobToSpreadsheet(job, emailDate = null, emailSource = '', emailTitle = '', jobsInEmail = 1) {
  try {
    // Get the spreadsheet
    const spreadsheetId = getJobFinderSpreadsheetId();
    if (!spreadsheetId) {
      Logger.log("No spreadsheet ID found");
      return false;
    }

    const spreadsheet = _shSheets().openById(spreadsheetId);
    const sheetName = JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME;

    Logger.log(`addJobToSpreadsheet: writing to spreadsheetId=${spreadsheetId} url=${spreadsheet.getUrl()} tab="${sheetName}"`);

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
    Logger.log(`addJobToSpreadsheet: appended "${job["Job Title"] || ""}" @ "${job["Company"] || ""}" -> row ${lastRow} of tab "${sheetName}"`);

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

    // Apply native row banding ONCE (idempotent). Native banding auto-maintains
    // the alternating stripes after row inserts/deletes, unlike a per-row
    // row % 2 background which desyncs once any row is removed. Remove any
    // existing banding first to avoid "range already has banding" errors and to
    // keep this call idempotent across re-runs.
    const fullRange = sheet.getRange(1, 1, sheet.getMaxRows(), headers.length);
    const existingBandings = sheet.getBandings();
    existingBandings.forEach(banding => banding.remove());
    fullRange.applyRowBanding(_shSheets().getBandingTheme("LIGHT_GREY"), true, false);

    // Set column widths
    setColumnWidths(sheet, headers);

  } catch (error) {
    Logger.log(`Error setting up sheet headers: ${error}`);
  }
}

/**
 * Audit the live sheet's header row against JOB_FINDER_CONFIG.SHEET_COLUMNS and,
 * if they differ, repair the sheet IN PLACE by remapping existing data BY HEADER NAME.
 *
 * A sheet created before column changes may carry OLD or mis-ordered headers. Because
 * addJobToSpreadsheet writes by the current SHEET_COLUMNS order, drifted headers would
 * place data under the WRONG columns. This function reconciles the live sheet to the
 * canonical column set with NO silent fallbacks: it repairs explicitly or throws loudly.
 *
 * Behavior:
 *  - Empty sheet (no data rows) -> write canonical headers, return {repaired:false, reason:'empty'}.
 *  - Live headers === SHEET_COLUMNS exactly -> return {repaired:false}. No write.
 *  - Otherwise -> remap every data row by header name (dropping columns not in the target,
 *    inserting "" for target columns missing live), rewrite the whole grid in canonical
 *    order, and re-apply header formatting. Returns {repaired:true, before, after, rows}.
 *  - Any row that cannot be reconciled (more cells than live headers) -> throw.
 *
 * @param {Sheet} sheet - The live sheet to audit/repair
 * @returns {Object} { repaired:boolean, reason?:string, before?:string[], after?:string[], rows?:number }
 */
function auditAndRepairSheetHeaders(sheet) {
  const targetColumns = JOB_FINDER_CONFIG.SHEET_COLUMNS;
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  // 1. Empty sheet (no header row written yet) -> write canonical headers and report empty.
  if (lastRow < 1 || lastColumn < 1) {
    setupSheetHeaders(sheet);
    Logger.log(`auditAndRepairSheetHeaders: sheet empty; wrote ${targetColumns.length} canonical headers.`);
    return { repaired: false, reason: 'empty' };
  }

  // Read the live header row using its actual width.
  const liveHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(h => (h === null || h === undefined) ? '' : String(h));

  // 2. Already aligned (same names, same order) -> no-op.
  if (liveHeaders.length === targetColumns.length &&
      liveHeaders.every((h, i) => h === targetColumns[i])) {
    return { repaired: false };
  }

  // 3. Build a name -> live column index map. Duplicate live names: first occurrence wins.
  const liveIndexByName = {};
  liveHeaders.forEach((name, idx) => {
    if (name !== '' && !(name in liveIndexByName)) {
      liveIndexByName[name] = idx;
    }
  });

  const dataRowCount = lastRow - 1;

  // 4. Safety snapshot BEFORE mutating (per plan risk note).
  Logger.log(`auditAndRepairSheetHeaders: BEFORE repair — headers=${JSON.stringify(liveHeaders)} rows=${dataRowCount}`);

  // Read existing data rows (if any) and remap each by header name.
  const remappedRows = [];
  if (dataRowCount > 0) {
    const liveData = sheet.getRange(2, 1, dataRowCount, lastColumn).getValues();

    liveData.forEach((row, i) => {
      // A cell holding data under a BLANK (unnamed) header column cannot be reconciled by
      // name — there is no header to map it to. Refuse to silently drop it; throw loudly.
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        const hasData = cell !== null && cell !== undefined && String(cell) !== '';
        const headerName = c < liveHeaders.length ? liveHeaders[c] : '';
        if (hasData && headerName === '') {
          throw new Error(
            `auditAndRepairSheetHeaders: cannot reconcile data row ${i + 2}, column ${c + 1} — ` +
            `value "${cell}" sits under a blank/unnamed header. ` +
            `Refusing to guess column mapping or drop data.`
          );
        }
      }
      const newRow = targetColumns.map(colName => {
        const srcIdx = liveIndexByName[colName];
        if (srcIdx === undefined) {
          return ''; // Target column absent in live sheet -> insert blank.
        }
        const value = row[srcIdx];
        return (value === null || value === undefined) ? '' : value;
      });
      remappedRows.push(newRow);
    });
  }

  // 5. Rewrite the whole grid in canonical order: clear, then one setValues for the data block,
  //    then re-apply header formatting (bold/bg/frozen/widths).
  sheet.clearContents();

  const block = [targetColumns.slice(), ...remappedRows];
  sheet.getRange(1, 1, block.length, targetColumns.length).setValues(block);

  setupSheetHeaders(sheet);

  // 7. Log final state and return the repair summary.
  Logger.log(`auditAndRepairSheetHeaders: AFTER repair — headers=${JSON.stringify(targetColumns)} rows=${remappedRows.length}`);

  return {
    repaired: true,
    before: liveHeaders,
    after: targetColumns.slice(),
    rows: remappedRows.length
  };
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

    // Row striping is handled once by native row banding in setupSheetHeaders
    // (_shSheets().getBandingTheme("LIGHT_GREY")). A per-row row % 2 background was
    // removed here because it desyncs after any row is deleted.

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
    
    // Format Job URL as hyperlink
    const jobUrlCol = headers.indexOf("Job URL") + 1;

    if (jobUrlCol > 0) {
      const urlCell = sheet.getRange(row, jobUrlCol);
      const url = urlCell.getValue();
      if (url && url.startsWith("http")) {
        urlCell.setFormula(`=HYPERLINK("${url}","View Job")`);
      }
    }

  } catch (error) {
    Logger.log(`Error formatting job row: ${error}`);
  }
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
    
    const spreadsheet = _shSheets().openById(spreadsheetId);
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
 * Format date time for spreadsheet
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDateTime(date) {
  if (!date) return "";
  
  try {
    return _shUtils().formatDate(
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
    auditAndRepairSheetHeaders,
    setColumnWidths,
    formatJobRow,
    getJobStatistics,
    formatDateTime,
    sanitizeString
  };
}
