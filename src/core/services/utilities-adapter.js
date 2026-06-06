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
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { UtilitiesAdapter };
}
