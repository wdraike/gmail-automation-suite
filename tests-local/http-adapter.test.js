/**
 * Tests for HttpAdapter (src/core/services/http-adapter.js)
 * Wraps UrlFetchApp so non-adapter code never touches the SDK directly (D2).
 */

const { HttpAdapter } = require('../src/core/services/http-adapter.js');

describe('HttpAdapter', () => {
  describe('constructor', () => {
    it('stores the injected UrlFetchApp', () => {
      const fake = { fetch: jest.fn() };
      const adapter = new HttpAdapter(fake);
      expect(adapter.urlFetchApp).toBe(fake);
    });

    it('falls back to the global UrlFetchApp when none injected', () => {
      const adapter = new HttpAdapter();
      expect(adapter.urlFetchApp).toBe(global.UrlFetchApp);
    });

    it('falls back to undefined when no UrlFetchApp global exists', () => {
      // Exercises the `: undefined` arm of the constructor default's typeof guard.
      const saved = global.UrlFetchApp;
      delete global.UrlFetchApp;
      try {
        const adapter = new HttpAdapter();
        expect(adapter.urlFetchApp).toBeUndefined();
      } finally {
        global.UrlFetchApp = saved;
      }
    });
  });

  describe('fetch', () => {
    it('delegates to UrlFetchApp.fetch with url and options', () => {
      const response = { getResponseCode: () => 200 };
      const fake = { fetch: jest.fn(() => response) };
      const adapter = new HttpAdapter(fake);
      const opts = { method: 'post' };
      const result = adapter.fetch('https://example.com', opts);
      expect(fake.fetch).toHaveBeenCalledWith('https://example.com', opts);
      expect(result).toBe(response);
    });

    it('propagates errors from UrlFetchApp.fetch', () => {
      const fake = { fetch: jest.fn(() => { throw new Error('network'); }) };
      const adapter = new HttpAdapter(fake);
      expect(() => adapter.fetch('https://example.com', {})).toThrow('network');
    });
  });
});
