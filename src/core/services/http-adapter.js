/**
 * HTTP Service Adapter (D2)
 * Provides a testable wrapper around UrlFetchApp so non-adapter code (e.g. the
 * Gemini API service, config API-key test) never references the UrlFetchApp SDK
 * directly. This is the single SDK-touching entry point for outbound HTTP.
 */

class HttpAdapter {
  constructor(urlFetchApp = (typeof UrlFetchApp !== 'undefined' ? UrlFetchApp : undefined)) {
    this.urlFetchApp = urlFetchApp;
  }

  /**
   * Perform an HTTP request.
   * @param {string} url - The request URL.
   * @param {Object} options - UrlFetchApp fetch options (method, headers, payload, ...).
   * @returns {HTTPResponse} The UrlFetchApp HTTPResponse.
   */
  fetch(url, options) {
    return this.urlFetchApp.fetch(url, options);
  }
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HttpAdapter };
}
