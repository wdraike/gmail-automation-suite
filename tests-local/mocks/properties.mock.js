/**
 * Mock Google Apps Script Properties Service
 * Provides realistic mock implementations for testing
 */

class MockProperties {
  constructor() {
    this.properties = {};
  }

  getProperty(key) {
    return this.properties[key] || null;
  }

  getProperties() {
    return { ...this.properties };
  }

  setProperty(key, value) {
    this.properties[key] = String(value);
    return this;
  }

  setProperties(properties, deleteAllOthers = false) {
    if (deleteAllOthers) {
      this.properties = {};
    }

    Object.entries(properties).forEach(([key, value]) => {
      this.properties[key] = String(value);
    });

    return this;
  }

  deleteProperty(key) {
    delete this.properties[key];
    return this;
  }

  deleteAllProperties() {
    this.properties = {};
    return this;
  }

  getKeys() {
    return Object.keys(this.properties);
  }

  /**
   * Reset the entire mock state
   */
  reset() {
    this.properties = {};
  }
}

class MockPropertiesService {
  constructor() {
    this.scriptProperties = new MockProperties();
    this.userProperties = new MockProperties();
    this.documentProperties = new MockProperties();
  }

  getScriptProperties() {
    return this.scriptProperties;
  }

  getUserProperties() {
    return this.userProperties;
  }

  getDocumentProperties() {
    return this.documentProperties;
  }

  /**
   * Reset all property stores
   */
  reset() {
    this.scriptProperties.reset();
    this.userProperties.reset();
    this.documentProperties.reset();
  }
}

module.exports = {
  MockPropertiesService,
  MockProperties
};
