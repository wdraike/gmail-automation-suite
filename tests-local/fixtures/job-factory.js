/**
 * Test Data Factory - Job Data Fixtures
 * Provides reusable, consistent test data for job processing tests
 */

/**
 * Create a complete job object
 */
function createJobData({
  company = 'Acme Corp',
  description = 'Leading technology company',
  jobTitle = 'Software Engineer',
  location = 'San Francisco, CA',
  minSalary = 100000,
  maxSalary = 150000,
  salaryPeriod = 'Yearly',
  jobUrl = 'https://example.com/jobs/123',
  urlStatus = 'Found',
  careersUrl = 'https://example.com/careers',
  careersUrlStatus = 'Found',
  emailReceivedDate = new Date().toISOString(),
  emailSource = 'indeed',
  dateAdded = new Date().toISOString(),
  interest = '',
  emailTitle = 'Job Alert',
  jobsFoundInEmail = '1'
} = {}) {
  return {
    'Company': company,
    'Company Description': description,
    'Job Title': jobTitle,
    'Location': location,
    'Minimum Salary': minSalary || '',
    'Maximum Salary': maxSalary || '',
    'Salary Period': salaryPeriod,
    'Job URL': jobUrl,
    'URL Status': urlStatus,
    'Careers URL': careersUrl,
    'Careers URL Status': careersUrlStatus,
    'Email Received Date': emailReceivedDate,
    'Email Source': emailSource,
    'Date Added': dateAdded,
    'Interest': interest,
    'Email Title': emailTitle,
    'Jobs Found In Email': jobsFoundInEmail
  };
}

/**
 * Create a minimal job object (required fields only)
 */
function createMinimalJobData({
  company = 'Test Corp',
  jobTitle = 'Developer',
  emailReceivedDate = new Date().toISOString(),
  emailSource = 'test'
} = {}) {
  return {
    'Company': company,
    'Company Description': '',
    'Job Title': jobTitle,
    'Location': '',
    'Minimum Salary': '',
    'Maximum Salary': '',
    'Salary Period': '',
    'Job URL': '',
    'URL Status': 'Not found',
    'Careers URL': '',
    'Careers URL Status': 'Not found',
    'Email Received Date': emailReceivedDate,
    'Email Source': emailSource,
    'Date Added': new Date().toISOString(),
    'Interest': '',
    'Email Title': '',
    'Jobs Found In Email': '1'
  };
}

/**
 * Create job data with complete salary information
 */
function createJobWithSalary({
  company = 'High Pay Corp',
  jobTitle = 'Senior Engineer',
  minSalary = 150000,
  maxSalary = 200000,
  salaryPeriod = 'Yearly'
} = {}) {
  return createJobData({
    company,
    jobTitle,
    minSalary,
    maxSalary,
    salaryPeriod
  });
}

/**
 * Create job data without salary
 */
function createJobWithoutSalary({
  company = 'Startup Inc',
  jobTitle = 'Engineer'
} = {}) {
  return createJobData({
    company,
    jobTitle,
    minSalary: '',
    maxSalary: '',
    salaryPeriod: ''
  });
}

/**
 * Create remote job data
 */
function createRemoteJob({
  company = 'Remote Corp',
  jobTitle = 'Remote Developer',
  location = 'Remote'
} = {}) {
  return createJobData({
    company,
    jobTitle,
    location
  });
}

/**
 * Create job from specific source
 */
function createJobFromSource(source = 'linkedin', overrides = {}) {
  const sourceDefaults = {
    linkedin: {
      emailSource: 'linkedin',
      jobUrl: 'https://www.linkedin.com/jobs/view/123456',
      careersUrl: 'https://www.linkedin.com/company/example/jobs'
    },
    indeed: {
      emailSource: 'indeed',
      jobUrl: 'https://www.indeed.com/viewjob?jk=abc123',
      careersUrl: 'https://www.indeed.com/cmp/Example-Corp'
    },
    glassdoor: {
      emailSource: 'glassdoor',
      jobUrl: 'https://www.glassdoor.com/job-listing/engineer-jl123',
      careersUrl: 'https://www.glassdoor.com/Overview/Working-at-Example'
    },
    ziprecruiter: {
      emailSource: 'ziprecruiter',
      jobUrl: 'https://www.ziprecruiter.com/c/Example/Job/Engineer/-in-Location,ST?jid=abc123',
      careersUrl: ''
    }
  };

  const defaults = sourceDefaults[source] || sourceDefaults.indeed;

  return createJobData({
    ...defaults,
    ...overrides
  });
}

/**
 * Create a batch of diverse job listings
 */
function createJobBatch(count = 5) {
  const jobs = [];

  const templates = [
    { company: 'Tech Corp', jobTitle: 'Frontend Engineer', location: 'San Francisco, CA', minSalary: 120000, maxSalary: 160000 },
    { company: 'Startup Inc', jobTitle: 'Full Stack Developer', location: 'New York, NY', minSalary: 100000, maxSalary: 140000 },
    { company: 'Big Company', jobTitle: 'Backend Engineer', location: 'Austin, TX', minSalary: 110000, maxSalary: 150000 },
    { company: 'Innovation Labs', jobTitle: 'DevOps Engineer', location: 'Seattle, WA', minSalary: 130000, maxSalary: 170000 },
    { company: 'Digital Solutions', jobTitle: 'Mobile Developer', location: 'Remote', minSalary: 115000, maxSalary: 155000 }
  ];

  for (let i = 0; i < count; i++) {
    const template = templates[i % templates.length];
    jobs.push(createJobData({
      ...template,
      emailReceivedDate: new Date(Date.now() - i * 86400000).toISOString(), // Stagger by days
      dateAdded: new Date(Date.now() - i * 3600000).toISOString() // Stagger by hours
    }));
  }

  return jobs;
}

/**
 * Create CSV row from job data
 */
function jobDataToCsvRow(jobData) {
  const columns = [
    'Company', 'Company Description', 'Job Title', 'Location',
    'Minimum Salary', 'Maximum Salary', 'Salary Period',
    'Job URL', 'URL Status', 'Careers URL', 'Careers URL Status',
    'Email Received Date', 'Email Source', 'Date Added',
    'Interest', 'Email Title', 'Jobs Found In Email'
  ];

  return columns.map(col => {
    const value = jobData[col] || '';
    // CSV escape: wrap in quotes if contains comma, quote, or newline
    if (typeof value === 'string' && /[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  });
}

/**
 * Create CSV string from job data array
 */
function jobDataToCsv(jobs) {
  const headers = [
    'Company', 'Company Description', 'Job Title', 'Location',
    'Minimum Salary', 'Maximum Salary', 'Salary Period',
    'Job URL', 'URL Status', 'Careers URL', 'Careers URL Status',
    'Email Received Date', 'Email Source', 'Date Added',
    'Interest', 'Email Title', 'Jobs Found In Email'
  ];

  const rows = [headers.join(',')];

  jobs.forEach(job => {
    rows.push(jobDataToCsvRow(job).join(','));
  });

  return rows.join('\n');
}

/**
 * Create spreadsheet row from job data
 */
function jobDataToSheetRow(jobData) {
  return [
    jobData['Company'] || '',
    jobData['Company Description'] || '',
    jobData['Job Title'] || '',
    jobData['Location'] || '',
    jobData['Minimum Salary'] || '',
    jobData['Maximum Salary'] || '',
    jobData['Salary Period'] || '',
    jobData['Job URL'] || '',
    jobData['URL Status'] || 'Not found',
    jobData['Careers URL'] || '',
    jobData['Careers URL Status'] || 'Not found',
    jobData['Email Received Date'] || '',
    jobData['Email Source'] || '',
    jobData['Date Added'] || '',
    jobData['Interest'] || '',
    jobData['Email Title'] || '',
    jobData['Jobs Found In Email'] || '1'
  ];
}

module.exports = {
  // Job data creators
  createJobData,
  createMinimalJobData,
  createJobWithSalary,
  createJobWithoutSalary,
  createRemoteJob,
  createJobFromSource,

  // Batch creators
  createJobBatch,

  // Converters
  jobDataToCsvRow,
  jobDataToCsv,
  jobDataToSheetRow
};
