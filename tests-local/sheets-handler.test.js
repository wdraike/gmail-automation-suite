/**
 * Unit Tests for Sheets Handler Module
 * Tests spreadsheet operations for job listings
 */

const { MockSpreadsheetApp, MockSpreadsheet, MockSheet, MockRange, BandingTheme } = require('./mocks/spreadsheet.mock');
const { createJobData, createJobBatch } = require('./fixtures/job-factory');
const { serviceFactory } = require('../src/core/services/index.js');

// Setup mocks
beforeEach(() => {
  global.SpreadsheetApp = new MockSpreadsheetApp();
  global.SpreadsheetApp.BandingTheme = BandingTheme;
  global.Logger = { log: jest.fn() };

  // Mock Utilities
  global.Utilities = {
    formatDate: jest.fn((date, tz, format) => {
      const pad = (n) => String(n).padStart(2, '0');
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const h = pad(date.getHours());
      const min = pad(date.getMinutes());
      const s = pad(date.getSeconds());
      return `${y}-${m}-${d} ${h}:${min}:${s}`;
    })
  };

  // Mock Session
  global.Session = {
    getScriptTimeZone: jest.fn(() => 'America/New_York')
  };

  // Mock config — final 18-column set (Careers URL columns removed in Phase 1)
  global.JOB_FINDER_CONFIG = {
    ACTIVE_SHEET_NAME: 'Job Listings',
    SHEET_COLUMNS: [
      'Company', 'Company Description', 'Job Title', 'Employment Type',
      'Work Arrangement', 'Experience Level', 'Location',
      'Minimum Salary', 'Maximum Salary', 'Salary Period',
      'Job URL', 'URL Status',
      'Email Received Date', 'Email Source', 'Date Added',
      'Interest', 'Email Title', 'Jobs Found In Email'
    ]
  };

  // Production code resolves the spreadsheet id via getJobFinderSpreadsheetId
  global.getJobFinderSpreadsheetId = jest.fn(() => 'test-spreadsheet-id');

  // Rebuild port adapters so they bind to the freshly-created global mocks above
  // (Sheets/Utilities are accessed through serviceFactory ports).
  serviceFactory.reset();
});

// Mock setColumnWidths and formatJobRow before loading the module
global.setColumnWidths = jest.fn();
global.formatJobRow = jest.fn();

const sheetsHandler = require('../src/features/job-finder/sheets-handler');
const {
  addJobToSpreadsheet,
  setupSheetHeaders,
  formatDateTime,
  sanitizeString,
  getJobStatistics,
  auditAndRepairSheetHeaders
} = sheetsHandler;
// The real formatJobRow (the module-level global.formatJobRow above is only a stub
// used to shadow addJobToSpreadsheet's internal call). Test the exported real fn.
const realFormatJobRow = sheetsHandler.formatJobRow;

// Final 18-column target (mirrors JOB_FINDER_CONFIG.SHEET_COLUMNS in beforeEach)
const FINAL_COLUMNS = [
  'Company', 'Company Description', 'Job Title', 'Employment Type',
  'Work Arrangement', 'Experience Level', 'Location',
  'Minimum Salary', 'Maximum Salary', 'Salary Period',
  'Job URL', 'URL Status',
  'Email Received Date', 'Email Source', 'Date Added',
  'Interest', 'Email Title', 'Jobs Found In Email'
];

/**
 * Build a MockSheet pre-populated with a given header row + data rows.
 * @param {string[]} headers
 * @param {Array<Array>} rows
 */
function makeSheetWith(headers, rows = []) {
  const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
  const sheet = spreadsheet.insertSheet('Job Listings');
  if (headers && headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  rows.forEach((row, i) => {
    sheet.getRange(2 + i, 1, 1, row.length).setValues([row]);
  });
  return sheet;
}

describe('Sheets Handler - Unit Tests', () => {
  describe('formatDateTime', () => {
    it('should format date correctly', () => {
      const date = new Date('2025-10-04T14:30:00');
      const result = formatDateTime(date);

      expect(result).toContain('2025');
      expect(result).toContain('10');
      expect(result).toContain('04');
    });

    it('should handle invalid date', () => {
      const result = formatDateTime(null);
      expect(result).toBe('');
    });
  });

  describe('sanitizeString', () => {
    it('should remove control characters', () => {
      const result = sanitizeString('Hello\x00World\x1F');
      expect(result).toBe('HelloWorld');
    });

    it('should handle null/undefined', () => {
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });

    it('should handle numbers', () => {
      expect(sanitizeString(123)).toBe('123');
    });

    it('should limit string length', () => {
      const longString = 'a'.repeat(60000);
      const result = sanitizeString(longString);
      expect(result.length).toBe(50000);
    });
  });

  describe('setupSheetHeaders', () => {
    it('should set up headers with formatting', () => {
      const spreadsheet = new MockSpreadsheet('Test', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');

      setupSheetHeaders(sheet);

      // Check headers were set (18 columns, no Careers URL)
      const headerRow = sheet.getRange(1, 1, 1, 18).getValues()[0];
      expect(headerRow[0]).toBe('Company');
      expect(headerRow[2]).toBe('Job Title');
      expect(headerRow.length).toBe(18);
      expect(headerRow).not.toContain('Careers URL');
      expect(headerRow).not.toContain('Careers URL Status');

      // Check frozen rows
      expect(sheet.getFrozenRows()).toBe(1);
    });
  });

  describe('addJobToSpreadsheet', () => {
    it('should add job to active sheet', () => {
      const job = createJobData({
        company: 'Test Corp',
        jobTitle: 'Developer',
        location: 'Remote'
      });

      // Create spreadsheet
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);

      const result = addJobToSpreadsheet(job);

      expect(result).toBe(true);
      expect(sheet.getLastRow()).toBe(2); // Header + 1 job

      const data = sheet.getRange(2, 1, 1, 3).getValues()[0];
      expect(data[0]).toBe('Test Corp');
      expect(data[2]).toBe('Developer');
    });

    it('should write exactly 18 columns with no Careers URL data', () => {
      const job = createJobData({ company: 'Test Corp', jobTitle: 'Developer' });

      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);

      addJobToSpreadsheet(job);

      const row = sheet.getRange(2, 1, 1, 18).getValues()[0];
      expect(row.length).toBe(18);
      // careersUrl value from the fixture must NOT appear anywhere in the row
      expect(row).not.toContain('https://example.com/careers');
    });

    it('should always write to the active sheet (no backup/duplicate routing)', () => {
      const job = createJobData({ company: 'Acme' });

      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);

      const result = addJobToSpreadsheet(job);

      expect(result).toBe(true);
      const activeSheet = spreadsheet.getSheetByName('Job Listings');
      expect(activeSheet).toBeTruthy();
      expect(activeSheet.getLastRow()).toBeGreaterThan(0);
      // No backup/duplicate sheet should ever be created
      expect(spreadsheet.getSheetByName('Duplicates')).toBeFalsy();
      expect(spreadsheet.getSheetByName('Duplicate Listings')).toBeFalsy();
    });

    it('should return false when no spreadsheet ID', () => {
      global.getJobFinderSpreadsheetId.mockReturnValue('');

      const job = createJobData();
      const result = addJobToSpreadsheet(job);

      expect(result).toBe(false);
    });

    it('should handle errors gracefully', () => {
      global.SpreadsheetApp.openById = jest.fn(() => {
        throw new Error('Spreadsheet not found');
      });

      const job = createJobData();
      const result = addJobToSpreadsheet(job);

      expect(result).toBe(false);
      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Error'));
    });
  });

  describe('getJobStatistics', () => {
    it('should return statistics for jobs', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);

      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);

      const jobs = createJobBatch(5);
      jobs.forEach(job => addJobToSpreadsheet(job));

      const stats = getJobStatistics();

      expect(stats).toBeDefined();
      expect(stats.totalJobs).toBe(5);
    });
  });

  describe('auditAndRepairSheetHeaders', () => {
    function readHeaderRow(sheet) {
      return sheet.getRange(1, 1, 1, FINAL_COLUMNS.length).getValues()[0];
    }
    function readDataRow(sheet, dataRowIndex) {
      // dataRowIndex 0 -> sheet row 2
      return sheet.getRange(2 + dataRowIndex, 1, 1, FINAL_COLUMNS.length).getValues()[0];
    }

    it('writes headers and reports empty when the sheet has no rows', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      const sheet = spreadsheet.insertSheet('Job Listings'); // fresh, no data

      const result = auditAndRepairSheetHeaders(sheet);

      expect(result.repaired).toBe(false);
      expect(result.reason).toBe('empty');
      expect(readHeaderRow(sheet)).toEqual(FINAL_COLUMNS);
      expect(sheet.getFrozenRows()).toBe(1);
    });

    it('returns repaired:false and does not rewrite when headers already aligned', () => {
      const dataRow = ['Acme', 'desc', 'Dev', 'FT', 'Remote', 'Senior', 'NYC',
         '100', '200', 'year', 'http://x', 'OK',
         '2026-01-01', 'src', '2026-01-02', 'Yes', 'Subject', '1'];
      const sheet = makeSheetWith(FINAL_COLUMNS, [dataRow]);

      // The repair path clears+rewrites the grid; an aligned sheet must NOT do that.
      const clearSpy = jest.spyOn(sheet, 'clearContents');

      const result = auditAndRepairSheetHeaders(sheet);

      expect(result.repaired).toBe(false);
      expect(clearSpy).not.toHaveBeenCalled();
      // Content untouched
      expect(readHeaderRow(sheet)).toEqual(FINAL_COLUMNS);
      expect(readDataRow(sheet, 0)).toEqual(dataRow);

      clearSpy.mockRestore();
    });

    it('repairs an old 16-column sheet, mapping each datum under its correct header', () => {
      // A plausible pre-Phase3 / pre-Careers-removal 16-col layout (names subset of final).
      const oldHeaders = [
        'Company', 'Company Description', 'Job Title', 'Location',
        'Minimum Salary', 'Maximum Salary', 'Salary Period', 'Job URL',
        'URL Status', 'Email Received Date', 'Email Source', 'Date Added',
        'Interest', 'Email Title', 'Jobs Found In Email', 'Employment Type'
      ];
      const oldRow = [
        'Acme', 'A company', 'Engineer', 'Boston',
        '90000', '120000', 'year', 'http://job',
        'OK', '2026-01-01', 'indeed', '2026-01-02',
        'High', 'Hot Jobs', '3', 'Full-Time'
      ];
      const sheet = makeSheetWith(oldHeaders, [oldRow]);

      const result = auditAndRepairSheetHeaders(sheet);

      expect(result.repaired).toBe(true);
      expect(result.rows).toBe(1);
      expect(readHeaderRow(sheet)).toEqual(FINAL_COLUMNS);
      // Safety snapshot contract (plan risk note): before/after headers reported
      expect(result.before).toEqual(oldHeaders);
      expect(result.after).toEqual(FINAL_COLUMNS);

      const row = readDataRow(sheet, 0);
      // Spot-check that values land under the correct FINAL header positions
      expect(row[FINAL_COLUMNS.indexOf('Company')]).toBe('Acme');
      expect(row[FINAL_COLUMNS.indexOf('Job Title')]).toBe('Engineer');
      expect(row[FINAL_COLUMNS.indexOf('Location')]).toBe('Boston');
      expect(row[FINAL_COLUMNS.indexOf('Employment Type')]).toBe('Full-Time');
      expect(row[FINAL_COLUMNS.indexOf('Email Title')]).toBe('Hot Jobs');
      // Columns absent in old sheet are inserted blank
      expect(row[FINAL_COLUMNS.indexOf('Work Arrangement')]).toBe('');
      expect(row[FINAL_COLUMNS.indexOf('Experience Level')]).toBe('');
    });

    it('drops legacy Careers URL columns while preserving all other data', () => {
      const legacyHeaders = [
        'Company', 'Company Description', 'Job Title', 'Employment Type',
        'Work Arrangement', 'Experience Level', 'Location',
        'Minimum Salary', 'Maximum Salary', 'Salary Period',
        'Job URL', 'URL Status', 'Careers URL', 'Careers URL Status',
        'Email Received Date', 'Email Source', 'Date Added',
        'Interest', 'Email Title', 'Jobs Found In Email'
      ];
      const legacyRow = [
        'Acme', 'desc', 'Dev', 'FT', 'Remote', 'Senior', 'NYC',
        '100', '200', 'year', 'http://job', 'OK',
        'http://careers', 'DEAD',
        '2026-01-01', 'src', '2026-01-02', 'Yes', 'Subject', '1'
      ];
      const sheet = makeSheetWith(legacyHeaders, [legacyRow]);

      const result = auditAndRepairSheetHeaders(sheet);

      expect(result.repaired).toBe(true);
      expect(readHeaderRow(sheet)).toEqual(FINAL_COLUMNS);

      const row = readDataRow(sheet, 0);
      // Careers URL values must be gone entirely
      expect(row).not.toContain('http://careers');
      expect(row).not.toContain('DEAD');
      // Other data preserved under correct headers
      expect(row[FINAL_COLUMNS.indexOf('Company')]).toBe('Acme');
      expect(row[FINAL_COLUMNS.indexOf('Job URL')]).toBe('http://job');
      expect(row[FINAL_COLUMNS.indexOf('URL Status')]).toBe('OK');
      expect(row[FINAL_COLUMNS.indexOf('Interest')]).toBe('Yes');
      expect(row[FINAL_COLUMNS.indexOf('Jobs Found In Email')]).toBe('1');
    });

    it('remaps data by name when headers are reordered (same names, different order)', () => {
      const reordered = [...FINAL_COLUMNS].reverse();
      // Row whose values match the reversed header order
      const reorderedRow = reordered.map(h => `val:${h}`);
      const sheet = makeSheetWith(reordered, [reorderedRow]);

      const result = auditAndRepairSheetHeaders(sheet);

      expect(result.repaired).toBe(true);
      expect(readHeaderRow(sheet)).toEqual(FINAL_COLUMNS);

      const row = readDataRow(sheet, 0);
      // Each datum must land under its own header name regardless of original position
      FINAL_COLUMNS.forEach((h, idx) => {
        expect(row[idx]).toBe(`val:${h}`);
      });
    });

    it('repairs a drifted header-only sheet (no data rows) to canonical headers with rows:0', () => {
      // Old/mis-ordered header row but zero data rows underneath.
      const oldHeadersNoData = [
        'Company', 'Job Title', 'Location', 'Job URL', 'URL Status',
        'Careers URL', 'Email Source', 'Date Added'
      ];
      const sheet = makeSheetWith(oldHeadersNoData, []);

      const result = auditAndRepairSheetHeaders(sheet);

      expect(result.repaired).toBe(true);
      expect(result.rows).toBe(0);
      expect(readHeaderRow(sheet)).toEqual(FINAL_COLUMNS);
      // No phantom data row introduced
      expect(sheet.getLastRow()).toBe(1);
    });

    it('throws loudly when data sits under an unnamed (blank) header column', () => {
      // A column with a BLANK header name but actual data underneath cannot be
      // name-mapped to any target column -> the value would be silently dropped.
      // The function must refuse and throw instead of guessing/dropping.
      const headersWithBlank = [...FINAL_COLUMNS];
      headersWithBlank[6] = ''; // blank out the 'Location' header name
      const row = FINAL_COLUMNS.map((h, i) => (i === 6 ? 'ORPHAN-DATA' : `v:${h}`));
      const sheet = makeSheetWith(headersWithBlank, [row]);

      expect(() => auditAndRepairSheetHeaders(sheet)).toThrow(/cannot reconcile/i);
    });
  });

  describe('row banding (native, applied once at header setup)', () => {
    it('applies a single LIGHT_GREY row banding when headers are set up', () => {
      const spreadsheet = new MockSpreadsheet('Test', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');

      setupSheetHeaders(sheet);

      const bandings = sheet.getBandings();
      expect(bandings.length).toBe(1);
      expect(bandings[0].theme).toBe(BandingTheme.LIGHT_GREY);
      // header=true (banding aware of header row), footer=false
      expect(bandings[0].showHeader).toBe(true);
      expect(bandings[0].showFooter).toBe(false);
    });

    it('is idempotent — re-running setupSheetHeaders does not stack multiple bandings', () => {
      const spreadsheet = new MockSpreadsheet('Test', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');

      setupSheetHeaders(sheet);
      setupSheetHeaders(sheet);
      setupSheetHeaders(sheet);

      expect(sheet.getBandings().length).toBe(1);
    });
  });

  describe('formatJobRow — no per-row striping', () => {
    it('does NOT set ANY per-row background (striping handled by native banding)', () => {
      const spreadsheet = new MockSpreadsheet('Test', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);
      // Append an even-numbered data row (the old code striped row % 2 === 0)
      sheet.appendRow(FINAL_COLUMNS.map((h) => `v:${h}`)); // row 2 (even)

      // Spy on every setBackground call across any range formatJobRow touches.
      // Asserting on the COUNT (not a specific color literal) prevents a false
      // pass where striping merely switched to a different colour.
      const bgColors = [];
      const origGetRange = sheet.getRange.bind(sheet);
      jest.spyOn(sheet, 'getRange').mockImplementation((...args) => {
        const r = origGetRange(...args);
        const origSetBackground = r.setBackground.bind(r);
        r.setBackground = jest.fn((color) => {
          bgColors.push(color);
          return origSetBackground(color);
        });
        return r;
      });

      realFormatJobRow(sheet, 2);

      // formatJobRow must apply NO row background at all (any colour would be striping).
      expect(bgColors).toHaveLength(0);
      // And specifically not the old striping colour.
      expect(bgColors).not.toContain('#f8f9fa');

      sheet.getRange.mockRestore();
    });
  });
});
