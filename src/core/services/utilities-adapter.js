/**
 * Utilities Service Adapter
 * Provides a testable wrapper around Utilities.sleep / Utilities.formatDate.
 * This adapter allows dependency injection and easier testing, and keeps
 * feature/domain code from referencing Utilities directly.
 */

class UtilitiesAdapter {
  constructor(utilities = Utilities) {
    this.utilities = utilities;
  }

  /**
   * Sleep for the given number of milliseconds.
   * @param {number} ms
   */
  sleep(ms) {
    return this.utilities.sleep(ms);
  }

  /**
   * Format a date.
   * @param {Date} date
   * @param {string} timeZone
   * @param {string} format
   * @returns {string}
   */
  formatDate(date, timeZone, format) {
    return this.utilities.formatDate(date, timeZone, format);
  }

  /**
   * Generate a UUID via Utilities.getUuid().
   * @returns {string}
   */
  getUuid() {
    return this.utilities.getUuid();
  }

  /**
   * Get the script's time zone via Session.getScriptTimeZone().
   * Surfaced here so UI code can format dates without referencing the Session
   * SDK directly. Session is a platform SDK and is correctly accessed from
   * within this adapter ring.
   * @returns {string} IANA time zone id (e.g. "America/New_York").
   */
  getScriptTimeZone() {
    return Session.getScriptTimeZone();
  }
}

// Export for both GAS and Node.js
/* istanbul ignore next -- the `typeof module` guard is always true under Node/Jest and always false in GAS; the false branch is never taken in the test runtime. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UtilitiesAdapter };
}
