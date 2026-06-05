/**
 * Unit Tests for Sheets Handler Module
 * Tests spreadsheet operations for job listings
 */

const { MockSpreadsheetApp, MockSpreadsheet, MockSheet } = require('./mocks/spreadsheet.mock');
const { createJobData, createJobBatch } = require('./fixtures/job-factory');

// Setup mocks
beforeEach(() => {
  global.SpreadsheetApp = new MockSpreadsheetApp();
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
});

// Mock setColumnWidths and formatJobRow before loading the module
global.setColumnWidths = jest.fn();
global.formatJobRow = jest.fn();

const {
  addJobToSpreadsheet,
  setupSheetHeaders,
  formatDateTime,
  sanitizeString,
  getJobStatistics
} = require('../src/features/job-finder/sheets-handler');

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
});
