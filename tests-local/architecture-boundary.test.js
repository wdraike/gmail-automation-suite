/**
 * Architecture Boundary Guard (hexagonal-ports-refactor)
 *
 * Enforces the hexagonal invariant: domain/feature code under src/features/**
 * MUST access the platform (Google Apps Script SDKs + Gemini) ONLY through the
 * ports in src/core/services. Direct references to platform SDKs in src/features
 * are architecture violations and fail this test.
 *
 * Allowed in src/features: the port adapters (GmailAdapter, SpreadsheetAdapter,
 * DriveAdapter, GeminiAdapter, PropertiesAdapter, UtilitiesAdapter) obtained via
 * serviceFactory, and app-level services such as UnifiedCacheService.
 *
 * The platform SDKs themselves (and the core/services ports) live under
 * src/core and are intentionally NOT scanned.
 */

const fs = require('fs');
const path = require('path');

const FEATURES_DIR = path.join(__dirname, '..', 'src', 'features');

// Forbidden platform tokens. Each entry is matched per-line; matches preceded by
// an allowed prefix (e.g. UnifiedCacheService) are excluded.
const FORBIDDEN = [
  { name: 'GmailApp', re: /\bGmailApp\b/ },
  { name: 'SpreadsheetApp', re: /\bSpreadsheetApp\b/ },
  { name: 'DriveApp', re: /\bDriveApp\b/ },
  { name: 'UrlFetchApp', re: /\bUrlFetchApp\b/ },
  // PropertiesService — but not a token that merely ends in it
  { name: 'PropertiesService', re: /\bPropertiesService\b/ },
  // CacheService — but NOT UnifiedCacheService (app-level service, allowed)
  { name: 'CacheService', re: /(?<!Unified)\bCacheService\b/ },
  { name: 'Utilities.', re: /\bUtilities\s*\./ },
  // The legacy Gemini global — must go through GeminiAdapter
  { name: 'callGeminiApi', re: /\bcallGeminiApi\b/ },
  // The legacy Gmail wrapper — features must use GmailAdapter instead
  { name: 'GmailService.', re: /\bGmailService\s*\./ },
];

/** Recursively collect all .js files under a directory. */
function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

/** Strip line comments and block comments so prose mentioning a token is allowed. */
function stripComments(code) {
  // Remove block comments
  let out = code.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove line comments
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

describe('Architecture boundary — src/features must use core/services ports', () => {
  const files = collectJsFiles(FEATURES_DIR);

  it('finds feature source files to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('has no direct platform SDK or legacy-wrapper references in src/features/**', () => {
    const violations = [];

    for (const file of files) {
      const code = stripComments(fs.readFileSync(file, 'utf8'));
      const lines = code.split('\n');
      lines.forEach((line, index) => {
        for (const token of FORBIDDEN) {
          if (token.re.test(line)) {
            violations.push(
              `${path.relative(FEATURES_DIR, file)}:${index + 1} - ${token.name} - ${line.trim()}`
            );
          }
        }
      });
    }

    if (violations.length > 0) {
      throw new Error(
        'Hexagonal boundary violation: src/features must access the platform only ' +
          'through src/core/services ports.\n' +
          violations.join('\n')
      );
    }

    expect(violations).toEqual([]);
  });
});
