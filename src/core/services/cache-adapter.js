/**
 * Cache Service Adapter (D3)
 * Provides a testable wrapper around CacheService.getScriptCache() so non-adapter
 * code never references the CacheService SDK directly. The application-level
 * UnifiedCacheService routes its short-lived cache storage through this adapter.
 */

class CacheAdapter {
  constructor(cacheService = (typeof CacheService !== 'undefined' ? CacheService : undefined)) {
    this.cacheService = cacheService;
  }

  _cache() {
    return this.cacheService.getScriptCache();
  }

  /**
   * Get a value from the script cache.
   * @param {string} key
   * @returns {string|null}
   */
  get(key) {
    return this._cache().get(key);
  }

  /**
   * Put a value into the script cache.
   * @param {string} key
   * @param {string} value
   * @param {number} durationSeconds
   */
  put(key, value, durationSeconds) {
    return this._cache().put(key, value, durationSeconds);
  }

  /**
   * Remove a value from the script cache.
   * @param {string} key
   */
  remove(key) {
    return this._cache().remove(key);
  }

  /**
   * Remove multiple values from the script cache.
   * @param {string[]} keys
   */
  removeAll(keys) {
    return this._cache().removeAll(keys);
  }
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CacheAdapter };
}
