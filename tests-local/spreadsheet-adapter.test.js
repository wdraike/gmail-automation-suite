/**
 * SpreadsheetAdapter Tests
 */

describe('SpreadsheetAdapter', () => {
  let adapter;
  let mockSpreadsheetApp;

  beforeEach(() => {
    mockSpreadsheetApp = {
      openById: jest.fn(),
      openByUrl: jest.fn(),
      getActiveSpreadsheet: jest.fn(),
      create: jest.fn(),
    };
    adapter = new SpreadsheetAdapter(mockSpreadsheetApp);
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
});
