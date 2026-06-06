/**
 * Tests for CacheAdapter (src/core/services/cache-adapter.js)
 * Wraps CacheService.getScriptCache() so non-adapter code never touches the
 * CacheService SDK directly (D3).
 */

const { CacheAdapter } = require('../src/core/services/cache-adapter.js');

function makeFakeCacheService() {
  const store = new Map();
  const scriptCache = {
    get: jest.fn((key) => (store.has(key) ? store.get(key) : null)),
    put: jest.fn((key, value) => store.set(key, value)),
    remove: jest.fn((key) => store.delete(key)),
    removeAll: jest.fn((keys) => keys.forEach((k) => store.delete(k))),
  };
  return {
    getScriptCache: jest.fn(() => scriptCache),
    _scriptCache: scriptCache,
    _store: store,
  };
}

describe('CacheAdapter', () => {
  describe('constructor', () => {
    it('stores the injected CacheService', () => {
      const fake = makeFakeCacheService();
      const adapter = new CacheAdapter(fake);
      expect(adapter.cacheService).toBe(fake);
    });

    it('falls back to the global CacheService when none injected', () => {
      const adapter = new CacheAdapter();
      expect(adapter.cacheService).toBe(global.CacheService);
    });
  });

  describe('get / put / remove / removeAll', () => {
    it('get delegates to scriptCache.get', () => {
      const fake = makeFakeCacheService();
      fake._store.set('k', 'v');
      const adapter = new CacheAdapter(fake);
      expect(adapter.get('k')).toBe('v');
      expect(fake._scriptCache.get).toHaveBeenCalledWith('k');
    });

    it('put delegates to scriptCache.put with duration', () => {
      const fake = makeFakeCacheService();
      const adapter = new CacheAdapter(fake);
      adapter.put('k', 'v', 300);
      expect(fake._scriptCache.put).toHaveBeenCalledWith('k', 'v', 300);
    });

    it('remove delegates to scriptCache.remove', () => {
      const fake = makeFakeCacheService();
      const adapter = new CacheAdapter(fake);
      adapter.remove('k');
      expect(fake._scriptCache.remove).toHaveBeenCalledWith('k');
    });

    it('removeAll delegates to scriptCache.removeAll', () => {
      const fake = makeFakeCacheService();
      const adapter = new CacheAdapter(fake);
      adapter.removeAll(['a', 'b']);
      expect(fake._scriptCache.removeAll).toHaveBeenCalledWith(['a', 'b']);
    });
  });
});
