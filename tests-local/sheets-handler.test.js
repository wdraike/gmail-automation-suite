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

    it('treats a sheet with rows but zero columns as empty (lastColumn guard)', () => {
      // getLastRow() >= 1 but getLastColumn() === 0 -> the `lastColumn < 1` operand
      // of the empty-sheet guard is evaluated (not short-circuited by lastRow).
      const setupCalls = [];
      const stubSheet = {
        getLastRow: () => 1,
        getLastColumn: () => 0,
        getRange: () => ({
          setValues: () => stubSheet.getRange(),
          setFontWeight: () => stubSheet.getRange(),
          setBackground: () => stubSheet.getRange(),
          setFontColor: () => stubSheet.getRange(),
          getValues: () => [[]],
        }),
        setFrozenRows: () => { setupCalls.push('freeze'); },
        getMaxRows: () => 10,
        getBandings: () => [],
        setColumnWidth: () => {},
      };
      const result = auditAndRepairSheetHeaders(stubSheet);
      expect(result.repaired).toBe(false);
      expect(result.reason).toBe('empty');
    });

    it('remaps a null source cell to an empty string (value null-coalesce arm)', () => {
      const reordered = [...FINAL_COLUMNS].reverse();
      const reorderedRow = reordered.map(h => `val:${h}`);
      reorderedRow[0] = null; // a null source cell -> the `value === null` true arm
      const sheet = makeSheetWith(reordered, [reorderedRow]);
      const result = auditAndRepairSheetHeaders(sheet);
      expect(result.repaired).toBe(true);
      // The column that was null in the source becomes "" in the canonical grid.
      const row = readDataRow(sheet, 0);
      const nulledHeaderName = reordered[0]; // last canonical column (reversed first)
      expect(row[FINAL_COLUMNS.indexOf(nulledHeaderName)]).toBe('');
    });

    it('tolerates a data row wider than the live header row (empty trailing cells)', () => {
      // Live headers narrower than a data row; the extra trailing cell is empty so
      // the blank-header check passes, exercising the `c < liveHeaders.length ? : ""`
      // false arm without throwing.
      const reordered = [...FINAL_COLUMNS].reverse();
      const sheet = makeSheetWith(reordered, []);
      // Write a data row one cell WIDER than the header row, trailing cell empty.
      const wideRow = [...reordered.map(h => `v:${h}`), ''];
      sheet.getRange(2, 1, 1, wideRow.length).setValues([wideRow]);
      const result = auditAndRepairSheetHeaders(sheet);
      expect(result.repaired).toBe(true);
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

  describe('addJobToSpreadsheet defaults + ternaries', () => {
    it('fills every column with its empty/Unknown default for a bare job, using fn params', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);
      // Bare job (no fields) -> exercises every `job["X"] || default` right arm and
      // the emailDate/emailSource/emailTitle/jobsInEmail parameter ternaries.
      const ok = addJobToSpreadsheet({}, new Date('2026-01-01'), 'indeed', 'Subject', 3);
      expect(ok).toBe(true);
      const row = sheet.getRange(2, 1, 1, FINAL_COLUMNS.length).getValues()[0];
      const idx = (name) => FINAL_COLUMNS.indexOf(name);
      expect(row[idx('Company')]).toBe('');
      expect(row[idx('Employment Type')]).toBe('Unknown');
      expect(row[idx('Work Arrangement')]).toBe('Unknown');
      expect(row[idx('Experience Level')]).toBe('Unknown');
      expect(row[idx('Email Source')]).toBe('indeed');
      expect(row[idx('Email Title')]).toBe('Subject');
      expect(row[idx('Jobs Found In Email')]).toBe(3);
      expect(row[idx('Email Received Date')]).not.toBe('');
    });

    it('leaves Email Received Date empty when no emailDate is provided', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);
      addJobToSpreadsheet({}); // emailDate null -> `emailDate ? ... : ""` false arm
      const row = sheet.getRange(2, 1, 1, FINAL_COLUMNS.length).getValues()[0];
      expect(row[FINAL_COLUMNS.indexOf('Email Received Date')]).toBe('');
    });

    it('leaves Jobs Found In Email empty when neither the job field nor the param is set', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);
      // jobsInEmail=0 (falsy) + no job field -> the final `|| ""` arm.
      addJobToSpreadsheet({}, null, '', '', 0);
      const row = sheet.getRange(2, 1, 1, FINAL_COLUMNS.length).getValues()[0];
      expect(row[FINAL_COLUMNS.indexOf('Jobs Found In Email')]).toBe('');
    });

    it('returns the empty-string default for a SHEET_COLUMN not in the switch', () => {
      const saved = global.JOB_FINDER_CONFIG.SHEET_COLUMNS;
      global.JOB_FINDER_CONFIG.SHEET_COLUMNS = [...saved, 'Unhandled Column'];
      try {
        const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
        global.SpreadsheetApp.addSpreadsheet(spreadsheet);
        const sheet = spreadsheet.insertSheet('Job Listings');
        setupSheetHeaders(sheet);
        const ok = addJobToSpreadsheet({ Company: 'Acme' });
        expect(ok).toBe(true);
        const row = sheet.getRange(2, 1, 1, global.JOB_FINDER_CONFIG.SHEET_COLUMNS.length).getValues()[0];
        // The unhandled column hits the switch `default: return ""`.
        expect(row[global.JOB_FINDER_CONFIG.SHEET_COLUMNS.indexOf('Unhandled Column')]).toBe('');
      } finally {
        global.JOB_FINDER_CONFIG.SHEET_COLUMNS = saved;
      }
    });
  });

  describe('getJobStatistics edge cases', () => {
    it('returns an error object when no spreadsheet is configured', () => {
      global.getJobFinderSpreadsheetId.mockReturnValue('');
      const stats = getJobStatistics();
      expect(stats.error).toContain('No spreadsheet');
    });

    it('returns zeroed stats when the sheet is empty (only headers)', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet); // header row only, no data
      const stats = getJobStatistics();
      expect(stats.totalJobs).toBe(0);
      expect(stats.bySource).toEqual({});
    });

    it('counts companies/locations/salary and groups by source for populated data', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);
      addJobToSpreadsheet({ Company: 'Acme', Location: 'NYC', 'Minimum Salary': 100, 'Email Source': 'indeed' });
      addJobToSpreadsheet({ Company: 'Acme', Location: 'SF', 'Email Source': 'indeed' }); // no salary, dup company
      addJobToSpreadsheet({ Company: 'Beta', Location: 'NYC' }); // no source -> "Unknown"
      // A row with NO company and NO location -> the `if (row[companyCol])` /
      // `if (row[locationCol])` FALSE arms.
      addJobToSpreadsheet({ 'Email Source': 'glassdoor' });
      const stats = getJobStatistics();
      expect(stats.totalJobs).toBe(4);
      expect(stats.companies).toBe(2);   // Acme, Beta (blank not counted)
      expect(stats.locations).toBe(2);   // NYC, SF (blank not counted)
      expect(stats.withSalary).toBe(1);
      expect(stats.bySource.indeed).toBe(2);
      expect(stats.bySource.Unknown).toBe(1);
      expect(stats.bySource.glassdoor).toBe(1);
    });

    it('returns an error object when the spreadsheet access throws (catch)', () => {
      global.getJobFinderSpreadsheetId.mockReturnValue('test-spreadsheet-id');
      global.SpreadsheetApp.openById = jest.fn(() => { throw new Error('open boom'); });
      serviceFactory.reset();
      const stats = getJobStatistics();
      expect(stats.error).toContain('open boom');
    });
  });

  describe('formatDateTime catch', () => {
    it('falls back to date.toString() when the Utilities port throws', () => {
      global.Utilities = { formatDate: jest.fn(() => { throw new Error('fmt boom'); }) };
      global.Session = { getScriptTimeZone: jest.fn(() => 'GMT') };
      serviceFactory.reset();
      const d = new Date('2026-01-01T00:00:00Z');
      expect(formatDateTime(d)).toBe(d.toString());
    });
  });

  describe('setColumnWidths unknown header', () => {
    it('applies the 100px default width for an unmapped header', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');
      const setColumnWidth = jest.fn();
      sheet.setColumnWidth = setColumnWidth;
      // sheetsHandler.setColumnWidths is exported.
      sheetsHandler.setColumnWidths(sheet, ['Company', 'Totally Unmapped']);
      expect(setColumnWidth).toHaveBeenCalledWith(1, 150); // Company mapped
      expect(setColumnWidth).toHaveBeenCalledWith(2, 100); // unmapped -> default 100
    });
  });

  describe('formatJobRow salary + URL formatting', () => {
    function sheetWithRow(rowValues) {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');
      sheet.getRange(1, 1, 1, FINAL_COLUMNS.length).setValues([FINAL_COLUMNS]);
      sheet.getRange(2, 1, 1, rowValues.length).setValues([rowValues]);
      return sheet;
    }

    it('formats numeric salary cells and a hyperlink URL without error', () => {
      // Captures setNumberFormat / setFormula calls across every range the
      // function touches (the mock returns a fresh range per getRange call, so we
      // wrap getRange to record the relevant setter invocations).
      const idx = (n) => FINAL_COLUMNS.indexOf(n);
      const row = FINAL_COLUMNS.map(() => '');
      row[idx('Minimum Salary')] = 100000;
      row[idx('Maximum Salary')] = 150000;
      row[idx('Job URL')] = 'https://acme.com/jobs/1';
      const sheet = sheetWithRow(row);

      const numberFormats = [];
      const formulas = [];
      const origGetRange = sheet.getRange.bind(sheet);
      jest.spyOn(sheet, 'getRange').mockImplementation((...args) => {
        const r = origGetRange(...args);
        const origFmt = r.setNumberFormat.bind(r);
        const origFormula = r.setFormula ? r.setFormula.bind(r) : null;
        r.setNumberFormat = (f) => { numberFormats.push(f); return origFmt(f); };
        if (origFormula) r.setFormula = (f) => { formulas.push(f); return origFormula(f); };
        return r;
      });

      realFormatJobRow(sheet, 2);
      sheet.getRange.mockRestore();

      // Both salary cells were numeric -> currency format applied twice.
      expect(numberFormats.filter(f => f === '$#,##0').length).toBe(2);
      // The http URL produced a HYPERLINK formula.
      expect(formulas.some(f => /^=HYPERLINK\("https:\/\/acme\.com\/jobs\/1"/.test(f))).toBe(true);
    });

    it('skips salary formatting for non-numeric salary values', () => {
      const idx = (n) => FINAL_COLUMNS.indexOf(n);
      const row = FINAL_COLUMNS.map(() => '');
      row[idx('Minimum Salary')] = 'Competitive'; // non-numeric -> isNaN -> skip
      row[idx('Job URL')] = 'mailto:x@y.com';     // not http -> skip hyperlink
      const sheet = sheetWithRow(row);
      const numberFormats = [];
      const origGetRange = sheet.getRange.bind(sheet);
      jest.spyOn(sheet, 'getRange').mockImplementation((...args) => {
        const r = origGetRange(...args);
        const origFmt = r.setNumberFormat.bind(r);
        r.setNumberFormat = (f) => { numberFormats.push(f); return origFmt(f); };
        return r;
      });
      realFormatJobRow(sheet, 2);
      sheet.getRange.mockRestore();
      expect(numberFormats).not.toContain('$#,##0');
    });

    it('swallows errors thrown during formatting (catch)', () => {
      const sheet = {
        getLastColumn: () => { throw new Error('cols boom'); }
      };
      expect(() => realFormatJobRow(sheet, 2)).not.toThrow();
    });

    it('skips salary/url formatting when those columns are absent from the header row', () => {
      // Header row has none of Minimum/Maximum Salary or Job URL -> indexOf is -1,
      // so minSalaryCol/maxSalaryCol/jobUrlCol are 0 -> every `if (col > 0)` FALSE.
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');
      sheet.getRange(1, 1, 1, 2).setValues([['Company', 'Job Title']]);
      sheet.getRange(2, 1, 1, 2).setValues([['Acme', 'Dev']]);
      expect(() => realFormatJobRow(sheet, 2)).not.toThrow();
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });
    it('resolves the GAS-global serviceFactory when present', () => {
      global.serviceFactory = serviceFactory;
      global.getJobFinderSpreadsheetId.mockReturnValue('');
      // getJobStatistics -> _shSheets() only after the id check; use formatDateTime
      // which calls _shUtils() to exercise the seam.
      global.Utilities = { formatDate: jest.fn(() => 'D'), getScriptTimeZone: jest.fn(() => 'GMT') };
      serviceFactory.reset();
      global.serviceFactory = serviceFactory;
      expect(formatDateTime(new Date('2026-01-01'))).toBe('D');
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
