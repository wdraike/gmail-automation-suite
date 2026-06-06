/**
 * PropertiesAdapter Tests
 * Wraps PropertiesService.getScriptProperties() so feature code never
 * references PropertiesService directly.
 */

const { PropertiesAdapter } = require('../src/core/services/properties-adapter.js');

describe('PropertiesAdapter', () => {
  let adapter;
  let mockStore;
  let mockPropertiesService;

  beforeEach(() => {
    mockStore = {
      getProperty: jest.fn(),
      setProperty: jest.fn(),
      deleteProperty: jest.fn(),
      deleteAllProperties: jest.fn(),
      getProperties: jest.fn(),
    };
    mockPropertiesService = {
      getScriptProperties: jest.fn(() => mockStore),
    };
    adapter = new PropertiesAdapter(mockPropertiesService);
  });

  describe('constructor', () => {
    it('should store the injected PropertiesService', () => {
      expect(adapter.propertiesService).toBe(mockPropertiesService);
    });

    it('should fall back to global PropertiesService when none injected', () => {
      const a = new PropertiesAdapter();
      expect(a.propertiesService).toBe(global.PropertiesService);
    });
  });

  describe('getProperty', () => {
    it('should delegate to scriptProperties.getProperty', () => {
      mockStore.getProperty.mockReturnValue('value123');

      const result = adapter.getProperty('MY_KEY');

      expect(mockPropertiesService.getScriptProperties).toHaveBeenCalled();
      expect(mockStore.getProperty).toHaveBeenCalledWith('MY_KEY');
      expect(result).toBe('value123');
    });

    it('should return null when key not set (no fallback substitution)', () => {
      mockStore.getProperty.mockReturnValue(null);
      expect(adapter.getProperty('MISSING')).toBeNull();
    });
  });

  describe('setProperty', () => {
    it('should delegate to scriptProperties.setProperty', () => {
      adapter.setProperty('MY_KEY', 'val');
      expect(mockStore.setProperty).toHaveBeenCalledWith('MY_KEY', 'val');
    });
  });

  describe('deleteProperty', () => {
    it('should delegate to scriptProperties.deleteProperty', () => {
      adapter.deleteProperty('MY_KEY');
      expect(mockStore.deleteProperty).toHaveBeenCalledWith('MY_KEY');
    });
  });

  describe('getProperties', () => {
    it('should delegate to scriptProperties.getProperties', () => {
      mockStore.getProperties.mockReturnValue({ A: '1' });
      expect(adapter.getProperties()).toEqual({ A: '1' });
    });
  });

  describe('error handling', () => {
    it('should propagate errors from the underlying store', () => {
      mockStore.getProperty.mockImplementation(() => {
        throw new Error('Properties error');
      });
      expect(() => adapter.getProperty('K')).toThrow('Properties error');
    });
  });
});
