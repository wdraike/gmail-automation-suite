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

  // Mock config
  global.JOB_FINDER_CONFIG = {
    ACTIVE_SHEET_NAME: 'Job Listings',
    BACKUP_SHEET_NAME: 'Duplicates',
    SHEET_COLUMNS: [
      'Company', 'Company Description', 'Job Title', 'Location',
      'Minimum Salary', 'Maximum Salary', 'Salary Period',
      'Job URL', 'URL Status', 'Careers URL', 'Careers URL Status',
      'Email Received Date', 'Email Source', 'Date Added',
      'Interest', 'Email Title', 'Jobs Found In Email'
    ]
  };

  global.getSpreadsheetId = jest.fn(() => 'test-spreadsheet-id');
});

// Mock setColumnWidths and formatJobRow before loading the module
global.setColumnWidths = jest.fn();
global.formatJobRow = jest.fn();

const {
  addJobToSpreadsheet,
  setupSheetHeaders,
  formatDateTime,
  sanitizeString,
  createJobSignature,
  isDuplicateJob,
  getExistingJobs,
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

  describe('createJobSignature', () => {
    it('should create consistent signature for same job', () => {
      const sig1 = createJobSignature('Acme Corp', 'Engineer', 'NYC');
      const sig2 = createJobSignature('Acme Corp', 'Engineer', 'NYC');

      expect(sig1).toBe(sig2);
    });

    it('should create different signatures for different jobs', () => {
      const sig1 = createJobSignature('Acme', 'Engineer', 'NYC');
      const sig2 = createJobSignature('TechCo', 'Developer', 'SF');

      expect(sig1).not.toBe(sig2);
    });

    it('should normalize whitespace and case', () => {
      const sig1 = createJobSignature('ACME  CORP', 'engineer', 'New York');
      const sig2 = createJobSignature('acme corp', 'Engineer', 'new york');

      expect(sig1).toBe(sig2);
    });

    it('should handle null/undefined values', () => {
      const sig = createJobSignature(null, undefined, '');
      expect(sig).toBe('--');
    });
  });

  describe('setupSheetHeaders', () => {
    it('should set up headers with formatting', () => {
      const spreadsheet = new MockSpreadsheet('Test', 'test-id');
      const sheet = spreadsheet.insertSheet('Job Listings');

      setupSheetHeaders(sheet);

      // Check headers were set
      const headerRow = sheet.getRange(1, 1, 1, 17).getValues()[0];
      expect(headerRow[0]).toBe('Company');
      expect(headerRow[2]).toBe('Job Title');
      expect(headerRow.length).toBe(17);

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

      const result = addJobToSpreadsheet(job, false);

      expect(result).toBe(true);
      expect(sheet.getLastRow()).toBe(2); // Header + 1 job

      const data = sheet.getRange(2, 1, 1, 3).getValues()[0];
      expect(data[0]).toBe('Test Corp');
      expect(data[2]).toBe('Developer');
    });

    it('should add duplicate to backup sheet', () => {
      const job = createJobData({ company: 'Acme' });

      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);

      const result = addJobToSpreadsheet(job, true);

      expect(result).toBe(true);
      const duplicateSheet = spreadsheet.getSheetByName('Duplicates');
      expect(duplicateSheet).toBeTruthy();
      expect(duplicateSheet.getLastRow()).toBeGreaterThan(0);
    });

    it('should return false when no spreadsheet ID', () => {
      global.getSpreadsheetId.mockReturnValue('');

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

  describe('getExistingJobs', () => {
    it('should retrieve all jobs from spreadsheet', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);

      const sheet = spreadsheet.insertSheet('Job Listings');
      setupSheetHeaders(sheet);

      // Add some jobs
      const jobs = createJobBatch(3);
      jobs.forEach(job => addJobToSpreadsheet(job));

      const existingJobs = getExistingJobs();

      expect(existingJobs.length).toBe(3);
    });

    it('should return empty array when sheet is empty', () => {
      const spreadsheet = new MockSpreadsheet('Jobs', 'test-spreadsheet-id');
      global.SpreadsheetApp.addSpreadsheet(spreadsheet);
      spreadsheet.insertSheet('Job Listings');

      const existingJobs = getExistingJobs();

      expect(Array.isArray(existingJobs)).toBe(true);
      expect(existingJobs.length).toBe(0);
    });
  });

  describe('isDuplicateJob', () => {
    it('should detect duplicate jobs', () => {
      const job1 = createJobData({ company: 'Acme', jobTitle: 'Engineer', location: 'NYC' });
      const job2 = createJobData({ company: 'Acme', jobTitle: 'Engineer', location: 'NYC' });

      const existingJobs = [
        { signature: createJobSignature('Acme', 'Engineer', 'NYC') }
      ];

      const isDupe = isDuplicateJob(job2, existingJobs);

      expect(isDupe).toBe(true);
    });

    it('should not flag unique jobs as duplicates', () => {
      const job1 = createJobData({ company: 'Acme', jobTitle: 'Engineer', location: 'NYC' });
      const job2 = createJobData({ company: 'TechCo', jobTitle: 'Developer', location: 'SF' });

      const existingJobs = [
        { signature: createJobSignature('Acme', 'Engineer', 'NYC') }
      ];

      const isDupe = isDuplicateJob(job2, existingJobs);

      expect(isDupe).toBe(false);
    });

    it('should handle empty existing jobs list', () => {
      const job = createJobData({ company: 'Acme', jobTitle: 'Engineer' });
      const isDupe = isDuplicateJob(job, []);

      expect(isDupe).toBe(false);
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
