/**
 * Spreadsheet Service Adapter
 * Provides a testable wrapper around SpreadsheetApp
 * This adapter allows dependency injection and easier testing
 */

class SpreadsheetAdapter {
  constructor(spreadsheetApp = SpreadsheetApp) {
    this.spreadsheetApp = spreadsheetApp;
  }

  /**
   * Open a spreadsheet by ID
   */
  openById(id) {
    return this.spreadsheetApp.openById(id);
  }

  /**
   * Open a spreadsheet by URL
   */
  openByUrl(url) {
    return this.spreadsheetApp.openByUrl(url);
  }

  /**
   * Get the active spreadsheet
   */
  getActiveSpreadsheet() {
    return this.spreadsheetApp.getActiveSpreadsheet();
  }

  /**
   * Create a new spreadsheet
   */
  create(name) {
    return this.spreadsheetApp.create(name);
  }

  /**
   * Get a BandingTheme enum value by name (e.g. 'LIGHT_GREY').
   * Lets feature code apply row banding without referencing SpreadsheetApp directly.
   */
  getBandingTheme(themeName) {
    return this.spreadsheetApp.BandingTheme[themeName];
  }

  /**
   * Get or create a sheet in a spreadsheet
   */
  getOrCreateSheet(spreadsheet, sheetName) {
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
    }

    return sheet;
  }

  /**
   * Append a row to a sheet
   */
  appendRow(sheet, rowData) {
    return sheet.appendRow(rowData);
  }

  /**
   * Get all data from a sheet
   */
  getSheetData(sheet) {
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow === 0 || lastCol === 0) {
      return [];
    }

    return sheet.getRange(1, 1, lastRow, lastCol).getValues();
  }

  /**
   * Write data to a sheet (overwrites existing)
   */
  writeSheetData(sheet, data) {
    if (!data || data.length === 0) {
      return;
    }

    const numRows = data.length;
    const numCols = data[0].length;

    // Clear existing content
    sheet.clear();

    // Write new data
    sheet.getRange(1, 1, numRows, numCols).setValues(data);
  }

  /**
   * Setup sheet headers
   */
  setupHeaders(sheet, headers, freeze = true) {
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f3f3f3');

    if (freeze) {
      sheet.setFrozenRows(1);
    }

    return headerRange;
  }

  /**
   * Find row by column value
   */
  findRowByValue(sheet, columnIndex, value) {
    const data = this.getSheetData(sheet);

    for (let i = 0; i < data.length; i++) {
      if (data[i][columnIndex - 1] === value) {
        return i + 1; // Return 1-indexed row number
      }
    }

    return -1; // Not found
  }

  /**
   * Update a specific cell
   */
  updateCell(sheet, row, col, value) {
    sheet.getRange(row, col).setValue(value);
  }

  /**
   * Batch update multiple cells
   */
  batchUpdateCells(sheet, updates) {
    updates.forEach(({ row, col, value }) => {
      this.updateCell(sheet, row, col, value);
    });
  }

  /**
   * Auto-resize columns
   */
  autoResizeColumns(sheet, startColumn = 1, numColumns = null) {
    const cols = numColumns || sheet.getLastColumn();
    sheet.autoResizeColumns(startColumn, cols);
  }
}

// Export for both GAS and Node.js
/* istanbul ignore next -- the `typeof module` guard is always true under Node/Jest and always false in GAS; the false branch is never taken in the test runtime. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SpreadsheetAdapter };
}
