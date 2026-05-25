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

class MockSheet {
  constructor(name, spreadsheet) {
    this.name = name;
    this.spreadsheet = spreadsheet;
    this.data = [[]]; // 2D array of cell values
    this.frozen = { rows: 0, cols: 0 };
  }

  getName() {
    return this.name;
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    const range = new MockRange(this, row, col, numRows, numCols);

    // Get values from data grid
    const values = [];
    for (let r = row - 1; r < row - 1 + numRows; r++) {
      const rowData = [];
      for (let c = col - 1; c < col - 1 + numCols; c++) {
        if (!this.data[r]) this.data[r] = [];
        rowData.push(this.data[r][c] || '');
      }
      values.push(rowData);
    }
    range.setValues(values);

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

module.exports = {
  MockSpreadsheetApp,
  MockSpreadsheet,
  MockSheet,
  MockRange
};
