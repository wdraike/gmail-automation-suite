/**
 * Unit Tests for CSV Handler Module
 *
 * These tests verify CSV import/export functionality and prevent regression
 * of critical bugs like substring matching in column mapping.
 */

// Mock cleanSalaryValue function (defined in extractor.js but used by csv-handler)
global.cleanSalaryValue = (value) => value || '';

const {
  sanitizeCsvValue,
  createCsvColumnMap,
  convertJobsToCsv,
  createJobFromCsvRow
} = require('../src/features/job-finder/csv-handler');

describe('CSV Value Sanitization', () => {
  describe('sanitizeCsvValue', () => {
    it('should return empty string for null', () => {
      const result = sanitizeCsvValue(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = sanitizeCsvValue(undefined);
      expect(result).toBe('');
    });

    it('should return simple values unchanged', () => {
      const result = sanitizeCsvValue('Simple Text');
      expect(result).toBe('Simple Text');
    });

    it('should convert numbers to strings', () => {
      const result = sanitizeCsvValue(12345);
      expect(result).toBe('12345');
    });

    it('should quote values containing commas', () => {
      const result = sanitizeCsvValue('Richmond, VA');
      expect(result).toBe('"Richmond, VA"');
    });

    it('should quote and escape values containing quotes', () => {
      const result = sanitizeCsvValue('Director "Senior" Engineer');
      expect(result).toBe('"Director ""Senior"" Engineer"');
    });

    it('should quote values containing newlines', () => {
      const result = sanitizeCsvValue('Line1\nLine2');
      expect(result).toBe('"Line1\nLine2"');
    });

    it('should handle values with both commas and quotes', () => {
      const result = sanitizeCsvValue('Company, Inc. "The Best"');
      expect(result).toBe('"Company, Inc. ""The Best"""');
    });

    it('should handle empty strings', () => {
      const result = sanitizeCsvValue('');
      expect(result).toBe('');
    });
  });
});

describe('CSV Column Mapping', () => {
  describe('createCsvColumnMap', () => {
    it('should map exact header matches to correct indices', () => {
      const headers = ['Company', 'Job Title', 'Location'];
      const map = createCsvColumnMap(headers);

      expect(map.company).toBe(0);
      expect(map.jobTitle).toBe(1);
      expect(map.location).toBe(2);
    });

    it('should be case insensitive', () => {
      const headers = ['COMPANY', 'job title', 'LoCaTiOn'];
      const map = createCsvColumnMap(headers);

      expect(map.company).toBe(0);
      expect(map.jobTitle).toBe(1);
      expect(map.location).toBe(2);
    });

    it('should handle alternative header names', () => {
      const headers = ['Employer', 'Position', 'City'];
      const map = createCsvColumnMap(headers);

      expect(map.company).toBe(0); // "employer" is an alternative
      expect(map.jobTitle).toBe(1); // "position" is an alternative
      expect(map.location).toBe(2); // "city" is an alternative
    });

    it('should NOT match substrings (regression test)', () => {
      const headers = ['Company', 'Company Description'];
      const map = createCsvColumnMap(headers);

      // CRITICAL: "Company Description" should NOT match company field
      expect(map.company).toBe(0);
      expect(map.description).toBe(1);
    });

    it('should NOT match "Jobs Found In Email" to jobTitle field (regression test)', () => {
      const headers = ['Company', 'Job Title', 'Jobs Found In Email'];
      const map = createCsvColumnMap(headers);

      // CRITICAL: "Jobs Found In Email" contains "job" but should NOT match jobTitle
      expect(map.jobTitle).toBe(1);
      expect(map.jobsFoundInEmail).toBe(2);
    });

    it('should correctly map all 15 standard columns (no Careers URL)', () => {
      const headers = [
        'Company',
        'Company Description',
        'Job Title',
        'Location',
        'Minimum Salary',
        'Maximum Salary',
        'Salary Period',
        'Job URL',
        'URL Status',
        'Email Received Date',
        'Email Source',
        'Date Added',
        'Interest',
        'Email Title',
        'Jobs Found In Email'
      ];

      const map = createCsvColumnMap(headers);

      // Verify all mappings
      expect(map.company).toBe(0);
      expect(map.description).toBe(1);
      expect(map.jobTitle).toBe(2);
      expect(map.location).toBe(3);
      expect(map.minSalary).toBe(4);
      expect(map.maxSalary).toBe(5);
      expect(map.salaryPeriod).toBe(6);
      expect(map.jobUrl).toBe(7);
      expect(map.urlStatus).toBe(8);
      expect(map.emailReceivedDate).toBe(9);
      expect(map.emailSource).toBe(10);
      expect(map.dateAdded).toBe(11);
      expect(map.interest).toBe(12);
      expect(map.emailTitle).toBe(13);
      expect(map.jobsFoundInEmail).toBe(14);
    });

    it('should NOT map Careers URL columns (dropped from the 18-col sheet shape)', () => {
      const headers = ['Careers URL', 'Careers URL Status'];
      const map = createCsvColumnMap(headers);

      expect(map.careersUrl).toBeUndefined();
      expect(map.careersUrlStatus).toBeUndefined();
    });

    it('should handle missing headers gracefully', () => {
      const headers = ['Company', 'Job Title'];
      const map = createCsvColumnMap(headers);

      expect(map.company).toBe(0);
      expect(map.jobTitle).toBe(1);
      expect(map.location).toBeUndefined();
      expect(map.minSalary).toBeUndefined();
    });

    it('should handle empty headers array', () => {
      const headers = [];
      const map = createCsvColumnMap(headers);

      expect(Object.keys(map).length).toBe(0);
    });

    it('should trim whitespace from headers', () => {
      const headers = ['  Company  ', ' Job Title ', 'Location'];
      const map = createCsvColumnMap(headers);

      expect(map.company).toBe(0);
      expect(map.jobTitle).toBe(1);
    });
  });
});

describe('CSV Generation', () => {
  describe('convertJobsToCsv', () => {
    it('should return empty string for empty job array', () => {
      const csv = convertJobsToCsv([]);
      expect(csv).toBe('');
    });

    it('should return empty string for null input', () => {
      const csv = convertJobsToCsv(null);
      expect(csv).toBe('');
    });

    it('should generate header row with 15 columns (no Careers URL)', () => {
      const jobs = [{
        'Company': 'Test Corp',
        'Job Title': 'Engineer'
      }];

      const csv = convertJobsToCsv(jobs);
      const lines = csv.split('\n');
      const headers = lines[0].split(',');

      expect(headers.length).toBe(15);
      expect(headers[0]).toBe('Company');
      expect(headers[2]).toBe('Job Title');
      expect(headers[13]).toBe('Email Title');
      expect(headers[14]).toBe('Jobs Found In Email');
      expect(headers).not.toContain('Careers URL');
      expect(headers).not.toContain('Careers URL Status');
    });

    it('should properly quote fields with commas', () => {
      const jobs = [{
        'Company': 'Capital One',
        'Job Title': 'Director, Technical Program Manager',
        'Location': 'Richmond, VA'
      }];

      const csv = convertJobsToCsv(jobs);
      const lines = csv.split('\n');

      expect(lines[1]).toContain('"Director, Technical Program Manager"');
      expect(lines[1]).toContain('"Richmond, VA"');
    });

    it('should properly escape quotes in fields', () => {
      const jobs = [{
        'Company': 'Test "The Best" Corp',
        'Job Title': 'Engineer "Senior"'
      }];

      const csv = convertJobsToCsv(jobs);
      const lines = csv.split('\n');

      expect(lines[1]).toContain('""The Best""');
      expect(lines[1]).toContain('""Senior""');
    });

    it('should handle multiple jobs', () => {
      const jobs = [
        { 'Company': 'Company A', 'Job Title': 'Role A' },
        { 'Company': 'Company B', 'Job Title': 'Role B' },
        { 'Company': 'Company C', 'Job Title': 'Role C' }
      ];

      const csv = convertJobsToCsv(jobs);
      const lines = csv.split('\n');

      expect(lines.length).toBe(4); // 1 header + 3 data rows
    });

    it('should use empty string for missing fields', () => {
      const jobs = [{
        'Company': 'Test Corp'
        // Other fields missing
      }];

      const csv = convertJobsToCsv(jobs);
      const lines = csv.split('\n');
      const values = lines[1].split(',');

      expect(values[0]).toBe('Test Corp');
      expect(values[1]).toBe(''); // Company Description missing
    });

    it('should maintain column order matching config', () => {
      const jobs = [{
        'Jobs Found In Email': '5',
        'Email Title': 'Test Email',
        'Company': 'Test Corp',
        'Job Title': 'Engineer'
      }];

      const csv = convertJobsToCsv(jobs);
      const lines = csv.split('\n');
      const headers = lines[0].split(',');

      // Verify order matches config, not job object property order
      expect(headers[0]).toBe('Company');
      expect(headers[2]).toBe('Job Title');
      expect(headers[13]).toBe('Email Title');
      expect(headers[14]).toBe('Jobs Found In Email');
    });
  });
});

describe('CSV Parsing', () => {
  describe('createJobFromCsvRow', () => {
    it('should create job object from valid row', () => {
      const headers = ['Company', 'Job Title', 'Location'];
      const map = createCsvColumnMap(headers);
      const row = ['Acme Corp', 'Software Engineer', 'San Francisco'];

      const job = createJobFromCsvRow(row, map);

      expect(job['Company']).toBe('Acme Corp');
      expect(job['Job Title']).toBe('Software Engineer');
      expect(job['Location']).toBe('San Francisco');
    });

    it('should use default value "Unknown" for missing company', () => {
      const headers = ['Job Title'];
      const map = createCsvColumnMap(headers);
      const row = ['Engineer'];

      const job = createJobFromCsvRow(row, map);

      expect(job['Company']).toBe('Unknown');
    });

    it('should use default value "Unknown Position" for missing job title', () => {
      const headers = ['Company'];
      const map = createCsvColumnMap(headers);
      const row = ['Test Corp'];

      const job = createJobFromCsvRow(row, map);

      expect(job['Job Title']).toBe('Unknown Position');
    });

    it('should trim whitespace from values', () => {
      const headers = ['Company', 'Job Title'];
      const map = createCsvColumnMap(headers);
      const row = ['  Acme Corp  ', '  Engineer  '];

      const job = createJobFromCsvRow(row, map);

      expect(job['Company']).toBe('Acme Corp');
      expect(job['Job Title']).toBe('Engineer');
    });

    it('should handle empty strings in row', () => {
      const headers = ['Company', 'Company Description', 'Job Title'];
      const map = createCsvColumnMap(headers);
      const row = ['Acme', '', 'Engineer'];

      const job = createJobFromCsvRow(row, map);

      expect(job['Company']).toBe('Acme');
      expect(job['Company Description']).toBe('');
      expect(job['Job Title']).toBe('Engineer');
    });

    it('should create all 15 fields for complete row (no Careers URL)', () => {
      const headers = [
        'Company', 'Company Description', 'Job Title', 'Location',
        'Minimum Salary', 'Maximum Salary', 'Salary Period',
        'Job URL', 'URL Status',
        'Email Received Date', 'Email Source', 'Date Added',
        'Interest', 'Email Title', 'Jobs Found In Email'
      ];
      const map = createCsvColumnMap(headers);
      const row = [
        'Capital One', '', 'Director', 'Richmond, VA',
        '', '', '', '', 'Not found',
        '2025-10-02 21:58:52', 'indeed', '2025-10-04 10:22:31',
        '', 'Capital One is hiring', '6'
      ];

      const job = createJobFromCsvRow(row, map);

      // Verify all fields exist
      expect(job['Company']).toBe('Capital One');
      expect(job['Job Title']).toBe('Director');
      expect(job['Location']).toBe('Richmond, VA');
      expect(job['Email Received Date']).toBe('2025-10-02 21:58:52');
      expect(job['Email Source']).toBe('indeed');
      expect(job['Email Title']).toBe('Capital One is hiring');
      expect(job['Jobs Found In Email']).toBe('6');
      // Careers URL fields must NOT be produced
      expect(job).not.toHaveProperty('Careers URL');
      expect(job).not.toHaveProperty('Careers URL Status');
    });
  });
});

describe('CSV Round-trip Integration', () => {
  it('should preserve data through write and read cycle', () => {
    const originalJobs = [{
      'Company': 'Capital One',
      'Company Description': '',
      'Job Title': 'Director, Technical Program Manager',
      'Location': 'Richmond, VA',
      'Minimum Salary': '',
      'Maximum Salary': '',
      'Salary Period': '',
      'Job URL': '',
      'URL Status': 'Not found',
      'Email Received Date': '2025-10-02 21:58:52',
      'Email Source': 'indeed',
      'Date Added': '2025-10-04 10:22:31',
      'Interest': '',
      'Email Title': 'Capital One is hiring for Director, Technical Program Manager. 5 more jobs in Richmond, VA.',
      'Jobs Found In Email': '6'
    }];

    // Write to CSV
    const csv = convertJobsToCsv(originalJobs);

    // Verify CSV is not empty
    expect(csv.length).toBeGreaterThan(0);

    // Note: Full round-trip test requires Utilities.parseCsv() which is only available in Apps Script
    // In unit tests, we verify the CSV format is correct
    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // Header + 1 data row

    // Verify critical fields are properly quoted
    expect(lines[1]).toContain('"Director, Technical Program Manager"');
    expect(lines[1]).toContain('"Richmond, VA"');
    expect(lines[1]).toContain('"Capital One is hiring for Director, Technical Program Manager. 5 more jobs in Richmond, VA."');
  });

  it('should handle complex email titles with commas and quotes', () => {
    const jobs = [{
      'Company': 'Test Corp',
      'Job Title': 'Engineer',
      'Email Title': 'New job: "Senior Engineer" at Test, Inc. - Apply now!',
      'Jobs Found In Email': '3'
    }];

    const csv = convertJobsToCsv(jobs);
    const lines = csv.split('\n');

    // Verify proper escaping
    expect(lines[1]).toContain('""Senior Engineer""');
  });
});

describe('CSV Format Validation', () => {
  describe('Old vs New Format Detection', () => {
    it('should identify old format CSV (9 columns)', () => {
      // Old format CSV headers (before metadata columns were added)
      const oldHeaders = [
        'Company', 'Company Description', 'Job Title', 'Location',
        'Minimum Salary', 'Maximum Salary', 'Salary Period',
        'Job URL', 'Careers URL'
      ];

      // Required columns for new format
      const requiredColumns = ['Company', 'Job Title', 'Email Received Date', 'Email Source'];
      const missingColumns = requiredColumns.filter(col => !oldHeaders.includes(col));

      // Old format should be missing Email Received Date and Email Source
      expect(missingColumns.length).toBeGreaterThan(0);
      expect(missingColumns).toContain('Email Received Date');
      expect(missingColumns).toContain('Email Source');
    });

    it('should identify new format CSV (15 columns, no Careers URL)', () => {
      const newHeaders = [
        'Company', 'Company Description', 'Job Title', 'Location',
        'Minimum Salary', 'Maximum Salary', 'Salary Period',
        'Job URL', 'URL Status',
        'Email Received Date', 'Email Source', 'Date Added',
        'Interest', 'Email Title', 'Jobs Found In Email'
      ];

      const requiredColumns = ['Company', 'Job Title', 'Email Received Date', 'Email Source'];
      const missingColumns = requiredColumns.filter(col => !newHeaders.includes(col));

      // New format should have all required columns
      expect(missingColumns.length).toBe(0);
    });
  });
});

describe('Regression Tests - Bug Scenarios', () => {
  it('should NOT cause Unknown company due to substring matching', () => {
    // This was the actual bug: "Company Description" matched to company field
    const headers = [
      'Company', 'Company Description', 'Job Title', 'Location',
      'Minimum Salary', 'Maximum Salary', 'Salary Period',
      'Job URL', 'URL Status',
      'Email Received Date', 'Email Source', 'Date Added',
      'Interest', 'Email Title', 'Jobs Found In Email'
    ];
    const row = [
      'Capital One', '', 'Director', 'Richmond, VA',
      '', '', '', '', 'Not found',
      '2025-10-02 21:58:52', 'indeed', '2025-10-04 10:22:31',
      '', 'Email title here', '6'
    ];

    const map = createCsvColumnMap(headers);
    const job = createJobFromCsvRow(row, map);

    // Bug would cause: Company = "Unknown" (getting empty Company Description)
    expect(job['Company']).toBe('Capital One');
    expect(job['Company']).not.toBe('Unknown');
  });

  it('should NOT cause job title to be "6" due to substring matching', () => {
    // This was the actual bug: "Jobs Found In Email" matched to jobTitle field
    const headers = [
      'Company', 'Company Description', 'Job Title', 'Location',
      'Minimum Salary', 'Maximum Salary', 'Salary Period',
      'Job URL', 'URL Status',
      'Email Received Date', 'Email Source', 'Date Added',
      'Interest', 'Email Title', 'Jobs Found In Email'
    ];
    const row = [
      'Capital One', '', 'Director', 'Richmond, VA',
      '', '', '', '', 'Not found',
      '2025-10-02 21:58:52', 'indeed', '2025-10-04 10:22:31',
      '', 'Email title here', '6'
    ];

    const map = createCsvColumnMap(headers);
    const job = createJobFromCsvRow(row, map);

    // Bug would cause: Job Title = "6" (getting Jobs Found In Email value)
    expect(job['Job Title']).toBe('Director');
    expect(job['Job Title']).not.toBe('6');
    expect(job['Jobs Found In Email']).toBe('6');
  });
});
