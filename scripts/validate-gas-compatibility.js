#!/usr/bin/env node

/**
 * Google Apps Script Compatibility Validator
 *
 * This script validates that code is compatible with Google Apps Script's
 * unique runtime environment before deployment.
 *
 * Run this before `clasp push` to catch potential issues.
 *
 * Usage:
 *   node scripts/validate-gas-compatibility.js
 *   npm run test:gas-compat
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('');
  log('═══════════════════════════════════════════════════════════════', 'cyan');
  log(`  ${message}`, 'bright');
  log('═══════════════════════════════════════════════════════════════', 'cyan');
  console.log('');
}

function logStep(step, total, message) {
  log(`[${step}/${total}] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

/**
 * Run Jest tests for GAS compatibility
 */
function runGasCompatibilityTests() {
  try {
    logStep(1, 5, 'Running GAS global scope conflict tests...');

    execSync('npx jest tests-local/gas-global-scope.test.js --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    logSuccess('Global scope validation passed');
    return true;
  } catch (error) {
    logError('Global scope validation failed');
    return false;
  }
}

/**
 * Run service adapter integration tests
 */
function runServiceAdapterTests() {
  try {
    logStep(2, 5, 'Running service adapter integration tests...');

    execSync('npx jest tests-local/service-adapters.test.js --verbose', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    logSuccess('Service adapter tests passed');
    return true;
  } catch (error) {
    logError('Service adapter tests failed');
    return false;
  }
}

/**
 * Check for unsupported ES6+ features
 */
function checkUnsupportedFeatures() {
  logStep(3, 5, 'Checking for unsupported ES6+ features...');

  const srcDir = path.join(__dirname, '..', 'src');
  const warnings = [];

  function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(srcDir, filePath);

    // Check for async/await (GAS V8 runtime supports this, but good to track)
    const asyncCount = (content.match(/\basync\s+function\b/g) || []).length;
    if (asyncCount > 0) {
      warnings.push(`${relativePath}: Uses async/await (${asyncCount} times) - Ensure V8 runtime is enabled`);
    }

    // Check for import/export statements (not supported in GAS)
    const importMatch = content.match(/^import\s+/gm);
    if (importMatch) {
      warnings.push(`${relativePath}: Uses ES6 import statements - Not supported in GAS`);
    }

    const exportMatch = content.match(/^export\s+(default|const|class|function)/gm);
    if (exportMatch && !content.includes('typeof module')) {
      warnings.push(`${relativePath}: Uses ES6 export statements outside module blocks`);
    }
  }

  function walkDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        walkDirectory(filePath);
      } else if (file.endsWith('.js') && !file.includes('test')) {
        checkFile(filePath);
      }
    });
  }

  walkDirectory(srcDir);

  if (warnings.length > 0) {
    logWarning(`Found ${warnings.length} potential compatibility issues:`);
    warnings.forEach(w => console.log(`  - ${w}`));
    return true; // Don't fail, just warn
  } else {
    logSuccess('No unsupported features detected');
    return true;
  }
}

/**
 * Validate .clasp.json configuration
 */
function validateClaspConfig() {
  logStep(4, 5, 'Validating .clasp.json configuration...');

  const claspConfigPath = path.join(__dirname, '..', '.clasp.json');

  if (!fs.existsSync(claspConfigPath)) {
    logError('.clasp.json not found');
    return false;
  }

  try {
    const config = JSON.parse(fs.readFileSync(claspConfigPath, 'utf8'));

    // Check required fields
    if (!config.scriptId) {
      logError('scriptId is missing in .clasp.json');
      return false;
    }

    if (!config.rootDir) {
      logWarning('rootDir is not specified in .clasp.json');
    }

    // Validate rootDir exists
    if (config.rootDir) {
      const rootDir = path.join(__dirname, '..', config.rootDir);
      if (!fs.existsSync(rootDir)) {
        logError(`rootDir "${config.rootDir}" does not exist`);
        return false;
      }
    }

    logSuccess('.clasp.json configuration is valid');
    return true;
  } catch (error) {
    logError(`Error parsing .clasp.json: ${error.message}`);
    return false;
  }
}

/**
 * Check for accidentally committed sensitive data
 */
function checkForSensitiveData() {
  logStep(5, 5, 'Checking for sensitive data...');

  const srcDir = path.join(__dirname, '..', 'src');
  const sensitivePatterns = [
    { pattern: /AIza[0-9A-Za-z-_]{35}/, description: 'Google API Key' },
    { pattern: /sk-[a-zA-Z0-9]{48}/, description: 'OpenAI API Key' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/, description: 'GitHub Personal Access Token' },
    { pattern: /"password"\s*:\s*"[^"]+"/i, description: 'Hardcoded password' }
  ];

  const findings = [];

  function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(srcDir, filePath);

    sensitivePatterns.forEach(({ pattern, description }) => {
      if (pattern.test(content)) {
        findings.push(`${relativePath}: Possible ${description} detected`);
      }
    });
  }

  function walkDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        walkDirectory(filePath);
      } else if (file.endsWith('.js') && !file.includes('test')) {
        checkFile(filePath);
      }
    });
  }

  walkDirectory(srcDir);

  if (findings.length > 0) {
    logError('Possible sensitive data found:');
    findings.forEach(f => console.log(`  ${f}`));
    logWarning('Review these files and remove any hardcoded credentials before deploying');
    return false; // Fail if sensitive data found
  } else {
    logSuccess('No sensitive data detected');
    return true;
  }
}

/**
 * Main validation function
 */
function main() {
  logHeader('Google Apps Script Compatibility Validation');

  const results = {
    gasTests: false,
    adapterTests: false,
    features: false,
    claspConfig: false,
    sensitiveData: false
  };

  // Run all checks
  results.gasTests = runGasCompatibilityTests();
  console.log('');

  results.adapterTests = runServiceAdapterTests();
  console.log('');

  results.features = checkUnsupportedFeatures();
  console.log('');

  results.claspConfig = validateClaspConfig();
  console.log('');

  results.sensitiveData = checkForSensitiveData();
  console.log('');

  // Print summary
  logHeader('Validation Summary');

  const checks = [
    { name: 'Global Scope Conflicts', passed: results.gasTests },
    { name: 'Service Adapter Tests', passed: results.adapterTests },
    { name: 'Feature Compatibility', passed: results.features },
    { name: 'Clasp Configuration', passed: results.claspConfig },
    { name: 'Sensitive Data Check', passed: results.sensitiveData }
  ];

  checks.forEach(check => {
    const symbol = check.passed ? '✓' : '✗';
    const color = check.passed ? 'green' : 'red';
    log(`${symbol} ${check.name.padEnd(30)} ${check.passed ? 'PASS' : 'FAIL'}`, color);
  });

  console.log('');

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    logHeader('✓ ALL CHECKS PASSED ✓');
    log('Your code is ready for deployment to Google Apps Script.', 'green');
    log('Run: clasp push', 'cyan');
    console.log('');
    process.exit(0);
  } else {
    logHeader('✗ VALIDATION FAILED ✗');
    log('Please fix the issues above before deploying.', 'red');
    console.log('');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
