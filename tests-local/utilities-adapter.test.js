/**
 * UtilitiesAdapter Tests
 * Wraps Utilities.sleep / Utilities.formatDate so feature code never
 * references Utilities directly.
 */

const { UtilitiesAdapter } = require('../src/core/services/utilities-adapter.js');

describe('UtilitiesAdapter', () => {
  let adapter;
  let mockUtilities;

  beforeEach(() => {
    mockUtilities = {
      sleep: jest.fn(),
      formatDate: jest.fn(() => '2026-01-01'),
      getUuid: jest.fn(() => 'abcd-1234-efgh-5678'),
    };
    adapter = new UtilitiesAdapter(mockUtilities);
  });

  describe('constructor', () => {
    it('should store the injected Utilities', () => {
      expect(adapter.utilities).toBe(mockUtilities);
    });

    it('should fall back to global Utilities when none injected', () => {
      const a = new UtilitiesAdapter();
      expect(a.utilities).toBe(global.Utilities);
    });
  });

  describe('sleep', () => {
    it('should delegate to Utilities.sleep', () => {
      adapter.sleep(500);
      expect(mockUtilities.sleep).toHaveBeenCalledWith(500);
    });
  });

  describe('formatDate', () => {
    it('should delegate to Utilities.formatDate with date, timezone, format', () => {
      const date = new Date('2026-01-01T00:00:00Z');
      const result = adapter.formatDate(date, 'GMT', 'yyyy-MM-dd');

      expect(mockUtilities.formatDate).toHaveBeenCalledWith(date, 'GMT', 'yyyy-MM-dd');
      expect(result).toBe('2026-01-01');
    });
  });

  describe('getUuid', () => {
    it('should delegate to Utilities.getUuid', () => {
      const result = adapter.getUuid();
      expect(mockUtilities.getUuid).toHaveBeenCalled();
      expect(result).toBe('abcd-1234-efgh-5678');
    });
  });

  describe('getScriptTimeZone', () => {
    it('should delegate to Session.getScriptTimeZone()', () => {
      global.Session = {
        getScriptTimeZone: jest.fn(() => 'America/New_York'),
      };
      const result = adapter.getScriptTimeZone();
      expect(global.Session.getScriptTimeZone).toHaveBeenCalled();
      expect(result).toBe('America/New_York');
    });
  });
});
