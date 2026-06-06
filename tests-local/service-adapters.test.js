/**
 * Service Adapter Integration Tests
 *
 * Tests that validate the service adapter architecture works correctly
 * in both Node.js (for testing) and Google Apps Script environments.
 *
 * These tests ensure:
 * - Individual adapters can be loaded without conflicts
 * - ServiceFactory can create adapter instances
 * - Dependency injection works correctly
 * - No duplicate exports or redeclarations exist
 */

describe('Service Adapters - Integration Tests', () => {

  describe('Individual Adapter Loading', () => {

    it('should load GmailAdapter without errors', () => {
      const { GmailAdapter } = require('../src/core/services/gmail-adapter.js');

      expect(GmailAdapter).toBeDefined();
      expect(typeof GmailAdapter).toBe('function');

      // Should be able to instantiate
      const adapter = new GmailAdapter(global.GmailApp);
      expect(adapter).toBeDefined();
      expect(adapter.gmail).toBe(global.GmailApp);
    });

    it('should load SpreadsheetAdapter without errors', () => {
      const { SpreadsheetAdapter } = require('../src/core/services/spreadsheet-adapter.js');

      expect(SpreadsheetAdapter).toBeDefined();
      expect(typeof SpreadsheetAdapter).toBe('function');

      // Should be able to instantiate
      const adapter = new SpreadsheetAdapter(global.SpreadsheetApp);
      expect(adapter).toBeDefined();
      expect(adapter.spreadsheetApp).toBe(global.SpreadsheetApp);
    });

    it('should load DriveAdapter without errors', () => {
      const { DriveAdapter } = require('../src/core/services/drive-adapter.js');

      expect(DriveAdapter).toBeDefined();
      expect(typeof DriveAdapter).toBe('function');

      // Should be able to instantiate
      const adapter = new DriveAdapter(global.DriveApp);
      expect(adapter).toBeDefined();
      expect(adapter.drive).toBe(global.DriveApp);
    });

    it('should load all adapters simultaneously without conflicts', () => {
      const { GmailAdapter } = require('../src/core/services/gmail-adapter.js');
      const { SpreadsheetAdapter } = require('../src/core/services/spreadsheet-adapter.js');
      const { DriveAdapter } = require('../src/core/services/drive-adapter.js');

      expect(GmailAdapter).toBeDefined();
      expect(SpreadsheetAdapter).toBeDefined();
      expect(DriveAdapter).toBeDefined();

      // All should be different classes
      expect(GmailAdapter).not.toBe(SpreadsheetAdapter);
      expect(GmailAdapter).not.toBe(DriveAdapter);
      expect(SpreadsheetAdapter).not.toBe(DriveAdapter);
    });
  });

  describe('ServiceFactory', () => {
    let ServiceFactory, serviceFactory;

    beforeEach(() => {
      // Clear require cache to get fresh instance
      jest.resetModules();

      const module = require('../src/core/services/index.js');
      ServiceFactory = module.ServiceFactory;
      serviceFactory = module.serviceFactory;
    });

    it('should export ServiceFactory class', () => {
      expect(ServiceFactory).toBeDefined();
      expect(typeof ServiceFactory).toBe('function');
    });

    it('should export serviceFactory singleton instance', () => {
      expect(serviceFactory).toBeDefined();
      expect(serviceFactory).toBeInstanceOf(ServiceFactory);
    });

    it('should create GmailAdapter instance through factory', () => {
      const factory = new ServiceFactory();
      const adapter = factory.getGmailAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.gmail).toBe(global.GmailApp);
    });

    it('should create SpreadsheetAdapter instance through factory', () => {
      const factory = new ServiceFactory();
      const adapter = factory.getSpreadsheetAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.spreadsheetApp).toBe(global.SpreadsheetApp);
    });

    it('should create DriveAdapter instance through factory', () => {
      const factory = new ServiceFactory();
      const adapter = factory.getDriveAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.drive).toBe(global.DriveApp);
    });

    it('should create GeminiAdapter instance through factory', () => {
      const fn = jest.fn();
      const factory = new ServiceFactory({ callGeminiApi: fn });
      const adapter = factory.getGeminiAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.callGeminiApi).toBe(fn);
    });

    it('should create PropertiesAdapter instance through factory', () => {
      const factory = new ServiceFactory();
      const adapter = factory.getPropertiesAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.propertiesService).toBe(global.PropertiesService);
    });

    it('should create UtilitiesAdapter instance through factory', () => {
      const factory = new ServiceFactory();
      const adapter = factory.getUtilitiesAdapter();

      expect(adapter).toBeDefined();
      expect(adapter.utilities).toBe(global.Utilities);
    });

    it('should allow dependency injection of mock PropertiesService', () => {
      const mockPropertiesService = { getScriptProperties: jest.fn() };
      const factory = new ServiceFactory({ PropertiesService: mockPropertiesService });
      const adapter = factory.getPropertiesAdapter();

      expect(adapter.propertiesService).toBe(mockPropertiesService);
    });

    it('should return the same adapter instance on multiple calls (singleton pattern)', () => {
      const factory = new ServiceFactory();

      const adapter1 = factory.getGmailAdapter();
      const adapter2 = factory.getGmailAdapter();

      expect(adapter1).toBe(adapter2);
    });

    it('should allow dependency injection of mock services', () => {
      const mockGmailApp = {
        search: jest.fn(() => []),
        getUserLabelByName: jest.fn()
      };

      const factory = new ServiceFactory({ GmailApp: mockGmailApp });
      const adapter = factory.getGmailAdapter();

      expect(adapter.gmail).toBe(mockGmailApp);
      expect(adapter.gmail).not.toBe(global.GmailApp);
    });

    it('should reset all adapter instances when reset() is called', () => {
      const factory = new ServiceFactory();

      const adapter1 = factory.getGmailAdapter();
      factory.reset();
      const adapter2 = factory.getGmailAdapter();

      expect(adapter1).not.toBe(adapter2);
    });

    it('should reset new port adapters when reset() is called', () => {
      const factory = new ServiceFactory();

      const props1 = factory.getPropertiesAdapter();
      const util1 = factory.getUtilitiesAdapter();
      factory.reset();
      const props2 = factory.getPropertiesAdapter();
      const util2 = factory.getUtilitiesAdapter();

      expect(props1).not.toBe(props2);
      expect(util1).not.toBe(util2);
    });

    it('should allow creating multiple independent factory instances', () => {
      const factory1 = new ServiceFactory();
      const factory2 = new ServiceFactory();

      const adapter1 = factory1.getGmailAdapter();
      const adapter2 = factory2.getGmailAdapter();

      // Different factory instances should create different adapter instances
      expect(adapter1).not.toBe(adapter2);
    });
  });

  describe('Module Exports', () => {

    it('should export all required classes and instances from index.js', () => {
      const exports = require('../src/core/services/index.js');

      expect(exports.ServiceFactory).toBeDefined();
      expect(exports.serviceFactory).toBeDefined();
      expect(exports.GmailAdapter).toBeDefined();
      expect(exports.SpreadsheetAdapter).toBeDefined();
      expect(exports.DriveAdapter).toBeDefined();
      expect(exports.GeminiAdapter).toBeDefined();
      expect(exports.PropertiesAdapter).toBeDefined();
      expect(exports.UtilitiesAdapter).toBeDefined();
    });

    it('should export the same classes from index.js as from individual files', () => {
      const indexExports = require('../src/core/services/index.js');
      const { GmailAdapter } = require('../src/core/services/gmail-adapter.js');
      const { SpreadsheetAdapter } = require('../src/core/services/spreadsheet-adapter.js');
      const { DriveAdapter } = require('../src/core/services/drive-adapter.js');

      expect(indexExports.GmailAdapter).toBe(GmailAdapter);
      expect(indexExports.SpreadsheetAdapter).toBe(SpreadsheetAdapter);
      expect(indexExports.DriveAdapter).toBe(DriveAdapter);
    });
  });

  describe('Adapter Functionality', () => {

    describe('GmailAdapter', () => {
      let adapter;

      beforeEach(() => {
        const { GmailAdapter } = require('../src/core/services/gmail-adapter.js');
        adapter = new GmailAdapter(global.GmailApp);
      });

      it('should delegate getUserLabelByName to GmailApp', () => {
        const mockLabel = { getName: () => 'Test' };
        global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);

        const result = adapter.getUserLabelByName('Test');

        expect(global.GmailApp.getUserLabelByName).toHaveBeenCalledWith('Test');
        expect(result).toBe(mockLabel);
      });

      it('should delegate createLabel to GmailApp', () => {
        const mockLabel = { getName: () => 'NewLabel' };
        global.GmailApp.createLabel = jest.fn(() => mockLabel);

        const result = adapter.createLabel('NewLabel');

        expect(global.GmailApp.createLabel).toHaveBeenCalledWith('NewLabel');
        expect(result).toBe(mockLabel);
      });

      it('should delegate search to GmailApp', () => {
        const mockThreads = [{ getId: () => '1' }];
        global.GmailApp.search = jest.fn(() => mockThreads);

        const result = adapter.search('label:inbox', 0, 10);

        expect(global.GmailApp.search).toHaveBeenCalledWith('label:inbox', 0, 10);
        expect(result).toBe(mockThreads);
      });
    });

    describe('SpreadsheetAdapter', () => {
      let adapter;

      beforeEach(() => {
        const { SpreadsheetAdapter } = require('../src/core/services/spreadsheet-adapter.js');
        adapter = new SpreadsheetAdapter(global.SpreadsheetApp);
      });

      it('should delegate openById to SpreadsheetApp', () => {
        const mockSpreadsheet = { getId: () => 'test-id' };
        global.SpreadsheetApp.openById = jest.fn(() => mockSpreadsheet);

        const result = adapter.openById('test-id');

        expect(global.SpreadsheetApp.openById).toHaveBeenCalledWith('test-id');
        expect(result).toBe(mockSpreadsheet);
      });

      it('should create or get sheet correctly', () => {
        const mockSheet = { getName: () => 'TestSheet' };
        const mockSpreadsheet = {
          getSheetByName: jest.fn(() => null),
          insertSheet: jest.fn(() => mockSheet)
        };

        const result = adapter.getOrCreateSheet(mockSpreadsheet, 'TestSheet');

        expect(mockSpreadsheet.getSheetByName).toHaveBeenCalledWith('TestSheet');
        expect(mockSpreadsheet.insertSheet).toHaveBeenCalledWith('TestSheet');
        expect(result).toBe(mockSheet);
      });
    });

    describe('DriveAdapter', () => {
      let adapter;

      beforeEach(() => {
        const { DriveAdapter } = require('../src/core/services/drive-adapter.js');
        adapter = new DriveAdapter(global.DriveApp);
      });

      it('should delegate getFileById to DriveApp', () => {
        const mockFile = { getId: () => 'file-id' };
        global.DriveApp.getFileById = jest.fn(() => mockFile);

        const result = adapter.getFileById('file-id');

        expect(global.DriveApp.getFileById).toHaveBeenCalledWith('file-id');
        expect(result).toBe(mockFile);
      });

      it('should delegate createFile to DriveApp', () => {
        const mockFile = { getId: () => 'new-file-id' };
        global.DriveApp.createFile = jest.fn(() => mockFile);

        const result = adapter.createFile('test.txt', 'content', 'text/plain');

        expect(global.DriveApp.createFile).toHaveBeenCalledWith('test.txt', 'content', 'text/plain');
        expect(result).toBe(mockFile);
      });
    });
  });

  describe('Error Handling', () => {

    it('should handle errors from GmailApp gracefully', () => {
      const { GmailAdapter } = require('../src/core/services/gmail-adapter.js');

      global.GmailApp.search = jest.fn(() => {
        throw new Error('Gmail API error');
      });

      const adapter = new GmailAdapter(global.GmailApp);

      expect(() => {
        adapter.search('invalid query');
      }).toThrow('Gmail API error');
    });

    it('should handle errors from SpreadsheetApp gracefully', () => {
      const { SpreadsheetAdapter } = require('../src/core/services/spreadsheet-adapter.js');

      global.SpreadsheetApp.openById = jest.fn(() => {
        throw new Error('Spreadsheet not found');
      });

      const adapter = new SpreadsheetAdapter(global.SpreadsheetApp);

      expect(() => {
        adapter.openById('invalid-id');
      }).toThrow('Spreadsheet not found');
    });

    it('should handle errors from DriveApp gracefully', () => {
      const { DriveAdapter } = require('../src/core/services/drive-adapter.js');

      global.DriveApp.getFileById = jest.fn(() => {
        throw new Error('File not found');
      });

      const adapter = new DriveAdapter(global.DriveApp);

      expect(() => {
        adapter.getFileById('invalid-id');
      }).toThrow('File not found');
    });
  });
});
