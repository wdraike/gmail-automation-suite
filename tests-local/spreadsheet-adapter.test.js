/**
 * SpreadsheetAdapter Tests
 */

const { SpreadsheetAdapter } = require('../src/core/services/spreadsheet-adapter.js');

describe('SpreadsheetAdapter', () => {
  let adapter;
  let mockSpreadsheetApp;

  beforeEach(() => {
    mockSpreadsheetApp = {
      openById: jest.fn(),
      openByUrl: jest.fn(),
      getActiveSpreadsheet: jest.fn(),
      create: jest.fn(),
      BandingTheme: { LIGHT_GREY: 'LIGHT_GREY_THEME' },
    };
    adapter = new SpreadsheetAdapter(mockSpreadsheetApp);
  });

  describe('getBandingTheme', () => {
    it('should return the requested BandingTheme enum value', () => {
      const result = adapter.getBandingTheme('LIGHT_GREY');
      expect(result).toBe('LIGHT_GREY_THEME');
    });
  });

  describe('openById', () => {
    it('should delegate to spreadsheet.openById', () => {
      const mockSS = { getName: jest.fn(() => 'Sheet') };
      mockSpreadsheetApp.openById.mockReturnValue(mockSS);

      const result = adapter.openById('abc123');

      expect(mockSpreadsheetApp.openById).toHaveBeenCalledWith('abc123');
      expect(result).toBe(mockSS);
    });
  });

  describe('openByUrl', () => {
    it('should delegate to spreadsheet.openByUrl', () => {
      const mockSS = { getName: jest.fn(() => 'Sheet') };
      mockSpreadsheetApp.openByUrl.mockReturnValue(mockSS);

      const result = adapter.openByUrl('https://docs.google.com/spreadsheets/d/abc123');

      expect(mockSpreadsheetApp.openByUrl).toHaveBeenCalledWith('https://docs.google.com/spreadsheets/d/abc123');
      expect(result).toBe(mockSS);
    });
  });

  describe('getActiveSpreadsheet', () => {
    it('should delegate to spreadsheet.getActiveSpreadsheet', () => {
      const mockSS = { getName: jest.fn(() => 'Active') };
      mockSpreadsheetApp.getActiveSpreadsheet.mockReturnValue(mockSS);

      const result = adapter.getActiveSpreadsheet();

      expect(mockSpreadsheetApp.getActiveSpreadsheet).toHaveBeenCalled();
      expect(result).toBe(mockSS);
    });
  });

  describe('create', () => {
    it('should delegate to spreadsheet.create', () => {
      const mockSS = { getName: jest.fn(() => 'New') };
      mockSpreadsheetApp.create.mockReturnValue(mockSS);

      const result = adapter.create('New');

      expect(mockSpreadsheetApp.create).toHaveBeenCalledWith('New');
      expect(result).toBe(mockSS);
    });
  });

  describe('getOrCreateSheet', () => {
    it('should return existing sheet if found', () => {
      const mockSheet = { getName: jest.fn(() => 'Data') };
      const mockSS = {
        getSheetByName: jest.fn(() => mockSheet),
        insertSheet: jest.fn(),
      };

      const result = adapter.getOrCreateSheet(mockSS, 'Data');

      expect(mockSS.getSheetByName).toHaveBeenCalledWith('Data');
      expect(result).toBe(mockSheet);
      expect(mockSS.insertSheet).not.toHaveBeenCalled();
    });

    it('should create sheet if not found', () => {
      const mockSheet = { getName: jest.fn(() => 'Data') };
      const mockSS = {
        getSheetByName: jest.fn(() => null),
        insertSheet: jest.fn(() => mockSheet),
      };

      const result = adapter.getOrCreateSheet(mockSS, 'Data');

      expect(mockSS.insertSheet).toHaveBeenCalledWith('Data');
      expect(result).toBe(mockSheet);
    });
  });

  describe('appendRow', () => {
    it('delegates to sheet.appendRow with the row data', () => {
      const sheet = { appendRow: jest.fn(() => 'ok') };
      const row = ['a', 'b', 'c'];
      expect(adapter.appendRow(sheet, row)).toBe('ok');
      expect(sheet.appendRow).toHaveBeenCalledWith(row);
    });
  });

  describe('getSheetData', () => {
    it('returns the cell values from the used range', () => {
      const values = [['h1', 'h2'], [1, 2]];
      const range = { getValues: jest.fn(() => values) };
      const sheet = {
        getLastRow: jest.fn(() => 2),
        getLastColumn: jest.fn(() => 2),
        getRange: jest.fn(() => range),
      };
      const result = adapter.getSheetData(sheet);
      expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 2, 2);
      expect(result).toBe(values);
    });

    it('returns [] when the sheet has no rows', () => {
      const sheet = {
        getLastRow: jest.fn(() => 0),
        getLastColumn: jest.fn(() => 3),
        getRange: jest.fn(),
      };
      expect(adapter.getSheetData(sheet)).toEqual([]);
      expect(sheet.getRange).not.toHaveBeenCalled();
    });

    it('returns [] when the sheet has no columns', () => {
      const sheet = {
        getLastRow: jest.fn(() => 5),
        getLastColumn: jest.fn(() => 0),
        getRange: jest.fn(),
      };
      expect(adapter.getSheetData(sheet)).toEqual([]);
      expect(sheet.getRange).not.toHaveBeenCalled();
    });
  });

  describe('writeSheetData', () => {
    it('clears the sheet and writes the values for non-empty data', () => {
      const range = { setValues: jest.fn() };
      const sheet = { clear: jest.fn(), getRange: jest.fn(() => range) };
      const data = [['a', 'b'], ['c', 'd']];
      adapter.writeSheetData(sheet, data);
      expect(sheet.clear).toHaveBeenCalled();
      expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 2, 2);
      expect(range.setValues).toHaveBeenCalledWith(data);
    });

    it('is a no-op for null data', () => {
      const sheet = { clear: jest.fn(), getRange: jest.fn() };
      adapter.writeSheetData(sheet, null);
      expect(sheet.clear).not.toHaveBeenCalled();
    });

    it('is a no-op for an empty array', () => {
      const sheet = { clear: jest.fn(), getRange: jest.fn() };
      adapter.writeSheetData(sheet, []);
      expect(sheet.clear).not.toHaveBeenCalled();
    });
  });

  describe('setupHeaders', () => {
    function makeHeaderSheet() {
      const headerRange = {
        setValues: jest.fn(),
        setFontWeight: jest.fn(),
        setBackground: jest.fn(),
      };
      const sheet = {
        getRange: jest.fn(() => headerRange),
        setFrozenRows: jest.fn(),
      };
      return { sheet, headerRange };
    }

    it('writes, bolds, and shades the header row and freezes by default', () => {
      const { sheet, headerRange } = makeHeaderSheet();
      const headers = ['A', 'B', 'C'];
      const result = adapter.setupHeaders(sheet, headers);

      expect(sheet.getRange).toHaveBeenCalledWith(1, 1, 1, 3);
      expect(headerRange.setValues).toHaveBeenCalledWith([headers]);
      expect(headerRange.setFontWeight).toHaveBeenCalledWith('bold');
      expect(headerRange.setBackground).toHaveBeenCalledWith('#f3f3f3');
      expect(sheet.setFrozenRows).toHaveBeenCalledWith(1);
      expect(result).toBe(headerRange);
    });

    it('does not freeze rows when freeze=false', () => {
      const { sheet } = makeHeaderSheet();
      adapter.setupHeaders(sheet, ['A'], false);
      expect(sheet.setFrozenRows).not.toHaveBeenCalled();
    });
  });

  describe('findRowByValue', () => {
    function makeDataSheet(values) {
      const range = { getValues: jest.fn(() => values) };
      return {
        getLastRow: jest.fn(() => values.length),
        getLastColumn: jest.fn(() => (values[0] ? values[0].length : 0)),
        getRange: jest.fn(() => range),
      };
    }

    it('returns the 1-indexed row when the value is found', () => {
      const sheet = makeDataSheet([['id1', 'x'], ['id2', 'y'], ['id3', 'z']]);
      expect(adapter.findRowByValue(sheet, 1, 'id2')).toBe(2);
    });

    it('returns -1 when the value is not found', () => {
      const sheet = makeDataSheet([['id1', 'x']]);
      expect(adapter.findRowByValue(sheet, 1, 'missing')).toBe(-1);
    });
  });

  describe('updateCell', () => {
    it('sets the value at the given row/col', () => {
      const range = { setValue: jest.fn() };
      const sheet = { getRange: jest.fn(() => range) };
      adapter.updateCell(sheet, 3, 4, 'hello');
      expect(sheet.getRange).toHaveBeenCalledWith(3, 4);
      expect(range.setValue).toHaveBeenCalledWith('hello');
    });
  });

  describe('batchUpdateCells', () => {
    it('applies each update via updateCell', () => {
      const range = { setValue: jest.fn() };
      const sheet = { getRange: jest.fn(() => range) };
      adapter.batchUpdateCells(sheet, [
        { row: 1, col: 1, value: 'a' },
        { row: 2, col: 3, value: 'b' },
      ]);
      expect(sheet.getRange).toHaveBeenNthCalledWith(1, 1, 1);
      expect(sheet.getRange).toHaveBeenNthCalledWith(2, 2, 3);
      expect(range.setValue).toHaveBeenCalledWith('a');
      expect(range.setValue).toHaveBeenCalledWith('b');
    });

    it('does nothing for an empty update list', () => {
      const sheet = { getRange: jest.fn() };
      adapter.batchUpdateCells(sheet, []);
      expect(sheet.getRange).not.toHaveBeenCalled();
    });
  });

  describe('autoResizeColumns', () => {
    it('resizes the explicit number of columns from the start column', () => {
      const sheet = { autoResizeColumns: jest.fn(), getLastColumn: jest.fn() };
      adapter.autoResizeColumns(sheet, 2, 5);
      expect(sheet.autoResizeColumns).toHaveBeenCalledWith(2, 5);
      expect(sheet.getLastColumn).not.toHaveBeenCalled();
    });

    it('falls back to the last column when numColumns is not given', () => {
      const sheet = { autoResizeColumns: jest.fn(), getLastColumn: jest.fn(() => 7) };
      adapter.autoResizeColumns(sheet);
      expect(sheet.getLastColumn).toHaveBeenCalled();
      expect(sheet.autoResizeColumns).toHaveBeenCalledWith(1, 7);
    });
  });

  describe('default SpreadsheetApp dependency', () => {
    it('uses the global SpreadsheetApp when no app is injected', () => {
      // setup.js provides a global SpreadsheetApp mock.
      const defaultAdapter = new SpreadsheetAdapter();
      const ss = { getName: jest.fn(() => 'x') };
      SpreadsheetApp.openById.mockReturnValue(ss);
      expect(defaultAdapter.openById('id')).toBe(ss);
      expect(SpreadsheetApp.openById).toHaveBeenCalledWith('id');
    });
  });
});
