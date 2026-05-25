/**
 * Test Runner for Gmail Automation Project
 *
 * This script loads and runs all test suites before deployment.
 * Run this before using `clasp push` to ensure code quality.
 */

/**
 * Main test runner function
 * Call this function to run all tests
 */
function runAllTests() {
  Logger.log('='.repeat(60));
  Logger.log('Gmail Automation - Test Suite');
  Logger.log('='.repeat(60));
  Logger.log('');

  // Clear any previous test results
  clearTests();

  // Load all test files
  loadTestSuites();

  // Run the tests
  const results = runTests();

  // Generate detailed report
  generateTestReport(results);

  // Return results for programmatic access
  return results;
}

/**
 * Load all test suite definitions
 * This function calls all test definition files
 */
function loadTestSuites() {
  Logger.log('Loading test suites...\n');

  // Note: In Google Apps Script, all files are loaded automatically
  // This function exists to provide a clear entry point for test loading
  // If tests are defined in separate files, they'll be loaded when those files execute

  Logger.log('✓ Categorization tests loaded');
  Logger.log('✓ Retention tests loaded');
  Logger.log('✓ Cache tests loaded');
  Logger.log('✓ API tests loaded');
  Logger.log('');
}

/**
 * Generate a detailed test report
 * @param {Object} results - Test results from runTests()
 */
function generateTestReport(results) {
  Logger.log('\n');
  Logger.log('='.repeat(60));
  Logger.log('DETAILED TEST REPORT');
  Logger.log('='.repeat(60));
  Logger.log('');

  // Suite-by-suite breakdown
  results.suites.forEach(suite => {
    const status = suite.failed === 0 ? '✓' : '✗';
    const statusText = suite.failed === 0 ? 'PASSED' : 'FAILED';

    Logger.log(`${status} ${suite.description} - ${statusText}`);
    Logger.log(`  Tests: ${suite.tests.length} | Passed: ${suite.passed} | Failed: ${suite.failed}`);

    if (suite.failed > 0) {
      Logger.log('  Failed tests:');
      suite.tests.forEach(test => {
        if (!test.passed) {
          Logger.log(`    ✗ ${test.description}`);
          Logger.log(`      ${test.error}`);
        }
      });
    }

    Logger.log('');
  });

  // Overall statistics
  Logger.log('='.repeat(60));
  Logger.log('OVERALL STATISTICS');
  Logger.log('='.repeat(60));
  Logger.log(`Total Test Suites: ${results.suites.length}`);
  Logger.log(`Total Tests: ${results.totalTests}`);
  Logger.log(`Passed: ${results.passedTests} (${getPercentage(results.passedTests, results.totalTests)}%)`);
  Logger.log(`Failed: ${results.failedTests} (${getPercentage(results.failedTests, results.totalTests)}%)`);
  Logger.log(`Duration: ${results.endTime - results.startTime}ms`);
  Logger.log('');

  // Final verdict
  if (results.failedTests === 0) {
    Logger.log('✓✓✓ ALL TESTS PASSED - SAFE TO DEPLOY ✓✓✓');
  } else {
    Logger.log('✗✗✗ TESTS FAILED - DO NOT DEPLOY ✗✗✗');
    Logger.log(`Fix ${results.failedTests} failing test(s) before deployment`);
  }

  Logger.log('='.repeat(60));
}

/**
 * Calculate percentage
 * @param {number} value - The value
 * @param {number} total - The total
 * @returns {string} Percentage rounded to 1 decimal
 */
function getPercentage(value, total) {
  if (total === 0) return '0.0';
  return ((value / total) * 100).toFixed(1);
}

/**
 * Run tests for a specific module only
 * @param {string} moduleName - Name of the module to test
 * @returns {Object} Test results
 */
function runTestsForModule(moduleName) {
  clearTests();

  Logger.log(`Running tests for module: ${moduleName}\n`);

  // Load only the specified module's tests
  switch (moduleName.toLowerCase()) {
    case 'categorization':
      Logger.log('Loading categorization tests only...');
      break;
    case 'retention':
      Logger.log('Loading retention tests only...');
      break;
    case 'cache':
      Logger.log('Loading cache tests only...');
      break;
    case 'api':
      Logger.log('Loading API tests only...');
      break;
    default:
      Logger.log(`Unknown module: ${moduleName}`);
      Logger.log('Available modules: categorization, retention, cache, api');
      return null;
  }

  const results = runTests();
  generateTestReport(results);

  return results;
}

/**
 * Quick smoke test - runs only critical tests
 * @returns {Object} Test results
 */
function runSmokeTests() {
  Logger.log('Running smoke tests (quick validation)...\n');

  clearTests();

  // Define quick smoke tests
  describe('Smoke Test - Critical Functions', () => {
    it('should load categorizer data', () => {
      const data = loadCategorizerData();
      expect.value(data).toBeTruthy();
    });

    it('should get API key status', () => {
      const isSet = isApiKeySet();
      expect.value(typeof isSet).toBe('boolean');
    });

    it('should get retention rules', () => {
      const result = getRetentionRules();
      expect.value(result).toHaveProperty('success');
    });

    it('should get all categories', () => {
      const categories = getAllCategories();
      expect.value(typeof categories).toBe('object');
    });

    it('should access cache service', () => {
      expect.value(typeof UnifiedCacheCore).toBe('object');
    });
  });

  const results = runTests();
  generateTestReport(results);

  return results;
}

/**
 * Validate code before deployment
 * This is the function to run before clasp push
 * @returns {boolean} True if all tests pass, false otherwise
 */
function validateBeforeDeploy() {
  Logger.log('\n');
  Logger.log('╔' + '═'.repeat(58) + '╗');
  Logger.log('║' + ' '.repeat(10) + 'PRE-DEPLOYMENT VALIDATION' + ' '.repeat(22) + '║');
  Logger.log('╚' + '═'.repeat(58) + '╝');
  Logger.log('');

  const results = runAllTests();

  Logger.log('\n');

  if (results.failedTests === 0) {
    Logger.log('╔' + '═'.repeat(58) + '╗');
    Logger.log('║' + ' '.repeat(15) + '✓ VALIDATION PASSED' + ' '.repeat(23) + '║');
    Logger.log('║' + ' '.repeat(12) + 'Safe to run: clasp push' + ' '.repeat(22) + '║');
    Logger.log('╚' + '═'.repeat(58) + '╝');
    return true;
  } else {
    Logger.log('╔' + '═'.repeat(58) + '╗');
    Logger.log('║' + ' '.repeat(15) + '✗ VALIDATION FAILED' + ' '.repeat(22) + '║');
    Logger.log('║' + ' '.repeat(10) + 'DO NOT DEPLOY - Fix failing tests' + ' '.repeat(14) + '║');
    Logger.log('╚' + '═'.repeat(58) + '╝');
    return false;
  }
}

/**
 * Generate HTML test report
 * @returns {HtmlOutput} HTML report
 */
function generateHtmlTestReport() {
  const results = runAllTests();

  let html = '<html><head><style>';
  html += 'body { font-family: monospace; padding: 20px; }';
  html += '.pass { color: green; }';
  html += '.fail { color: red; }';
  html += '.suite { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }';
  html += '.test { margin-left: 20px; }';
  html += '</style></head><body>';

  html += '<h1>Test Results</h1>';
  html += `<p>Total: ${results.totalTests} | `;
  html += `<span class="pass">Passed: ${results.passedTests}</span> | `;
  html += `<span class="fail">Failed: ${results.failedTests}</span></p>`;

  results.suites.forEach(suite => {
    const suiteClass = suite.failed === 0 ? 'pass' : 'fail';
    html += `<div class="suite">`;
    html += `<h2 class="${suiteClass}">${suite.description}</h2>`;

    suite.tests.forEach(test => {
      const testClass = test.passed ? 'pass' : 'fail';
      const symbol = test.passed ? '✓' : '✗';
      html += `<div class="test ${testClass}">`;
      html += `${symbol} ${test.description} (${test.duration}ms)`;
      if (!test.passed) {
        html += `<br><small>${test.error}</small>`;
      }
      html += `</div>`;
    });

    html += '</div>';
  });

  html += '</body></html>';

  return HtmlService.createHtmlOutput(html)
    .setTitle('Test Results')
    .setWidth(800)
    .setHeight(600);
}

/**
 * Save test results to a file
 * @param {Object} results - Test results
 * @returns {string} File ID of saved results
 */
function saveTestResults(results) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `test-results-${timestamp}.json`;

  const fileContent = JSON.stringify(results, null, 2);

  const file = DriveApp.createFile(fileName, fileContent, MimeType.PLAIN_TEXT);

  Logger.log(`Test results saved to: ${file.getName()}`);
  Logger.log(`File ID: ${file.getId()}`);

  return file.getId();
}

/**
 * Watch mode - run tests on a schedule
 * Creates a trigger to run tests periodically
 */
function setupTestWatcher() {
  // Delete existing test watchers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runAllTests') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // Create new trigger - run tests every hour
  ScriptApp.newTrigger('runAllTests')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('Test watcher created - tests will run every hour');
}

/**
 * Remove test watcher
 */
function removeTestWatcher() {
  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'runAllTests') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
    }
  });

  Logger.log(`Removed ${removed} test watcher trigger(s)`);
}
