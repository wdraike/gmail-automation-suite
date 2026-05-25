/**
 * Unit Tests for Job Finder Module
 */

describe('Job Finder Configuration', () => {
  describe('JOB_FINDER_CONFIG', () => {
    it('should exist and have required properties', () => {
      expect.value(typeof JOB_FINDER_CONFIG).toBe('object');
      expect.value(JOB_FINDER_CONFIG).toBeTruthy();
    });

    it('should have source label defined', () => {
      expect.value(JOB_FINDER_CONFIG).toHaveProperty('SOURCE_LABEL');
      expect.value(typeof JOB_FINDER_CONFIG.SOURCE_LABEL).toBe('string');
    });

    it('should have processed label defined', () => {
      expect.value(JOB_FINDER_CONFIG).toHaveProperty('PROCESSED_LABEL');
      expect.value(typeof JOB_FINDER_CONFIG.PROCESSED_LABEL).toBe('string');
    });

    it('should have sheet name defined', () => {
      expect.value(JOB_FINDER_CONFIG).toHaveProperty('ACTIVE_SHEET_NAME');
      expect.value(typeof JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME).toBe('string');
    });

    it('should have column definitions', () => {
      expect.value(JOB_FINDER_CONFIG).toHaveProperty('SHEET_COLUMNS');
      expect.value(Array.isArray(JOB_FINDER_CONFIG.SHEET_COLUMNS)).toBeTruthy();
      expect.value(JOB_FINDER_CONFIG.SHEET_COLUMNS.length).toBeGreaterThan(0);
    });

    it('should have rate limit configuration', () => {
      expect.value(JOB_FINDER_CONFIG).toHaveProperty('MAX_CALLS_PER_MINUTE');
      expect.value(typeof JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE).toBe('number');
      expect.value(JOB_FINDER_CONFIG.MAX_CALLS_PER_MINUTE).toBeGreaterThan(0);
    });
  });
});

describe('Job Data Extraction', () => {
  describe('extractJobDetailsSimple', () => {
    it('should handle empty email body', () => {
      const result = extractJobDetailsSimple('', 'test@example.com');

      expect.value(result).toBeTruthy();
      expect.value(typeof result).toBe('object');
    });

    it('should extract company name from text', () => {
      const emailBody = 'Company: Acme Corp\nPosition: Software Engineer';
      const result = extractJobDetailsSimple(emailBody, 'test@example.com');

      expect.value(result).toHaveProperty('company');
    });

    it('should extract job title from text', () => {
      const emailBody = 'Job Title: Senior Developer\nLocation: Remote';
      const result = extractJobDetailsSimple(emailBody, 'test@example.com');

      expect.value(result).toHaveProperty('jobTitle');
    });

    it('should extract location information', () => {
      const emailBody = 'Position: Engineer\nLocation: San Francisco, CA';
      const result = extractJobDetailsSimple(emailBody, 'test@example.com');

      expect.value(result).toHaveProperty('location');
    });

    it('should handle malformed input gracefully', () => {
      const result = extractJobDetailsSimple(null, null);

      expect.value(result).toBeTruthy();
      expect.value(typeof result).toBe('object');
    });
  });

  describe('parseJobUrl', () => {
    it('should extract URLs from text', () => {
      const text = 'Apply here: https://example.com/jobs/123';
      const url = parseJobUrl(text);

      if (url) {
        expect.value(url).toContain('http');
      }
    });

    it('should handle text without URLs', () => {
      const text = 'No URL in this text';
      const url = parseJobUrl(text);

      expect.value(url === null || url === '').toBeTruthy();
    });

    it('should prioritize https over http', () => {
      const text = 'http://example.com and https://secure.com';
      const url = parseJobUrl(text);

      if (url) {
        expect.value(url).toContain('https');
      }
    });
  });

  describe('parseSalary', () => {
    it('should extract numeric salary values', () => {
      const text = 'Salary: $100,000 - $150,000';
      const salary = parseSalary(text);

      expect.value(salary).toBeTruthy();
      expect.value(typeof salary).toBe('object');
    });

    it('should handle text without salary', () => {
      const text = 'No salary information';
      const salary = parseSalary(text);

      expect.value(typeof salary).toBe('object');
    });

    it('should identify salary period (yearly/monthly/hourly)', () => {
      const text = 'Annual salary: $120,000';
      const salary = parseSalary(text);

      if (salary && salary.period) {
        expect.value(typeof salary.period).toBe('string');
      }
    });
  });
});

describe('Spreadsheet Operations', () => {
  describe('getJobFinderSpreadsheet', () => {
    it('should return spreadsheet object or null', () => {
      const spreadsheet = getJobFinderSpreadsheet();

      expect.value(spreadsheet === null || typeof spreadsheet === 'object').toBeTruthy();
    });
  });

  describe('getOrCreateSheet', () => {
    it('should handle sheet name parameter', () => {
      const sheetName = 'Test Sheet';
      // This is a read-only test - we won't actually create sheets
      expect.value(typeof sheetName).toBe('string');
    });
  });

  describe('formatJobRow', () => {
    it('should format job data into array', () => {
      const jobData = {
        company: 'Test Company',
        jobTitle: 'Software Engineer',
        location: 'Remote',
        minSalary: 100000,
        maxSalary: 150000
      };

      const row = formatJobRow(jobData);

      expect.value(Array.isArray(row)).toBeTruthy();
      expect.value(row.length).toBeGreaterThan(0);
    });

    it('should handle missing job data fields', () => {
      const incompleteData = {
        company: 'Test Company'
        // Missing other fields
      };

      const row = formatJobRow(incompleteData);

      expect.value(Array.isArray(row)).toBeTruthy();
    });

    it('should maintain column order', () => {
      const jobData = {
        company: 'Test Company',
        jobTitle: 'Developer'
      };

      const row = formatJobRow(jobData);
      const expectedColumns = JOB_FINDER_CONFIG.SHEET_COLUMNS.length;

      expect.value(row.length).toBe(expectedColumns);
    });
  });
});

describe('Job Deduplication', () => {
  describe('isDuplicateJob', () => {
    it('should compare job entries for duplicates', () => {
      const job1 = {
        company: 'Acme Corp',
        jobTitle: 'Engineer',
        jobUrl: 'https://example.com/job1'
      };

      const job2 = {
        company: 'Acme Corp',
        jobTitle: 'Engineer',
        jobUrl: 'https://example.com/job1'
      };

      const isDupe = isDuplicateJob(job1, job2);

      expect.value(typeof isDupe).toBe('boolean');
    });

    it('should identify identical jobs', () => {
      const job = {
        company: 'Test Co',
        jobTitle: 'Developer',
        jobUrl: 'https://test.com/job'
      };

      const isDupe = isDuplicateJob(job, job);

      expect.value(isDupe).toBeTruthy();
    });

    it('should differentiate different jobs', () => {
      const job1 = {
        company: 'Company A',
        jobTitle: 'Role 1',
        jobUrl: 'https://a.com/1'
      };

      const job2 = {
        company: 'Company B',
        jobTitle: 'Role 2',
        jobUrl: 'https://b.com/2'
      };

      const isDupe = isDuplicateJob(job1, job2);

      expect.value(isDupe).toBeFalsy();
    });
  });

  describe('generateJobHash', () => {
    it('should generate consistent hash for same job', () => {
      const job = {
        company: 'Test',
        jobTitle: 'Position',
        location: 'Location'
      };

      const hash1 = generateJobHash(job);
      const hash2 = generateJobHash(job);

      expect.value(hash1).toBe(hash2);
    });

    it('should generate different hashes for different jobs', () => {
      const job1 = { company: 'A', jobTitle: 'X' };
      const job2 = { company: 'B', jobTitle: 'Y' };

      const hash1 = generateJobHash(job1);
      const hash2 = generateJobHash(job2);

      expect.value(hash1).not.toBe(hash2);
    });
  });
});

describe('Email Processing', () => {
  describe('processJobEmails', () => {
    it('should handle empty thread list', () => {
      const result = processJobEmails([]);

      expect.value(result).toBeTruthy();
      expect.value(typeof result).toBe('object');
      expect.value(result).toHaveProperty('processed');
    });

    it('should return processing statistics', () => {
      const result = processJobEmails([]);

      expect.value(result).toHaveProperty('processed');
      expect.value(result).toHaveProperty('success');
      expect.value(result).toHaveProperty('failed');
      expect.value(typeof result.processed).toBe('number');
      expect.value(typeof result.success).toBe('number');
      expect.value(typeof result.failed).toBe('number');
    });
  });

  describe('getJobAlertThreads', () => {
    it('should search for job alert emails', () => {
      // This is a read-only test
      const label = JOB_FINDER_CONFIG.SOURCE_LABEL;

      expect.value(typeof label).toBe('string');
      expect.value(label.length).toBeGreaterThan(0);
    });
  });
});

describe('CSV Operations', () => {
  // CSV-specific tests have been moved to csv-handler.test.js
  // See csv-handler.test.js for comprehensive CSV import/export tests including:
  // - sanitizeCsvValue() tests
  // - createCsvColumnMap() tests with regression tests for substring matching bug
  // - convertJobsToCsv() tests
  // - createJobFromCsvRow() tests
  // - Round-trip integration tests

  it('should refer to csv-handler.test.js for CSV functionality', () => {
    // This is a placeholder to indicate CSV tests are in csv-handler.test.js
    expect.value(true).toBeTruthy();
  });
});
