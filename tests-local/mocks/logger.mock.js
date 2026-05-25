/**
 * Mock Google Apps Script Logger Service
 * Provides realistic mock implementations for testing
 */

class MockLogger {
  constructor() {
    this.logs = [];
  }

  log(message, ...optionalParams) {
    const entry = {
      message: String(message),
      params: optionalParams,
      timestamp: new Date(),
      level: 'INFO'
    };
    this.logs.push(entry);
  }

  info(message, ...optionalParams) {
    const entry = {
      message: String(message),
      params: optionalParams,
      timestamp: new Date(),
      level: 'INFO'
    };
    this.logs.push(entry);
  }

  warning(message, ...optionalParams) {
    const entry = {
      message: String(message),
      params: optionalParams,
      timestamp: new Date(),
      level: 'WARNING'
    };
    this.logs.push(entry);
  }

  error(message, ...optionalParams) {
    const entry = {
      message: String(message),
      params: optionalParams,
      timestamp: new Date(),
      level: 'ERROR'
    };
    this.logs.push(entry);
  }

  getLog() {
    return this.logs.map(entry => {
      const params = entry.params.length > 0 ? ' ' + entry.params.join(' ') : '';
      return `[${entry.level}] ${entry.message}${params}`;
    }).join('\n');
  }

  clear() {
    this.logs = [];
  }

  /**
   * Get all log entries (for test verification)
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Get logs by level (for test verification)
   */
  getLogsByLevel(level) {
    return this.logs.filter(entry => entry.level === level);
  }

  /**
   * Check if a message was logged (for test verification)
   */
  hasLogged(message) {
    return this.logs.some(entry => entry.message.includes(message));
  }

  /**
   * Reset the entire mock state
   */
  reset() {
    this.logs = [];
  }
}

// Create a singleton instance
const mockLogger = new MockLogger();

module.exports = {
  MockLogger,
  mockLogger
};
