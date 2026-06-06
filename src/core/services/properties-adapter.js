/**
 * Properties Service Adapter (a.k.a. ConfigPort)
 * Provides a testable wrapper around PropertiesService script properties.
 * This adapter allows dependency injection and easier testing, and keeps
 * feature/domain code from referencing PropertiesService directly.
 */

class PropertiesAdapter {
  constructor(propertiesService = PropertiesService) {
    this.propertiesService = propertiesService;
  }

  /**
   * Get the script properties store.
   * @returns {Object} script properties store
   */
  _store() {
    return this.propertiesService.getScriptProperties();
  }

  /**
   * Get a script property value.
   * @param {string} key
   * @returns {string|null}
   */
  getProperty(key) {
    return this._store().getProperty(key);
  }

  /**
   * Set a script property value.
   * @param {string} key
   * @param {string} value
   */
  setProperty(key, value) {
    return this._store().setProperty(key, value);
  }

  /**
   * Delete a script property.
   * @param {string} key
   */
  deleteProperty(key) {
    return this._store().deleteProperty(key);
  }

  /**
   * Get all script properties as an object.
   * @returns {Object}
   */
  getProperties() {
    return this._store().getProperties();
  }
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PropertiesAdapter };
}
