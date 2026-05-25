/**
 * Test Data Fixtures - Main Export
 * Centralized access to all test data factories
 */

const emailFactory = require('./email-factory');
const jobFactory = require('./job-factory');

module.exports = {
  ...emailFactory,
  ...jobFactory
};
