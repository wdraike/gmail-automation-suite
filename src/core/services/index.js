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

if (typeof require !== 'undefined') {
  _GmailAdapter = require('./gmail-adapter.js').GmailAdapter;
  _SpreadsheetAdapter = require('./spreadsheet-adapter.js').SpreadsheetAdapter;
  _DriveAdapter = require('./drive-adapter.js').DriveAdapter;
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

  /**
   * Reset all adapters (useful for testing)
   */
  reset() {
    this._gmailAdapter = null;
    this._spreadsheetAdapter = null;
    this._driveAdapter = null;
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
    DriveAdapter: _DriveAdapter
  };
}
