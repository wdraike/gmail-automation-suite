/**
 * Test Data Factory - Email/Gmail Fixtures
 * Provides reusable, consistent test data for email processing tests
 */

const { MockGmailThread, MockGmailMessage, MockGmailLabel } = require('../mocks/gmail.mock');

/**
 * Create a mock Gmail message
 */
function createMockMessage({
  id = `msg_${Date.now()}`,
  from = 'sender@example.com',
  subject = 'Test Email',
  body = '<p>Test email body</p>',
  date = new Date()
} = {}) {
  return new MockGmailMessage(id, from, subject, body, date);
}

/**
 * Create a job alert email message
 */
function createJobAlertMessage({
  company = 'Acme Corp',
  jobTitle = 'Software Engineer',
  location = 'San Francisco, CA',
  salary = '$120,000 - $150,000',
  jobUrl = 'https://example.com/jobs/123',
  from = 'jobs@indeed.com',
  date = new Date()
} = {}) {
  const subject = `New Job Alert: ${jobTitle} at ${company}`;
  const body = `
    <html>
      <body>
        <h2>${jobTitle}</h2>
        <p><strong>Company:</strong> ${company}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Salary:</strong> ${salary}</p>
        <p><a href="${jobUrl}">Apply Now</a></p>
      </body>
    </html>
  `;

  return createMockMessage({
    from,
    subject,
    body,
    date
  });
}

/**
 * Create a LinkedIn job alert
 */
function createLinkedInJobAlert({
  company = 'Tech Corp',
  jobTitle = 'Senior Developer',
  location = 'Remote',
  date = new Date()
} = {}) {
  return createJobAlertMessage({
    company,
    jobTitle,
    location,
    from: 'jobs-noreply@linkedin.com',
    jobUrl: `https://www.linkedin.com/jobs/view/${Math.floor(Math.random() * 1000000)}`,
    date
  });
}

/**
 * Create an Indeed job alert
 */
function createIndeedJobAlert({
  company = 'Startup Inc',
  jobTitle = 'Full Stack Engineer',
  location = 'New York, NY',
  date = new Date()
} = {}) {
  return createJobAlertMessage({
    company,
    jobTitle,
    location,
    from: 'indeedmail@indeed.com',
    jobUrl: `https://www.indeed.com/viewjob?jk=${Math.random().toString(36).substr(2, 9)}`,
    date
  });
}

/**
 * Create a work-related email
 */
function createWorkEmail({
  from = 'colleague@company.com',
  subject = 'Project Update',
  body = '<p>Here is the project update...</p>',
  date = new Date()
} = {}) {
  return createMockMessage({ from, subject, body, date });
}

/**
 * Create a personal email
 */
function createPersonalEmail({
  from = 'friend@gmail.com',
  subject = 'Weekend Plans',
  body = '<p>What are you doing this weekend?</p>',
  date = new Date()
} = {}) {
  return createMockMessage({ from, subject, body, date });
}

/**
 * Create a promotional email
 */
function createPromotionalEmail({
  from = 'offers@store.com',
  subject = '50% Off Sale!',
  body = '<p>Limited time offer - 50% off all items!</p>',
  date = new Date()
} = {}) {
  return createMockMessage({ from, subject, body, date });
}

/**
 * Create a Gmail thread with messages
 */
function createMockThread({
  id = `thread_${Date.now()}`,
  messages = [],
  labels = []
} = {}) {
  // If no messages provided, create a default one
  if (messages.length === 0) {
    messages = [createMockMessage()];
  }

  return new MockGmailThread(id, messages, labels);
}

/**
 * Create a Gmail label
 */
function createMockLabel(name = 'Test Label') {
  return new MockGmailLabel(name);
}

/**
 * Create a batch of job alert emails
 */
function createJobAlertBatch(count = 5) {
  const companies = [
    'Tech Corp', 'Startup Inc', 'Big Company', 'Innovation Labs', 'Digital Solutions'
  ];
  const titles = [
    'Software Engineer', 'Senior Developer', 'Full Stack Engineer',
    'Frontend Developer', 'Backend Engineer'
  ];
  const locations = [
    'San Francisco, CA', 'New York, NY', 'Remote', 'Austin, TX', 'Seattle, WA'
  ];

  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push(createJobAlertMessage({
      company: companies[i % companies.length],
      jobTitle: titles[i % titles.length],
      location: locations[i % locations.length],
      date: new Date(Date.now() - i * 3600000) // Stagger by hours
    }));
  }

  return messages;
}

/**
 * Create a mixed batch of emails (various types)
 */
function createMixedEmailBatch() {
  return [
    createJobAlertMessage({ company: 'Tech Co', jobTitle: 'Engineer' }),
    createWorkEmail({ subject: 'Meeting Tomorrow' }),
    createPersonalEmail({ subject: 'Dinner Plans' }),
    createPromotionalEmail({ subject: 'Sale Alert' }),
    createLinkedInJobAlert({ company: 'LinkedIn Corp' }),
    createIndeedJobAlert({ company: 'Indeed Corp' })
  ];
}

module.exports = {
  // Message creators
  createMockMessage,
  createJobAlertMessage,
  createLinkedInJobAlert,
  createIndeedJobAlert,
  createWorkEmail,
  createPersonalEmail,
  createPromotionalEmail,

  // Thread creators
  createMockThread,

  // Label creators
  createMockLabel,

  // Batch creators
  createJobAlertBatch,
  createMixedEmailBatch
};
