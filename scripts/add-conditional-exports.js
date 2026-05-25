#!/usr/bin/env node

/**
 * Add conditional module.exports to all src/ files
 * This allows files to work in both Jest (Node.js) and Google Apps Script
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '../src');

/**
 * Extract function and const declarations from code
 */
function extractExports(code) {
  const exports = [];

  // Match function declarations
  const functionRegex = /^(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm;
  let match;
  while ((match = functionRegex.exec(code)) !== null) {
    exports.push(match[1]);
  }

  // Match const/var/let declarations
  const constRegex = /^(?:const|var|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/gm;
  while ((match = constRegex.exec(code)) !== null) {
    exports.push(match[1]);
  }

  return [...new Set(exports)]; // Remove duplicates
}

/**
 * Add conditional exports to a file
 */
function addConditionalExports(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');

  // Skip if already has conditional exports
  if (code.includes('typeof module !== \'undefined\'')) {
    console.log(`  ⏭️  Already has conditional exports`);
    return;
  }

  // Extract exports
  const exports = extractExports(code);

  if (exports.length === 0) {
    console.log(`  ⏭️  No exports found`);
    return;
  }

  // Create conditional export block
  const exportBlock = `
// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ${exports.join(',\n    ')}
  };
}
`;

  // Add to end of file
  const newCode = code.trimEnd() + '\n' + exportBlock;
  fs.writeFileSync(filePath, newCode);

  console.log(`  ✅ Added conditional exports: ${exports.slice(0, 3).join(', ')}${exports.length > 3 ? '...' : ''}`);
}

/**
 * Process directory recursively
 */
function processDirectory(dir) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (item.endsWith('.js') && item !== 'appsscript.json') {
      const relativePath = path.relative(SRC_DIR, fullPath);
      console.log(`Processing: ${relativePath}`);
      addConditionalExports(fullPath);
    }
  }
}

// Main
console.log('🔄 Adding conditional exports to src/ files...\n');
processDirectory(SRC_DIR);
console.log('\n✅ Done!');
