/**
 * Service Adapters - Main Export
 * Centralized access to all service adapters
 *
 * Note: In Google Apps Script, the adapter classes (GmailAdapter, SpreadsheetAdapter, DriveAdapter)
 * are globally available from their respective files. This factory provides a way to inject
 * mock services for testing in Node.js environments.
 */

// Load adapters for Node.js environment only
// In GAS, these will be undefined (but the global classes will be available)
let _GmailAdapter, _SpreadsheetAdapter, _DriveAdapter;
let _GeminiAdapter, _PropertiesAdapter, _UtilitiesAdapter;
let _HttpAdapter, _CacheAdapter;

/* istanbul ignore else -- in Node/Jest `require` is always defined so this block always runs; in GAS the adapter classes are concatenated globals and this require block is skipped. The else (no-op) is never exercised in the test runtime. */
if (typeof require !== 'undefined') {
  _GmailAdapter = require('./gmail-adapter.js').GmailAdapter;
  _SpreadsheetAdapter = require('./spreadsheet-adapter.js').SpreadsheetAdapter;
  _DriveAdapter = require('./drive-adapter.js').DriveAdapter;
  _GeminiAdapter = require('./gemini-adapter.js').GeminiAdapter;
  _PropertiesAdapter = require('./properties-adapter.js').PropertiesAdapter;
  _UtilitiesAdapter = require('./utilities-adapter.js').UtilitiesAdapter;
  _HttpAdapter = require('./http-adapter.js').HttpAdapter;
  _CacheAdapter = require('./cache-adapter.js').CacheAdapter;
}

/**
 * Service factory - creates adapter instances
 * Can be overridden for testing by passing mock services
 */
class ServiceFactory {
  constructor(services = {}) {
    this.services = services;
  }

  getGmailAdapter() {
    if (!this._gmailAdapter) {
      // Use loaded class in Node.js, or global in GAS
      /* istanbul ignore next -- dual-env class resolution: in Node `_GmailAdapter` (required above) is always truthy so the GAS-global `typeof` fallback and the `if (!AdapterClass) throw` guard are unreachable. They only matter in GAS where the global class is concatenated. */
      const AdapterClass = _GmailAdapter || (typeof GmailAdapter !== 'undefined' ? GmailAdapter : null);
      /* istanbul ignore if -- AdapterClass is always the required class in Node; the throw is a GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('GmailAdapter is not available');
      }
      this._gmailAdapter = new AdapterClass(this.services.GmailApp || GmailApp);
    }
    return this._gmailAdapter;
  }

  getSpreadsheetAdapter() {
    if (!this._spreadsheetAdapter) {
      /* istanbul ignore next -- dual-env class resolution (see getGmailAdapter); in Node `_SpreadsheetAdapter` is always truthy so the GAS-global fallback and throw are unreachable. */
      const AdapterClass = _SpreadsheetAdapter || (typeof SpreadsheetAdapter !== 'undefined' ? SpreadsheetAdapter : null);
      /* istanbul ignore if -- GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('SpreadsheetAdapter is not available');
      }
      this._spreadsheetAdapter = new AdapterClass(
        this.services.SpreadsheetApp || SpreadsheetApp
      );
    }
    return this._spreadsheetAdapter;
  }

  getDriveAdapter() {
    if (!this._driveAdapter) {
      /* istanbul ignore next -- dual-env class resolution (see getGmailAdapter); in Node `_DriveAdapter` is always truthy so the GAS-global fallback and throw are unreachable. */
      const AdapterClass = _DriveAdapter || (typeof DriveAdapter !== 'undefined' ? DriveAdapter : null);
      /* istanbul ignore if -- GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('DriveAdapter is not available');
      }
      this._driveAdapter = new AdapterClass(this.services.DriveApp || DriveApp);
    }
    return this._driveAdapter;
  }

  getGeminiAdapter() {
    if (!this._geminiAdapter) {
      /* istanbul ignore next -- dual-env class resolution (see getGmailAdapter); in Node `_GeminiAdapter` is always truthy so the GAS-global fallback and throw are unreachable. */
      const AdapterClass = _GeminiAdapter || (typeof GeminiAdapter !== 'undefined' ? GeminiAdapter : null);
      /* istanbul ignore if -- GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('GeminiAdapter is not available');
      }
      this._geminiAdapter = new AdapterClass(
        /* istanbul ignore next -- the `: undefined` arm is a GAS-only guard for when the callGeminiApi global is absent; under test the global always exists, so only the left/true arms run. */
        this.services.callGeminiApi || (typeof callGeminiApi !== 'undefined' ? callGeminiApi : undefined)
      );
    }
    return this._geminiAdapter;
  }

  getPropertiesAdapter() {
    if (!this._propertiesAdapter) {
      /* istanbul ignore next -- dual-env class resolution (see getGmailAdapter); in Node `_PropertiesAdapter` is always truthy so the GAS-global fallback and throw are unreachable. */
      const AdapterClass = _PropertiesAdapter || (typeof PropertiesAdapter !== 'undefined' ? PropertiesAdapter : null);
      /* istanbul ignore if -- GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('PropertiesAdapter is not available');
      }
      this._propertiesAdapter = new AdapterClass(
        this.services.PropertiesService || PropertiesService
      );
    }
    return this._propertiesAdapter;
  }

  getUtilitiesAdapter() {
    if (!this._utilitiesAdapter) {
      /* istanbul ignore next -- dual-env class resolution (see getGmailAdapter); in Node `_UtilitiesAdapter` is always truthy so the GAS-global fallback and throw are unreachable. */
      const AdapterClass = _UtilitiesAdapter || (typeof UtilitiesAdapter !== 'undefined' ? UtilitiesAdapter : null);
      /* istanbul ignore if -- GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('UtilitiesAdapter is not available');
      }
      this._utilitiesAdapter = new AdapterClass(
        this.services.Utilities || Utilities
      );
    }
    return this._utilitiesAdapter;
  }

  getHttpAdapter() {
    if (!this._httpAdapter) {
      /* istanbul ignore next -- dual-env class resolution (see getGmailAdapter); in Node `_HttpAdapter` is always truthy so the GAS-global fallback and throw are unreachable. */
      const AdapterClass = _HttpAdapter || (typeof HttpAdapter !== 'undefined' ? HttpAdapter : null);
      /* istanbul ignore if -- GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('HttpAdapter is not available');
      }
      this._httpAdapter = new AdapterClass(
        /* istanbul ignore next -- the `: undefined` arm is a GAS-only guard for when the UrlFetchApp global is absent; under test the global always exists, so only the left/true arms run. */
        this.services.UrlFetchApp || (typeof UrlFetchApp !== 'undefined' ? UrlFetchApp : undefined)
      );
    }
    return this._httpAdapter;
  }

  getCacheAdapter() {
    if (!this._cacheAdapter) {
      /* istanbul ignore next -- dual-env class resolution (see getGmailAdapter); in Node `_CacheAdapter` is always truthy so the GAS-global fallback and throw are unreachable. */
      const AdapterClass = _CacheAdapter || (typeof CacheAdapter !== 'undefined' ? CacheAdapter : null);
      /* istanbul ignore if -- GAS-only misconfiguration guard. */
      if (!AdapterClass) {
        throw new Error('CacheAdapter is not available');
      }
      this._cacheAdapter = new AdapterClass(
        /* istanbul ignore next -- the `: undefined` arm is a GAS-only guard for when the CacheService global is absent; under test the global always exists, so only the left/true arms run. */
        this.services.CacheService || (typeof CacheService !== 'undefined' ? CacheService : undefined)
      );
    }
    return this._cacheAdapter;
  }

  /**
   * Reset all adapters (useful for testing)
   */
  reset() {
    this._gmailAdapter = null;
    this._spreadsheetAdapter = null;
    this._driveAdapter = null;
    this._geminiAdapter = null;
    this._propertiesAdapter = null;
    this._utilitiesAdapter = null;
    this._httpAdapter = null;
    this._cacheAdapter = null;
  }
}

// Create singleton instance
const serviceFactory = new ServiceFactory();

// Export for Node.js testing
/* istanbul ignore next -- the `typeof module` guard is always true under Node/Jest and always false in GAS; the false branch is never taken in the test runtime. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ServiceFactory,
    serviceFactory,
    GmailAdapter: _GmailAdapter,
    SpreadsheetAdapter: _SpreadsheetAdapter,
    DriveAdapter: _DriveAdapter,
    GeminiAdapter: _GeminiAdapter,
    PropertiesAdapter: _PropertiesAdapter,
    UtilitiesAdapter: _UtilitiesAdapter,
    HttpAdapter: _HttpAdapter,
    CacheAdapter: _CacheAdapter
  };
}
