/**
 * Simple Testing Framework for Google Apps Script
 *
 * Provides basic unit testing capabilities similar to Jest/Mocha
 */

// Test results storage
const TEST_RESULTS = {
  suites: [],
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  startTime: null,
  endTime: null
};

// Current suite being executed
let currentSuite = null;

/**
 * Define a test suite
 * @param {string} description - Suite description
 * @param {Function} fn - Suite function containing tests
 */
function describe(description, fn) {
  const suite = {
    description: description,
    tests: [],
    beforeEachFn: null,
    afterEachFn: null,
    passed: 0,
    failed: 0
  };

  currentSuite = suite;
  fn();
  currentSuite = null;

  TEST_RESULTS.suites.push(suite);
}

/**
 * Define a test case
 * @param {string} description - Test description
 * @param {Function} fn - Test function
 */
function it(description, fn) {
  if (!currentSuite) {
    throw new Error('Tests must be defined inside a describe block');
  }

  const test = {
    description: description,
    fn: fn,
    passed: false,
    error: null,
    duration: 0
  };

  currentSuite.tests.push(test);
}

/**
 * Run a function before each test in the suite
 * @param {Function} fn - Setup function
 */
function beforeEach(fn) {
  if (!currentSuite) {
    throw new Error('beforeEach must be defined inside a describe block');
  }
  currentSuite.beforeEachFn = fn;
}

/**
 * Run a function after each test in the suite
 * @param {Function} fn - Teardown function
 */
function afterEach(fn) {
  if (!currentSuite) {
    throw new Error('afterEach must be defined inside a describe block');
  }
  currentSuite.afterEachFn = fn;
}

/**
 * Assertion library
 */
const expect = {
  /**
   * Create an expectation for a value
   * @param {*} actual - The actual value
   */
  value: function(actual) {
    return {
      toBe: function(expected) {
        if (actual !== expected) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },

      toEqual: function(expected) {
        const actualStr = JSON.stringify(actual);
        const expectedStr = JSON.stringify(expected);
        if (actualStr !== expectedStr) {
          throw new Error(`Expected ${expectedStr} but got ${actualStr}`);
        }
      },

      toBeTruthy: function() {
        if (!actual) {
          throw new Error(`Expected truthy value but got ${JSON.stringify(actual)}`);
        }
      },

      toBeFalsy: function() {
        if (actual) {
          throw new Error(`Expected falsy value but got ${JSON.stringify(actual)}`);
        }
      },

      toBeNull: function() {
        if (actual !== null) {
          throw new Error(`Expected null but got ${JSON.stringify(actual)}`);
        }
      },

      toBeUndefined: function() {
        if (actual !== undefined) {
          throw new Error(`Expected undefined but got ${JSON.stringify(actual)}`);
        }
      },

      toContain: function(expected) {
        if (Array.isArray(actual)) {
          if (!actual.includes(expected)) {
            throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
          }
        } else if (typeof actual === 'string') {
          if (actual.indexOf(expected) === -1) {
            throw new Error(`Expected string to contain "${expected}"`);
          }
        } else {
          throw new Error('toContain can only be used with arrays or strings');
        }
      },

      toHaveLength: function(length) {
        if (!actual || typeof actual.length !== 'number') {
          throw new Error('Value does not have a length property');
        }
        if (actual.length !== length) {
          throw new Error(`Expected length ${length} but got ${actual.length}`);
        }
      },

      toThrow: function(expectedError) {
        if (typeof actual !== 'function') {
          throw new Error('toThrow requires a function');
        }

        let thrown = false;
        let error = null;

        try {
          actual();
        } catch (e) {
          thrown = true;
          error = e;
        }

        if (!thrown) {
          throw new Error('Expected function to throw an error');
        }

        if (expectedError && error.message.indexOf(expectedError) === -1) {
          throw new Error(`Expected error message to contain "${expectedError}" but got "${error.message}"`);
        }
      },

      toBeGreaterThan: function(expected) {
        if (actual <= expected) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },

      toBeLessThan: function(expected) {
        if (actual >= expected) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      },

      toHaveProperty: function(property, value) {
        if (typeof actual !== 'object' || actual === null) {
          throw new Error('Expected value to be an object');
        }

        if (!(property in actual)) {
          throw new Error(`Expected object to have property "${property}"`);
        }

        if (value !== undefined && actual[property] !== value) {
          throw new Error(`Expected property "${property}" to be ${JSON.stringify(value)} but got ${JSON.stringify(actual[property])}`);
        }
      }
    };
  }
};

/**
 * Run all defined test suites
 * @returns {Object} Test results
 */
function runTests() {
  clearTests();
  TEST_RESULTS.startTime = new Date();
  TEST_RESULTS.totalTests = 0;
  TEST_RESULTS.passedTests = 0;
  TEST_RESULTS.failedTests = 0;

  Logger.log('\n========================================');
  Logger.log('Running Tests');
  Logger.log('========================================\n');

  TEST_RESULTS.suites.forEach(suite => {
    Logger.log(`\n${suite.description}`);
    Logger.log('─'.repeat(suite.description.length));

    suite.tests.forEach(test => {
      TEST_RESULTS.totalTests++;

      const startTime = new Date().getTime();

      try {
        // Run beforeEach if defined
        if (suite.beforeEachFn) {
          suite.beforeEachFn();
        }

        // Run the test
        test.fn();

        // Run afterEach if defined
        if (suite.afterEachFn) {
          suite.afterEachFn();
        }

        test.passed = true;
        test.duration = new Date().getTime() - startTime;

        suite.passed++;
        TEST_RESULTS.passedTests++;

        Logger.log(`  ✓ ${test.description} (${test.duration}ms)`);

      } catch (error) {
        test.passed = false;
        test.error = error.toString();
        test.duration = new Date().getTime() - startTime;

        suite.failed++;
        TEST_RESULTS.failedTests++;

        Logger.log(`  ✗ ${test.description} (${test.duration}ms)`);
        Logger.log(`    ${error.toString()}`);
      }
    });
  });

  TEST_RESULTS.endTime = new Date();
  const duration = TEST_RESULTS.endTime - TEST_RESULTS.startTime;

  Logger.log('\n========================================');
  Logger.log('Test Summary');
  Logger.log('========================================');
  Logger.log(`Total: ${TEST_RESULTS.totalTests}`);
  Logger.log(`Passed: ${TEST_RESULTS.passedTests}`);
  Logger.log(`Failed: ${TEST_RESULTS.failedTests}`);
  Logger.log(`Duration: ${duration}ms`);

  if (TEST_RESULTS.failedTests === 0) {
    Logger.log('\n✓ All tests passed!');
  } else {
    Logger.log(`\n✗ ${TEST_RESULTS.failedTests} test(s) failed`);
  }

  return TEST_RESULTS;
}

/**
 * Clear all test results and suites
 */
function clearTests() {
  TEST_RESULTS.suites = [];
  TEST_RESULTS.totalTests = 0;
  TEST_RESULTS.passedTests = 0;
  TEST_RESULTS.failedTests = 0;
  TEST_RESULTS.startTime = null;
  TEST_RESULTS.endTime = null;
}
