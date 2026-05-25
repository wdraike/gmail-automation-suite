/**
 * Pre-Push Validation Script
 *
 * Run this script before every `clasp push` to ensure code quality.
 * This script is in the root directory for easy access.
 */

/**
 * Main validation function
 * Run this before deploying!
 *
 * @returns {boolean} True if safe to deploy, false otherwise
 */
function runPrePushValidation() {
  Logger.log('\n');
  Logger.log('╔════════════════════════════════════════════════════════════╗');
  Logger.log('║                   PRE-PUSH VALIDATION                      ║');
  Logger.log('║           Gmail Automation - Code Quality Check           ║');
  Logger.log('╚════════════════════════════════════════════════════════════╝');
  Logger.log('\n');

  let allPassed = true;
  const checks = [];

  // Note: GAS Compatibility tests should be run locally via npm before deploying
  // This script runs inside Google Apps Script environment

  // 1. Run all unit tests
  Logger.log('📋 Step 1/5: Running unit tests...\n');
  try {
    const testResults = runAllTests();

    if (testResults.failedTests === 0) {
      Logger.log(`✓ All ${testResults.totalTests} tests passed\n`);
      checks.push({ name: 'Unit Tests', passed: true, detail: `${testResults.totalTests} tests` });
    } else {
      Logger.log(`✗ ${testResults.failedTests} tests failed\n`);
      checks.push({ name: 'Unit Tests', passed: false, detail: `${testResults.failedTests} failures` });
      allPassed = false;
    }
  } catch (error) {
    Logger.log(`✗ Error running tests: ${error}\n`);
    checks.push({ name: 'Unit Tests', passed: false, detail: 'Error occurred' });
    allPassed = false;
  }

  // 2. Check API key configuration
  Logger.log('🔑 Step 2/5: Checking API configuration...\n');
  try {
    const apiKeySet = isApiKeySet();

    if (apiKeySet) {
      Logger.log('✓ API key is configured\n');
      checks.push({ name: 'API Configuration', passed: true, detail: 'Key set' });
    } else {
      Logger.log('⚠ Warning: API key not set (required for categorization)\n');
      checks.push({ name: 'API Configuration', passed: true, detail: 'Warning: No key' });
    }
  } catch (error) {
    Logger.log(`✗ Error checking API key: ${error}\n`);
    checks.push({ name: 'API Configuration', passed: false, detail: 'Check failed' });
    allPassed = false;
  }

  // 3. Verify data layer integrity
  Logger.log('💾 Step 3/5: Verifying data layer...\n');
  try {
    const data = loadCategorizerData();
    const stats = getDataLayerStats();

    if (data && stats) {
      Logger.log(`✓ Data layer healthy (${stats.totalCategories} categories, ${stats.totalEmails} emails)\n`);
      checks.push({ name: 'Data Layer', passed: true, detail: `${stats.totalCategories} categories` });
    } else {
      Logger.log('⚠ Warning: Data layer may need initialization\n');
      checks.push({ name: 'Data Layer', passed: true, detail: 'Warning: Init needed' });
    }
  } catch (error) {
    Logger.log(`✗ Error verifying data layer: ${error}\n`);
    checks.push({ name: 'Data Layer', passed: false, detail: 'Verification failed' });
    allPassed = false;
  }

  // 4. Check retention rules
  Logger.log('🗑️  Step 4/5: Checking retention configuration...\n');
  try {
    const rules = getRetentionRules();

    if (rules && rules.success) {
      Logger.log(`✓ Retention system operational (${rules.count} rules)\n`);
      checks.push({ name: 'Retention System', passed: true, detail: `${rules.count} rules` });
    } else {
      Logger.log('⚠ Warning: Retention system may need configuration\n');
      checks.push({ name: 'Retention System', passed: true, detail: 'Warning: No rules' });
    }
  } catch (error) {
    Logger.log(`✗ Error checking retention rules: ${error}\n`);
    checks.push({ name: 'Retention System', passed: false, detail: 'Check failed' });
    allPassed = false;
  }

  // 5. Validate cache service
  Logger.log('🗄️  Step 5/5: Validating cache service...\n');
  try {
    if (typeof UnifiedCacheCore !== 'undefined') {
      // Test basic cache operations
      const testKey = '_validation_test_' + new Date().getTime();
      const testValue = 'test';

      UnifiedCacheCore.set(testKey, testValue, 60);
      const retrieved = UnifiedCacheCore.get(testKey);
      UnifiedCacheCore.remove(testKey);

      if (retrieved === testValue) {
        Logger.log('✓ Cache service operational\n');
        checks.push({ name: 'Cache Service', passed: true, detail: 'Operational' });
      } else {
        Logger.log('✗ Cache service malfunction\n');
        checks.push({ name: 'Cache Service', passed: false, detail: 'Malfunction' });
        allPassed = false;
      }
    } else {
      Logger.log('⚠ Warning: Cache service not found\n');
      checks.push({ name: 'Cache Service', passed: true, detail: 'Warning: Not found' });
    }
  } catch (error) {
    Logger.log(`✗ Error validating cache: ${error}\n`);
    checks.push({ name: 'Cache Service', passed: false, detail: 'Validation failed' });
    allPassed = false;
  }

  // Print summary
  Logger.log('\n');
  Logger.log('════════════════════════════════════════════════════════════');
  Logger.log('                      VALIDATION SUMMARY                    ');
  Logger.log('════════════════════════════════════════════════════════════');
  Logger.log('');

  checks.forEach(check => {
    const symbol = check.passed ? '✓' : '✗';
    const status = check.passed ? 'PASS' : 'FAIL';
    Logger.log(`${symbol} ${check.name.padEnd(25)} ${status.padEnd(8)} ${check.detail}`);
  });

  Logger.log('');
  Logger.log('════════════════════════════════════════════════════════════');

  if (allPassed) {
    Logger.log('');
    Logger.log('╔════════════════════════════════════════════════════════════╗');
    Logger.log('║                                                            ║');
    Logger.log('║                  ✓ VALIDATION PASSED ✓                     ║');
    Logger.log('║                                                            ║');
    Logger.log('║              Runtime validation successful                 ║');
    Logger.log('║                                                            ║');
    Logger.log('║  Note: Before deploying, run locally:                      ║');
    Logger.log('║  npm run test:gas-full                                     ║');
    Logger.log('║                                                            ║');
    Logger.log('╚════════════════════════════════════════════════════════════╝');
    Logger.log('');
  } else {
    Logger.log('');
    Logger.log('╔════════════════════════════════════════════════════════════╗');
    Logger.log('║                                                            ║');
    Logger.log('║                  ✗ VALIDATION FAILED ✗                     ║');
    Logger.log('║                                                            ║');
    Logger.log('║         DO NOT DEPLOY - Fix failing checks first          ║');
    Logger.log('║                                                            ║');
    Logger.log('╚════════════════════════════════════════════════════════════╝');
    Logger.log('');
  }

  return allPassed;
}

/**
 * Quick validation (without full test suite)
 * Faster option for quick checks
 */
function runQuickValidation() {
  Logger.log('Running quick validation...\n');

  const checks = [
    { name: 'API Key', test: () => isApiKeySet() },
    { name: 'Data Layer', test: () => !!loadCategorizerData() },
    { name: 'Retention Rules', test: () => getRetentionRules().success },
    { name: 'Cache Service', test: () => typeof UnifiedCacheCore !== 'undefined' }
  ];

  let allPassed = true;

  checks.forEach(check => {
    try {
      const result = check.test();
      if (result) {
        Logger.log(`✓ ${check.name}`);
      } else {
        Logger.log(`✗ ${check.name}`);
        allPassed = false;
      }
    } catch (error) {
      Logger.log(`✗ ${check.name} - Error: ${error.message}`);
      allPassed = false;
    }
  });

  Logger.log('');
  if (allPassed) {
    Logger.log('✓ Quick validation passed');
  } else {
    Logger.log('✗ Quick validation failed - run full validation');
  }

  return allPassed;
}

/**
 * Alias for the main validation function
 * Makes it easy to remember and run
 */
function validateBeforePush() {
  return runPrePushValidation();
}

/**
 * Just run the tests (no other checks)
 */
function testOnly() {
  Logger.log('Running tests only...\n');
  const results = runAllTests();

  if (results.failedTests === 0) {
    Logger.log('\n✓ All tests passed\n');
    return true;
  } else {
    Logger.log(`\n✗ ${results.failedTests} test(s) failed\n`);
    return false;
  }
}
