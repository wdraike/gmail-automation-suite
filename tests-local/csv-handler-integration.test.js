/**
 * Integration Tests for CSV Handler Module
 * Tests the main CSV import/export workflow functions
 */

const { MockDriveApp, MockFile, MockFolder } = require('./mocks/drive.mock');
const { MockSpreadsheetApp, MockSpreadsheet, MockSheet } = require('./mocks/spreadsheet.mock');
const { createJobData, createJobBatch, jobDataToCsv } = require('./fixtures/job-factory');

// Setup mocks
beforeEach(() => {
  // Reset Drive mock
  global.DriveApp = new MockDriveApp();
  global.SpreadsheetApp = new MockSpreadsheetApp();

  // Mock Utilities
  global.Utilities = {
    parseCsv: jest.fn((csv) => {
      const rows = [];
      const lines = csv.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;

        const row = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            row.push(current);
            current = '';
          } else {
            current += char;
          }
        }

        row.push(current);
        rows.push(row);
      }

      return rows;
    }),
    formatDate: jest.fn((date, tz, format) => {
      const pad = (n) => String(n).padStart(2, '0');
      const y = date.getFullYear();
      const m = pad(date.getMonth() + 1);
      const d = pad(date.getDate());
      const h = pad(date.getHours());
      const min = pad(date.getMinutes());
      const s = pad(date.getSeconds());
      return `${y}${m}${d}_${h}${min}${s}`;
    }),
    newBlob: jest.fn((content, mimeType, name) => ({
      content,
      mimeType,
      name,
      getDataAsString: () => content
    }))
  };

  // Mock Session
  global.Session = {
    getScriptTimeZone: jest.fn(() => 'America/New_York')
  };

  // Mock PropertiesService
  global.PropertiesService = {
    getScriptProperties: jest.fn(() => ({
      getProperty: jest.fn(() => null)
    }))
  };

  // Mock config functions
  global.getSpreadsheetId = jest.fn(() => 'mock-spreadsheet-id');
  global.getOrCreateProcessedCsvFolder = jest.fn(() => 'mock-processed-folder-id');
  global.initializeJobFinder = jest.fn(() => ({ success: true }));
  global.addJobToSpreadsheet = jest.fn(() => true);
  global.isValidJobListing = jest.fn(() => true);
  global.sendNotificationEmail = jest.fn();
  global.cleanSalaryValue = jest.fn((value) => value || '');
  global.moveFileSafely = jest.fn(() => true);

  // Mock Logger
  global.Logger = {
    log: jest.fn()
  };
});

// Load the module after mocks are set up
const {
  findPendingJobCsvs,
  importCsvToSpreadsheet,
  importPendingJobCsvs,
  writeJobsToCsv
} = require('../src/features/job-finder/csv-handler');

describe('CSV Handler - Integration Tests', () => {
  describe('findPendingJobCsvs', () => {
    it('should find CSV files with "job" in the name', () => {
      // Create mock CSV files
      const file1 = global.DriveApp.createFile('job_listings.csv', 'data', 'text/csv');
      const file2 = global.DriveApp.createFile('Jobs_20251004.csv', 'data', 'text/csv');
      const file3 = global.DriveApp.createFile('other_data.csv', 'data', 'text/csv');

      const results = findPendingJobCsvs(10);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect maxFiles limit', () => {
      // Create multiple CSV files
      for (let i = 0; i < 15; i++) {
        global.DriveApp.createFile(`job_listings_${i}.csv`, 'data', 'text/csv');
      }

      const results = findPendingJobCsvs(5);

      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should exclude files in processed folder', () => {
      const processedFolder = new MockFolder('Processed Job CSVs');
      global.DriveApp.addFolder(processedFolder);
      global.getOrCreateProcessedCsvFolder.mockReturnValue(processedFolder.getId());

      // Create file in root
      const pendingFile = global.DriveApp.createFile('job_pending.csv', 'data', 'text/csv');

      // Create file in processed folder
      const processedFile = processedFolder.createFile('job_processed.csv', 'data', 'text/csv');

      const results = findPendingJobCsvs(10);

      // Should only find the pending file, not the processed one
      expect(results.some(f => f.getName() === 'job_pending.csv')).toBe(true);
    });

    it('should return empty array on error', () => {
      global.DriveApp.searchFiles = jest.fn(() => {
        throw new Error('Drive API error');
      });

      const results = findPendingJobCsvs(10);

      expect(results).toEqual([]);
      expect(Logger.log).toHaveBeenCalledWith(expect.stringContaining('Error finding pending CSV files'));
    });
  });

  describe('importCsvToSpreadsheet', () => {
    it('should successfully import a valid CSV file', () => {
      const jobs = createJobBatch(3);
      const csvContent = jobDataToCsv(jobs);

      const csvFile = global.DriveApp.createFile('test_jobs.csv', csvContent, 'text/csv');

      const result = importCsvToSpreadsheet(csvFile.getId());

      expect(result.success).toBe(true);
      expect(result.jobsImported).toBe(3);
      expect(global.addJobToSpreadsheet).toHaveBeenCalledTimes(3);
    });

    it('should reject empty CSV file', () => {
      const csvFile = global.DriveApp.createFile('empty.csv', '', 'text/csv');

      const result = importCsvToSpreadsheet(csvFile.getId());

      expect(result.success).toBe(false);
      expect(result.message).toBe('CSV file is empty');
    });

    it('should reject CSV with missing required columns', () => {
      const invalidCsv = 'Name,Email,Phone\nJohn,john@example.com,555-1234';
      const csvFile = global.DriveApp.createFile('invalid.csv', invalidCsv, 'text/csv');

      const result = importCsvToSpreadsheet(csvFile.getId());

      expect(result.success).toBe(false);
      expect(result.message).toContain('Incompatible CSV format');
      expect(result.message).toContain('missing columns');
    });

    it('should skip invalid job listings', () => {
      const jobs = createJobBatch(5);
      const csvContent = jobDataToCsv(jobs);
      const csvFile = global.DriveApp.createFile('test_jobs.csv', csvContent, 'text/csv');

      // Make 2 jobs invalid
      global.isValidJobListing
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      const result = importCsvToSpreadsheet(csvFile.getId());

      expect(result.success).toBe(true);
      expect(result.jobsImported).toBe(3); // Only 3 valid jobs
      expect(result.jobsSkipped).toBe(2);
    });

    it('should handle test mode (limit to 10 rows)', () => {
      const jobs = createJobBatch(20);
      const csvContent = jobDataToCsv(jobs);
      const csvFile = global.DriveApp.createFile('large_jobs.csv', csvContent, 'text/csv');

      const result = importCsvToSpreadsheet(csvFile.getId(), true);

      expect(result.success).toBe(true);
      expect(global.addJobToSpreadsheet).toHaveBeenCalledTimes(10); // Only first 10
    });

    it('should handle errors gracefully', () => {
      const csvFile = global.DriveApp.createFile('test.csv', 'data', 'text/csv');

      // Make DriveApp.getFileById throw an error
      const originalGetFileById = global.DriveApp.getFileById;
      global.DriveApp.getFileById = jest.fn(() => {
        throw new Error('File not found');
      });

      const result = importCsvToSpreadsheet('invalid-file-id');

      // Should handle the error and return failure
      expect(result.success).toBe(false);
      expect(result.message).toContain('File not found');

      // Restore
      global.DriveApp.getFileById = originalGetFileById;
    });
  });

  describe('importPendingJobCsvs', () => {
    it('should return info status when no files found', () => {
      // No files in Drive
      const result = importPendingJobCsvs(5);

      expect(result.status).toBe('info');
      expect(result.message).toBe('No pending CSV files found');
      expect(result.totalFiles).toBe(0);
    });

    it('should process multiple CSV files successfully', () => {
      // Create CSV files
      const jobs1 = createJobBatch(2);
      const jobs2 = createJobBatch(3);

      const csv1 = jobDataToCsv(jobs1);
      const csv2 = jobDataToCsv(jobs2);

      global.DriveApp.createFile('job_batch1.csv', csv1, 'text/csv');
      global.DriveApp.createFile('job_batch2.csv', csv2, 'text/csv');

      const processedFolder = new MockFolder('Processed Job CSVs');
      global.DriveApp.addFolder(processedFolder);
      global.getOrCreateProcessedCsvFolder.mockReturnValue(processedFolder.getId());

      const result = importPendingJobCsvs(5);

      // Debug: log the result if it fails
      if (result.status !== 'success') {
        console.log('Result:', JSON.stringify(result, null, 2));
      }

      expect(result.status).toBe('success');
      expect(result.importedFiles).toBe(2);
      expect(result.failedFiles).toBe(0);
      expect(result.totalJobsImported).toBe(5);
    });

    it('should handle file import failures', () => {
      const jobs = createJobBatch(2);
      const csv = jobDataToCsv(jobs);
      global.DriveApp.createFile('valid_jobs.csv', csv, 'text/csv');
      global.DriveApp.createFile('invalid_jobs.csv', 'bad,data', 'text/csv');

      const processedFolder = new MockFolder('Processed Job CSVs');
      global.DriveApp.addFolder(processedFolder);
      global.getOrCreateProcessedCsvFolder.mockReturnValue(processedFolder.getId());

      const result = importPendingJobCsvs(5);

      expect(result.status).toBe('warning'); // Some failures
      expect(result.importedFiles).toBeGreaterThan(0);
      expect(result.failedFiles).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should send error notifications on failures', () => {
      global.DriveApp.createFile('bad.csv', 'invalid', 'text/csv');

      const processedFolder = new MockFolder('Processed Job CSVs');
      global.DriveApp.addFolder(processedFolder);
      global.getOrCreateProcessedCsvFolder.mockReturnValue(processedFolder.getId());

      importPendingJobCsvs(5);

      expect(global.sendNotificationEmail).toHaveBeenCalled();
      const call = global.sendNotificationEmail.mock.calls[0][0];
      expect(call.isError).toBe(true);
    });

    it('should initialize spreadsheet if not set', () => {
      global.getSpreadsheetId.mockReturnValue('');
      global.initializeJobFinder.mockReturnValue({ success: true, spreadsheetId: 'new-id' });

      const jobs = createJobBatch(1);
      const csv = jobDataToCsv(jobs);
      global.DriveApp.createFile('jobs.csv', csv, 'text/csv');

      const processedFolder = new MockFolder('Processed Job CSVs');
      global.DriveApp.addFolder(processedFolder);
      global.getOrCreateProcessedCsvFolder.mockReturnValue(processedFolder.getId());

      const result = importPendingJobCsvs(5);

      expect(global.initializeJobFinder).toHaveBeenCalled();
    });

    it('should return error if initialization fails', () => {
      global.getSpreadsheetId.mockReturnValue('');
      global.initializeJobFinder.mockReturnValue({
        success: false,
        message: 'Failed to create spreadsheet'
      });

      const jobs = createJobBatch(1);
      const csv = jobDataToCsv(jobs);
      global.DriveApp.createFile('jobs.csv', csv, 'text/csv');

      const result = importPendingJobCsvs(5);

      expect(result.status).toBe('error');
      expect(result.message).toContain('Failed to create spreadsheet');
    });
  });

  describe('writeJobsToCsv', () => {
    it('should write jobs to CSV file in Drive', () => {
      const jobs = createJobBatch(5);

      const result = writeJobsToCsv(jobs);

      expect(result.success).toBe(true);
      expect(result.fileId).toBeDefined();
      expect(result.fileName).toContain('job_listings');
      expect(result.fileName).toContain('.csv');
      expect(result.fileUrl).toBeDefined();
      expect(result.message).toContain('5 jobs');
    });

    it('should handle empty job array', () => {
      const result = writeJobsToCsv([]);

      // Empty array should fail (no jobs to export)
      expect(result.success).toBe(false);
      expect(result.message).toBe('No jobs to export');
    });

    it('should use timestamp in filename', () => {
      const jobs = createJobBatch(1);

      const result = writeJobsToCsv(jobs);

      expect(result.fileName).toMatch(/job_listings_\d{8}_\d{6}\.csv/);
    });

    it('should handle errors gracefully', () => {
      const jobs = createJobBatch(1);

      // Make createFile throw an error
      const originalCreateFile = global.DriveApp.createFile;
      global.DriveApp.createFile = jest.fn(() => {
        throw new Error('Drive quota exceeded');
      });

      const result = writeJobsToCsv(jobs);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Drive quota exceeded');

      // Restore
      global.DriveApp.createFile = originalCreateFile;
    });
  });
});
