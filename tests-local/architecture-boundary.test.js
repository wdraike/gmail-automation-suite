/**
 * Architecture Boundary Guard (full-hexagonal-conversion)
 *
 * Enforces the hexagonal invariant for the WHOLE application: domain/feature,
 * presentation, utility, and non-adapter core code MUST access the platform
 * (Google Apps Script SDKs + Gemini) ONLY through the ports in
 * `src/core/services`. Direct references to platform SDKs anywhere OUTSIDE the
 * adapter ring (`src/core/services/**`) are architecture violations and fail
 * this test.
 *
 * Scanned (the four non-adapter layers):
 *   - src/features/**   (domain / feature logic)
 *   - src/ui/**         (presentation)
 *   - src/utils/**      (utilities)
 *   - src/core/**       EXCEPT src/core/services/** (application services / infra)
 *
 * NOT scanned (the allowed-SDK ring):
 *   - src/core/services/**  (the adapters — direct SDK use here is CORRECT)
 *   - src/dev/**            (developer scratch scripts, not deployed app logic)
 *
 * Allowed everywhere: `UnifiedCacheService` (app-level service); comments/prose.
 *
 * Documented exception (ADR-001 D2): `src/core/api-service.js` DEFINES the global
 * `callGeminiApi` (it is the Gemini infra the GeminiAdapter wraps). The
 * definition + export of that single token in that single file is whitelisted;
 * every other file is forbidden from referencing `callGeminiApi` and must use
 * `serviceFactory.getGeminiAdapter()`.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const FEATURES_DIR = path.join(SRC_DIR, 'features');
const UI_DIR = path.join(SRC_DIR, 'ui');
const UTILS_DIR = path.join(SRC_DIR, 'utils');
const CORE_DIR = path.join(SRC_DIR, 'core');

// The allowed-SDK ring — excluded from scanning.
const ADAPTER_RING = path.join(CORE_DIR, 'services');
// Developer scratch scripts — not deployed app logic.
const DEV_DIR = path.join(SRC_DIR, 'dev');

// Forbidden platform tokens. Each entry is matched per-line; matches preceded by
// an allowed prefix (e.g. UnifiedCacheService) are excluded.
const FORBIDDEN = [
  { name: 'GmailApp', re: /\bGmailApp\b/ },
  { name: 'SpreadsheetApp', re: /\bSpreadsheetApp\b/ },
  { name: 'DriveApp', re: /\bDriveApp\b/ },
  { name: 'UrlFetchApp', re: /\bUrlFetchApp\b/ },
  { name: 'PropertiesService', re: /\bPropertiesService\b/ },
  // CacheService — but NOT UnifiedCacheService (app-level service, allowed)
  { name: 'CacheService', re: /(?<!Unified)\bCacheService\b/ },
  { name: 'MailApp', re: /\bMailApp\b/ },
  // Session.<method> — the Session SDK global (not e.g. someSession.foo)
  { name: 'Session.', re: /\bSession\s*\./ },
  { name: 'Utilities.', re: /\bUtilities\s*\./ },
  // The legacy Gemini global — must go through GeminiAdapter
  { name: 'callGeminiApi', re: /\bcallGeminiApi\b/ },
  // The legacy Gmail wrapper — must use GmailAdapter instead
  { name: 'GmailService.', re: /\bGmailService\s*\./ },
];

// Per-file token whitelist (ADR-001 documented exceptions).
// api-service.js is permitted to define/export the callGeminiApi global.
const WHITELIST = {
  [path.join(CORE_DIR, 'api-service.js')]: new Set(['callGeminiApi']),
};

/** Recursively collect all .js files under a directory, excluding `excludeDirs`. */
function collectJsFiles(dir, excludeDirs = []) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (excludeDirs.some((ex) => full === ex || full.startsWith(ex + path.sep))) {
      continue;
    }
    if (entry.isDirectory()) {
      out.push(...collectJsFiles(full, excludeDirs));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

/** Strip line comments and block comments so prose mentioning a token is allowed. */
function stripComments(code) {
  let out = code.replace(/\/\*[\s\S]*?\*\//g, '');
  out = out.replace(/(^|[^:])\/\/.*$/gm, '$1');
  return out;
}

/** Collect every scanned (non-adapter) file across the four layers. */
function collectScannedFiles() {
  return [
    ...collectJsFiles(FEATURES_DIR),
    ...collectJsFiles(UI_DIR),
    ...collectJsFiles(UTILS_DIR),
    // core, excluding the adapter ring and dev scratch
    ...collectJsFiles(CORE_DIR, [ADAPTER_RING, DEV_DIR]),
  ];
}

/** Scan a list of files; return array of violation strings. */
function scanFiles(files) {
  const violations = [];
  for (const file of files) {
    const whitelist = WHITELIST[file] || new Set();
    const code = stripComments(fs.readFileSync(file, 'utf8'));
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      for (const token of FORBIDDEN) {
        if (whitelist.has(token.name)) continue;
        if (token.re.test(line)) {
          violations.push(
            `${path.relative(SRC_DIR, file)}:${index + 1} - ${token.name} - ${line.trim()}`
          );
        }
      }
    });
  }
  return violations;
}

describe('Architecture boundary — all non-adapter layers must use core/services ports', () => {
  const files = collectScannedFiles();

  it('finds source files to scan across features, ui, utils, and non-adapter core', () => {
    expect(files.length).toBeGreaterThan(0);
    // sanity: at least one file from each layer is present
    const rels = files.map((f) => path.relative(SRC_DIR, f));
    expect(rels.some((r) => r.startsWith('features' + path.sep))).toBe(true);
    expect(rels.some((r) => r.startsWith('ui' + path.sep))).toBe(true);
    expect(rels.some((r) => r.startsWith('utils' + path.sep))).toBe(true);
    expect(rels.some((r) => r.startsWith('core' + path.sep) && !r.startsWith('core' + path.sep + 'services'))).toBe(true);
  });

  it('does not scan the adapter ring (src/core/services/**)', () => {
    const rels = files.map((f) => path.relative(SRC_DIR, f));
    expect(rels.some((r) => r.startsWith('core' + path.sep + 'services'))).toBe(false);
  });

  it('has no direct platform SDK or legacy-wrapper references outside src/core/services/**', () => {
    const violations = scanFiles(files);

    if (violations.length > 0) {
      throw new Error(
        'Hexagonal boundary violation: non-adapter layers must access the platform ' +
          'only through src/core/services ports.\n' +
          violations.join('\n')
      );
    }

    expect(violations).toEqual([]);
  });

  // Meta-test: prove the guard actually catches a planted violation in EACH
  // newly-covered directory. We write a temp file containing a forbidden token,
  // confirm the scanner flags it, then remove it.
  describe('guard catches planted violations (self-test)', () => {
    const plantDirs = [
      { label: 'features', dir: FEATURES_DIR },
      { label: 'ui', dir: UI_DIR },
      { label: 'utils', dir: UTILS_DIR },
      { label: 'core (non-adapter)', dir: CORE_DIR },
    ];

    for (const { label, dir } of plantDirs) {
      it(`flags a planted GmailApp reference in ${label}`, () => {
        const planted = path.join(dir, '__boundary_plant__.js');
        fs.writeFileSync(planted, 'function x() { return GmailApp.getUserLabels(); }\n');
        try {
          const violations = scanFiles([planted]);
          expect(violations.length).toBeGreaterThan(0);
          expect(violations[0]).toContain('GmailApp');
        } finally {
          fs.unlinkSync(planted);
        }
      });
    }

    it('does NOT flag callGeminiApi in the whitelisted api-service.js', () => {
      const apiSvc = path.join(CORE_DIR, 'api-service.js');
      const violations = scanFiles([apiSvc]);
      const cgaViolations = violations.filter((v) => v.includes('callGeminiApi'));
      expect(cgaViolations).toEqual([]);
    });
  });
});
