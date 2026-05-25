/**
 * Google Apps Script Global Scope Conflict Detection Tests
 *
 * This test suite validates that no duplicate global identifiers exist across
 * files that will be deployed to Google Apps Script. Since GAS concatenates
 * all files into a single global scope, duplicate identifiers cause runtime errors.
 *
 * This test prevents issues like:
 * - "SyntaxError: Identifier 'X' has already been declared"
 * - Class/function name collisions
 * - Variable redeclaration conflicts
 */

const fs = require('fs');
const path = require('path');

describe('Google Apps Script - Global Scope Validation', () => {
  const SRC_DIR = path.join(__dirname, '..', 'src');
  const CLASP_IGNORE_FILE = path.join(__dirname, '..', '.claspignore');

  /**
   * Parse .claspignore file and return patterns to exclude
   */
  function getClaspIgnorePatterns() {
    if (!fs.existsSync(CLASP_IGNORE_FILE)) {
      return [];
    }

    const content = fs.readFileSync(CLASP_IGNORE_FILE, 'utf8');
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(pattern => {
        // Convert glob patterns to regex-friendly format
        if (pattern.startsWith('!')) {
          return null; // Negation patterns handled separately
        }
        // Simple glob to regex conversion
        return pattern
          .replace(/\./g, '\\.')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*');
      })
      .filter(Boolean);
  }

  /**
   * Check if a file path should be ignored based on .claspignore
   */
  function shouldIgnoreFile(filePath, ignorePatterns) {
    const relativePath = path.relative(path.join(SRC_DIR, '..'), filePath);

    // Always ignore test files
    if (relativePath.includes('test') || relativePath.includes('spec')) {
      return true;
    }

    // Check against ignore patterns
    return ignorePatterns.some(pattern => {
      const regex = new RegExp(pattern);
      return regex.test(relativePath);
    });
  }

  /**
   * Recursively get all .js files in a directory
   */
  function getAllJsFiles(dir, ignorePatterns = [], fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        getAllJsFiles(filePath, ignorePatterns, fileList);
      } else if (file.endsWith('.js') && !shouldIgnoreFile(filePath, ignorePatterns)) {
        fileList.push(filePath);
      }
    });

    return fileList;
  }

  /**
   * Extract top-level declarations from JavaScript code
   * Returns: { classes: [], functions: [], variables: [] }
   */
  function extractTopLevelDeclarations(code, filePath) {
    const declarations = {
      classes: [],
      functions: [],
      variables: []
    };

    // Remove code inside module.exports blocks (Node.js only, not in GAS)
    // Use a simple approach: remove everything between module check and its closing brace
    let gasCode = code;

    // Remove if (typeof module !== 'undefined' && module.exports) blocks
    gasCode = gasCode.replace(/if\s*\(\s*typeof\s+module\s*!==\s*['"]undefined['"]\s*&&\s*module\.exports\s*\)\s*\{[^}]*\}/gs, '');

    // Remove if (typeof require !== 'undefined') blocks
    gasCode = gasCode.replace(/if\s*\(\s*typeof\s+require\s*!==\s*['"]undefined['"]\s*\)\s*\{[^}]*\}/gs, '');

    // Extract class declarations
    const classRegex = /^(?:export\s+)?class\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
    let match;
    while ((match = classRegex.exec(gasCode)) !== null) {
      declarations.classes.push({
        name: match[1],
        type: 'class',
        file: filePath
      });
    }

    // Extract function declarations (not methods inside classes)
    const functionRegex = /^(?:export\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
    while ((match = functionRegex.exec(gasCode)) !== null) {
      declarations.functions.push({
        name: match[1],
        type: 'function',
        file: filePath
      });
    }

    // Extract top-level const/let/var declarations
    // Only match at start of line or after semicolon (top-level)
    const varRegex = /^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
    while ((match = varRegex.exec(gasCode)) !== null) {
      const varName = match[1];

      // Skip common loop variables and obviously local variables
      if (!['i', 'j', 'k', 'x', 'y', 'z', 'err', 'error', 'result', 'data'].includes(varName)) {
        declarations.variables.push({
          name: varName,
          type: 'variable',
          file: filePath
        });
      }
    }

    return declarations;
  }

  /**
   * Find duplicate identifiers across all files
   */
  function findDuplicateIdentifiers(allDeclarations) {
    const identifierMap = new Map();
    const duplicates = [];

    // Build map of all identifiers
    allDeclarations.forEach(fileDecls => {
      const allIdentifiers = [
        ...fileDecls.classes,
        ...fileDecls.functions,
        ...fileDecls.variables
      ];

      allIdentifiers.forEach(decl => {
        if (!identifierMap.has(decl.name)) {
          identifierMap.set(decl.name, []);
        }
        identifierMap.get(decl.name).push(decl);
      });
    });

    // Find duplicates
    identifierMap.forEach((declarations, name) => {
      if (declarations.length > 1) {
        duplicates.push({
          identifier: name,
          declarations: declarations
        });
      }
    });

    return duplicates;
  }

  describe('Global Scope Conflict Detection', () => {
    let allJsFiles;
    let allDeclarations;
    let duplicates;

    beforeAll(() => {
      const ignorePatterns = getClaspIgnorePatterns();
      allJsFiles = getAllJsFiles(SRC_DIR, ignorePatterns);

      allDeclarations = allJsFiles.map(file => {
        const code = fs.readFileSync(file, 'utf8');
        return extractTopLevelDeclarations(code, file);
      });

      duplicates = findDuplicateIdentifiers(allDeclarations);
    });

    it('should find JavaScript files to analyze', () => {
      expect(allJsFiles.length).toBeGreaterThan(0);
    });

    it('should not have duplicate class names across files', () => {
      const classDuplicates = duplicates.filter(dup =>
        dup.declarations.some(d => d.type === 'class')
      );

      if (classDuplicates.length > 0) {
        const errorMessage = classDuplicates.map(dup => {
          const files = dup.declarations.map(d =>
            `  - ${path.relative(SRC_DIR, d.file)} (${d.type})`
          ).join('\n');
          return `\nDuplicate identifier "${dup.identifier}" found in:\n${files}`;
        }).join('\n');

        throw new Error(`Global scope conflicts detected:${errorMessage}\n\nIn Google Apps Script, all files share a global scope. Rename one of the conflicting identifiers.`);
      }
    });

    it('should not have duplicate function names across files', () => {
      const functionDuplicates = duplicates.filter(dup =>
        dup.declarations.every(d => d.type === 'function')
      );

      if (functionDuplicates.length > 0) {
        const errorMessage = functionDuplicates.map(dup => {
          const files = dup.declarations.map(d =>
            `  - ${path.relative(SRC_DIR, d.file)}`
          ).join('\n');
          return `\nDuplicate function "${dup.identifier}" found in:\n${files}`;
        }).join('\n');

        throw new Error(`Global function conflicts detected:${errorMessage}\n\nConsider renaming or using unique prefixes for your functions.`);
      }
    });

    it('should not have conflicting top-level variable declarations', () => {
      const varDuplicates = duplicates.filter(dup =>
        dup.declarations.some(d => d.type === 'variable')
      );

      if (varDuplicates.length > 0) {
        const errorMessage = varDuplicates.map(dup => {
          const files = dup.declarations.map(d =>
            `  - ${path.relative(SRC_DIR, d.file)} (${d.type})`
          ).join('\n');
          return `\nDuplicate variable "${dup.identifier}" found in:\n${files}`;
        }).join('\n');

        throw new Error(`Global variable conflicts detected:${errorMessage}\n\nMove variables inside functions or use unique names.`);
      }
    });

    it('should extract declarations correctly from sample files', () => {
      // Test that our extraction logic works
      const sampleCode = `class TestClass {}
function testFunction() {}
const TEST_CONSTANT = 'value';

if (typeof module !== 'undefined' && module.exports) {
  const NodeOnlyVar = 'this should be ignored';
}`;

      const decls = extractTopLevelDeclarations(sampleCode, 'test.js');

      expect(decls.classes.some(c => c.name === 'TestClass')).toBe(true);
      expect(decls.functions.some(f => f.name === 'testFunction')).toBe(true);
      expect(decls.variables.some(v => v.name === 'TEST_CONSTANT')).toBe(true);
      expect(decls.variables.some(v => v.name === 'NodeOnlyVar')).toBe(false);
    });
  });

  describe('Service Adapters Specific Checks', () => {
    it('should not redeclare adapter classes in index.js', () => {
      const indexPath = path.join(SRC_DIR, 'core', 'services', 'index.js');
      const gmailAdapterPath = path.join(SRC_DIR, 'core', 'services', 'gmail-adapter.js');

      if (!fs.existsSync(indexPath) || !fs.existsSync(gmailAdapterPath)) {
        return; // Skip if files don't exist
      }

      const indexCode = fs.readFileSync(indexPath, 'utf8');
      const indexDecls = extractTopLevelDeclarations(indexCode, indexPath);

      const adapterCode = fs.readFileSync(gmailAdapterPath, 'utf8');
      const adapterDecls = extractTopLevelDeclarations(adapterCode, gmailAdapterPath);

      const adapterClassNames = adapterDecls.classes.map(c => c.name);
      const indexClassNames = indexDecls.classes.map(c => c.name);
      const indexVarNames = indexDecls.variables.map(v => v.name);

      // Check for conflicts
      const conflicts = adapterClassNames.filter(name =>
        indexClassNames.includes(name) || indexVarNames.includes(name)
      );

      if (conflicts.length > 0) {
        throw new Error(`The index.js file should not redeclare adapter classes. Found conflicts: ${conflicts.join(', ')}\n\nAdapter classes are already globally available in GAS. Don't redeclare them outside of module.exports blocks.`);
      }
    });
  });

  describe('Node.js Compatibility Checks', () => {
    it('should only use require() inside module check blocks', () => {
      const ignorePatterns = getClaspIgnorePatterns();
      const files = getAllJsFiles(SRC_DIR, ignorePatterns);
      const violations = [];

      files.forEach(file => {
        const code = fs.readFileSync(file, 'utf8');
        const lines = code.split('\n');

        lines.forEach((line, index) => {
          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('/*')) {
            return;
          }

          // Check for require() usage
          if (line.includes('require(') && !line.trim().startsWith('*')) {
            // Check if this line is inside a conditional check block
            const beforeLine = code.substring(0, code.indexOf(line));
            const lastModuleCheck = beforeLine.lastIndexOf('if (typeof module');
            const lastRequireCheck = beforeLine.lastIndexOf('if (typeof require');
            const lastClosingBrace = beforeLine.lastIndexOf('}');

            const lastCheck = Math.max(lastModuleCheck, lastRequireCheck);

            // If require() appears outside of any check block
            if (lastCheck === -1 || lastClosingBrace > lastCheck) {
              violations.push({
                file: path.relative(SRC_DIR, file),
                line: index + 1,
                code: line.trim()
              });
            }
          }
        });
      });

      if (violations.length > 0) {
        const errorMessage = violations.map(v =>
          `  ${v.file}:${v.line} - ${v.code}`
        ).join('\n');

        throw new Error(`Found require() calls outside of conditional checks:\n${errorMessage}\n\nAll require() calls should be inside 'if (typeof module !== "undefined")' or 'if (typeof require !== "undefined")' blocks to prevent GAS errors.`);
      }
    });
  });
});
