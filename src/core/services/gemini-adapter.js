/**
 * Gemini Service Adapter
 * Provides a testable wrapper around the global callGeminiApi function.
 * This adapter allows dependency injection and easier testing, and keeps
 * feature/domain code from referencing callGeminiApi directly.
 */

class GeminiAdapter {
  constructor(callGeminiApiFn = (typeof callGeminiApi !== 'undefined' ? callGeminiApi : undefined)) {
    this.callGeminiApi = callGeminiApiFn;
  }

  /**
   * Call the Gemini API.
   * @param {string} prompt - The prompt text to send to Gemini
   * @param {string} operationType - Type of operation (e.g. "job_extraction")
   * @returns {Object} Processed API response
   */
  call(prompt, operationType) {
    return this.callGeminiApi(prompt, operationType);
  }
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GeminiAdapter };
}
