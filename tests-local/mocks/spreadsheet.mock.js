/**
 * Mock Google Apps Script Spreadsheet Service
 * Provides realistic mock implementations for testing
 */

class MockRange {
  constructor(sheet, row, col, numRows = 1, numCols = 1) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
    this.values = [];
    this.formulas = [];
    this.fontWeights = [];
    this.backgrounds = [];
  }

  getValues() {
    return this.values;
  }

  setValues(values) {
    this.values = values;

    // Also write back to the sheet's data grid
    for (let r = 0; r < values.length; r++) {
      const sheetRow = this.row - 1 + r;
      if (!this.sheet.data[sheetRow]) {
        this.sheet.data[sheetRow] = [];
      }
      for (let c = 0; c < values[r].length; c++) {
        const sheetCol = this.col - 1 + c;
        this.sheet.data[sheetRow][sheetCol] = values[r][c];
      }
    }

    return this;
  }

  getValue() {
    return this.values[0]?.[0] || '';
  }

  setValue(value) {
    this.values = [[value]];
    return this;
  }

  getFormulas() {
    return this.formulas;
  }

  setFormulas(formulas) {
    this.formulas = formulas;
    return this;
  }

  setFontWeight(weight) {
    this.fontWeights = Array(this.numRows).fill(Array(this.numCols).fill(weight));
    return this;
  }

  setBackground(color) {
    this.backgrounds = Array(this.numRows).fill(Array(this.numCols).fill(color));
    return this;
  }

  setHorizontalAlignment(alignment) {
    this.horizontalAlignment = alignment;
    return this;
  }

  setNumberFormat(format) {
    this.numberFormat = format;
    return this;
  }

  setFontColor(color) {
    this.fontColor = color;
    return this;
  }

  /**
   * Apply a row banding to this range. Records the banding on the owning sheet
   * so tests can assert it was applied (mirrors Range.applyRowBanding in GAS).
   * @param {string} theme - BandingTheme value
   * @param {boolean} showHeader
   * @param {boolean} showFooter
   * @returns {MockBanding} the created banding
   */
  applyRowBanding(theme, showHeader = false, showFooter = false) {
    const banding = new MockBanding(this, theme, showHeader, showFooter);
    if (!this.sheet.bandings) this.sheet.bandings = [];
    this.sheet.bandings.push(banding);
    return banding;
  }

  getRow() {
    return this.row;
  }

  getColumn() {
    return this.col;
  }

  getNumRows() {
    return this.numRows;
  }

  getNumColumns() {
    return this.numCols;
  }
}

/**
 * Mock of a Spreadsheet Banding object (Range.applyRowBanding return value).
 */
class MockBanding {
  constructor(range, theme, showHeader, showFooter) {
    this.range = range;
    this.theme = theme;
    this.showHeader = showHeader;
    this.showFooter = showFooter;
    this.removed = false;
  }

  getRange() {
    return this.range;
  }

  /**
   * Remove this banding from its owning sheet (mirrors Banding.remove in GAS).
   */
  remove() {
    this.removed = true;
    const sheet = this.range && this.range.sheet;
    if (sheet && Array.isArray(sheet.bandings)) {
      const idx = sheet.bandings.indexOf(this);
      if (idx > -1) sheet.bandings.splice(idx, 1);
    }
    return this;
  }
}

class MockSheet {
  constructor(name, spreadsheet) {
    this.name = name;
    this.spreadsheet = spreadsheet;
    this.data = [[]]; // 2D array of cell values
    this.frozen = { rows: 0, cols: 0 };
    this.bandings = []; // recorded row bandings (see MockRange.applyRowBanding)
  }

  /**
   * Return the bandings currently applied to this sheet (mirrors Sheet.getBandings).
   * @returns {MockBanding[]}
   */
  getBandings() {
    return this.bandings || [];
  }

  getName() {
    return this.name;
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    const range = new MockRange(this, row, col, numRows, numCols);

    // Get values from data grid WITHOUT mutating it. Reading a range that
    // extends beyond existing data (e.g. a full-grid getMaxRows() range) must
    // not materialize phantom rows into this.data, otherwise getLastRow()/
    // getLastColumn() would be inflated — real GAS getRange does not grow the grid.
    const values = [];
    for (let r = row - 1; r < row - 1 + numRows; r++) {
      const rowData = [];
      const existingRow = this.data[r];
      for (let c = col - 1; c < col - 1 + numCols; c++) {
        rowData.push((existingRow && existingRow[c]) || '');
      }
      values.push(rowData);
    }
    // Seed the range's own values snapshot WITHOUT writing back to the grid
    // (range.setValues would re-materialize phantom rows for an over-wide read).
    range.values = values;

    return range;
  }

  getDataRange() {
    const lastRow = this.getLastRow();
    const lastCol = this.getLastColumn();
    return this.getRange(1, 1, lastRow || 1, lastCol || 1);
  }

  appendRow(rowData) {
    const lastRow = this.getLastRow();
    const newRow = lastRow + 1;

    if (!this.data[newRow - 1]) {
      this.data[newRow - 1] = [];
    }

    rowData.forEach((value, index) => {
      this.data[newRow - 1][index] = value;
    });

    return this;
  }

  getLastRow() {
    return this.data.length;
  }

  getLastColumn() {
    let maxCols = 0;
    this.data.forEach(row => {
      if (row && row.length > maxCols) {
        maxCols = row.length;
      }
    });
    return maxCols;
  }

  /**
   * Total number of rows in the sheet grid (mirrors Sheet.getMaxRows).
   * Real GAS sheets default to ~1000 rows; the mock reports at least that many
   * so banding/full-grid ranges behave like the live sheet.
   */
  getMaxRows() {
    return Math.max(1000, this.data.length);
  }

  clear() {
    this.data = [[]];
    return this;
  }

  clearContents() {
    return this.clear();
  }

  deleteRow(rowPosition) {
    this.data.splice(rowPosition - 1, 1);
    return this;
  }

  deleteRows(rowPosition, howMany) {
    this.data.splice(rowPosition - 1, howMany);
    return this;
  }

  insertRowBefore(beforePosition) {
    this.data.splice(beforePosition - 1, 0, []);
    return this;
  }

  setFrozenRows(rows) {
    this.frozen.rows = rows;
    return this;
  }

  setFrozenColumns(cols) {
    this.frozen.cols = cols;
    return this;
  }

  getFrozenRows() {
    return this.frozen.rows;
  }

  getFrozenColumns() {
    return this.frozen.cols;
  }

  autoResizeColumns(startColumn, numColumns) {
    // Mock implementation - just track that it was called
    this.autoResized = { startColumn, numColumns };
    return this;
  }

  /**
   * Set cell value directly (for test setup)
   */
  setCellValue(row, col, value) {
    if (!this.data[row - 1]) {
      this.data[row - 1] = [];
    }
    this.data[row - 1][col - 1] = value;
  }

  /**
   * Get cell value directly (for test verification)
   */
  getCellValue(row, col) {
    return this.data[row - 1]?.[col - 1] || '';
  }
}

class MockSpreadsheet {
  constructor(name, id) {
    this.name = name;
    this.id = id;
    this.sheets = [];
  }

  getName() {
    return this.name;
  }

  getId() {
    return this.id;
  }

  getSheets() {
    return this.sheets;
  }

  getSheetByName(name) {
    return this.sheets.find(s => s.getName() === name) || null;
  }

  insertSheet(name) {
    const sheet = new MockSheet(name, this);
    this.sheets.push(sheet);
    return sheet;
  }

  deleteSheet(sheet) {
    const index = this.sheets.indexOf(sheet);
    if (index > -1) {
      this.sheets.splice(index, 1);
    }
  }

  getActiveSheet() {
    return this.sheets[0] || null;
  }

  getUrl() {
    return `https://docs.google.com/spreadsheets/d/${this.id}/edit`;
  }

  toast(msg, title, timeoutSeconds) {
    // Mock implementation - track toast messages
    if (!this.toasts) this.toasts = [];
    this.toasts.push({ msg, title, timeoutSeconds, timestamp: new Date() });
  }

  /**
   * Get all toast messages (for test verification)
   */
  getToasts() {
    return this.toasts || [];
  }

  /**
   * Clear toast messages (for test cleanup)
   */
  clearToasts() {
    this.toasts = [];
  }
}

class MockSpreadsheetApp {
  constructor() {
    this.spreadsheets = [];
    this.activeSpreadsheet = null;
  }

  create(name) {
    const id = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const spreadsheet = new MockSpreadsheet(name, id);
    this.spreadsheets.push(spreadsheet);
    return spreadsheet;
  }

  openById(id) {
    return this.spreadsheets.find(s => s.getId() === id) || null;
  }

  openByUrl(url) {
    const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch) {
      return this.openById(idMatch[1]);
    }
    return null;
  }

  getActiveSpreadsheet() {
    return this.activeSpreadsheet;
  }

  setActiveSpreadsheet(spreadsheet) {
    this.activeSpreadsheet = spreadsheet;
  }

  /**
   * Add a spreadsheet to the mock system
   */
  addSpreadsheet(spreadsheet) {
    this.spreadsheets.push(spreadsheet);
  }

  /**
   * Reset the entire mock state
   */
  reset() {
    this.spreadsheets = [];
    this.activeSpreadsheet = null;
  }
}

// Mirror of SpreadsheetApp.BandingTheme enum (only the value we use).
const BandingTheme = {
  LIGHT_GREY: 'LIGHT_GREY'
};

module.exports = {
  MockSpreadsheetApp,
  MockSpreadsheet,
  MockSheet,
  MockRange,
  MockBanding,
  BandingTheme
};
