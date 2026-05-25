#!/usr/bin/env node

/**
 * Update test files to use require() instead of eval()
 *
 * This script converts all test files from:
 *   const code = fs.readFileSync('../src/file.js', 'utf8');
 *   eval(code);
 *
 * To:
 *   const { func1, func2 } = require('../src-modules/file.js');
 */

const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '../tests-local');

// Mapping of file paths to update
const FILE_MAPPINGS = {
  '../src/core/config.js': '../src-modules/core/config.js',
  '../src/core/api-service.js': '../src-modules/core/api-service.js',
  '../src/core/gmail-service.js': '../src-modules/core/gmail-service.js',
  '../src/core/cache-service.js': '../src-modules/core/cache-service.js',
  '../src/features/email-sorter.js': '../src-modules/features/email-sorter.js',
  '../src/features/email-categorizer-cache.js': '../src-modules/features/email-categorizer-cache.js',
  '../src/features/email-retention-manager.js': '../src-modules/features/email-retention-manager.js'
};

function updateTestFile(filePath) {
  console.log(`Updating: ${path.basename(filePath)}`);

  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Replace each file mapping
  for (const [oldPath, newPath] of Object.entries(FILE_MAPPINGS)) {
    // Pattern: fs.readFileSync(...) followed by eval()
    const oldPattern = new RegExp(
      `const\\s+(\\w+Code)\\s*=\\s*fs\\.readFileSync\\(path\\.join\\(__dirname,\\s*'${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\),\\s*'utf8'\\);`,
      'g'
    );

    if (oldPattern.test(content)) {
      // Find what code variable is used
      const codeVarMatch = content.match(oldPattern);
      if (codeVarMatch) {
        // Mark for replacement
        modified = true;
        console.log(`  Found: ${oldPath} -> ${newPath}`);
      }
    }
  }

  if (modified) {
    // For each test file, we need to replace the entire load-and-eval pattern
    // with a require statement. This is complex, so let's do it carefully.

    // Strategy: Replace the fs.readFileSync + any modifications + eval pattern
    // with a simple require()

    content = content.replace(
      /const\s+(\w+Code)\s*=\s*fs\.readFileSync\(path\.join\(__dirname,\s*'([^']+)'\),\s*'utf8'\);\s*(?:\/\/[^\n]*\n)*(?:const\s+modified\w+\s*=[\s\S]*?eval\(modified\w+\);|eval\(\1\);)/g,
      (match, codeVar, filePath) => {
        const newPath = FILE_MAPPINGS[filePath];
        if (newPath) {
          return `// Module import (replaces fs.readFileSync + eval)\nconst moduleExports = require('${newPath}');`;
        }
        return match;
      }
    );

    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated`);
  } else {
    console.log(`  ⏭️  No changes needed`);
  }
}

function main() {
  console.log('🔄 Updating test files to use require() instead of eval()...\n');

  const testFiles = fs.readdirSync(TESTS_DIR)
    .filter(f => f.endsWith('.test.js'))
    .map(f => path.join(TESTS_DIR, f));

  for (const file of testFiles) {
    updateTestFile(file);
  }

  console.log('\n✅ Test files updated!');
  console.log('\n💡 Note: You may need to manually adjust destructuring imports');
  console.log('   Example: const { funcName } = moduleExports;');
}

if (require.main === module) {
  main();
}
