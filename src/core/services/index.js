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

if (typeof require !== 'undefined') {
  _GmailAdapter = require('./gmail-adapter.js').GmailAdapter;
  _SpreadsheetAdapter = require('./spreadsheet-adapter.js').SpreadsheetAdapter;
  _DriveAdapter = require('./drive-adapter.js').DriveAdapter;
  _GeminiAdapter = require('./gemini-adapter.js').GeminiAdapter;
  _PropertiesAdapter = require('./properties-adapter.js').PropertiesAdapter;
  _UtilitiesAdapter = require('./utilities-adapter.js').UtilitiesAdapter;
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
      const AdapterClass = _GmailAdapter || (typeof GmailAdapter !== 'undefined' ? GmailAdapter : null);
      if (!AdapterClass) {
        throw new Error('GmailAdapter is not available');
      }
      this._gmailAdapter = new AdapterClass(this.services.GmailApp || GmailApp);
    }
    return this._gmailAdapter;
  }

  getSpreadsheetAdapter() {
    if (!this._spreadsheetAdapter) {
      const AdapterClass = _SpreadsheetAdapter || (typeof SpreadsheetAdapter !== 'undefined' ? SpreadsheetAdapter : null);
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
      const AdapterClass = _DriveAdapter || (typeof DriveAdapter !== 'undefined' ? DriveAdapter : null);
      if (!AdapterClass) {
        throw new Error('DriveAdapter is not available');
      }
      this._driveAdapter = new AdapterClass(this.services.DriveApp || DriveApp);
    }
    return this._driveAdapter;
  }

  getGeminiAdapter() {
    if (!this._geminiAdapter) {
      const AdapterClass = _GeminiAdapter || (typeof GeminiAdapter !== 'undefined' ? GeminiAdapter : null);
      if (!AdapterClass) {
        throw new Error('GeminiAdapter is not available');
      }
      this._geminiAdapter = new AdapterClass(
        this.services.callGeminiApi || (typeof callGeminiApi !== 'undefined' ? callGeminiApi : undefined)
      );
    }
    return this._geminiAdapter;
  }

  getPropertiesAdapter() {
    if (!this._propertiesAdapter) {
      const AdapterClass = _PropertiesAdapter || (typeof PropertiesAdapter !== 'undefined' ? PropertiesAdapter : null);
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
      const AdapterClass = _UtilitiesAdapter || (typeof UtilitiesAdapter !== 'undefined' ? UtilitiesAdapter : null);
      if (!AdapterClass) {
        throw new Error('UtilitiesAdapter is not available');
      }
      this._utilitiesAdapter = new AdapterClass(
        this.services.Utilities || Utilities
      );
    }
    return this._utilitiesAdapter;
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
  }
}

// Create singleton instance
const serviceFactory = new ServiceFactory();

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ServiceFactory,
    serviceFactory,
    GmailAdapter: _GmailAdapter,
    SpreadsheetAdapter: _SpreadsheetAdapter,
    DriveAdapter: _DriveAdapter,
    GeminiAdapter: _GeminiAdapter,
    PropertiesAdapter: _PropertiesAdapter,
    UtilitiesAdapter: _UtilitiesAdapter
  };
}
