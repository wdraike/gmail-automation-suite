/**
 * Gmail Add-on Tests
 * Tests for src/ui/gmail-addon.js entry points and helpers
 */

// Dependencies used by gmail-addon.js that are defined in other modules
const addon = require('../src/ui/gmail-addon.js');

// Helper to create a fluent mock that returns itself for every method call
function createFluentMock(returnValue) {
  const handler = {
    get(target, prop) {
      if (prop === 'build') return jest.fn(() => returnValue);
      if (typeof prop === 'symbol') return undefined;
      return jest.fn(() => new Proxy({}, handler));
    }
  };
  return new Proxy({}, handler);
}

function setupCardServiceMock() {
  const mockBuilder = createFluentMock({ mockCard: true });
  const mockActionResponse = createFluentMock({ mockActionResponse: true });

  global.CardService = {
    newCardBuilder: jest.fn(() => mockBuilder),
    newCardHeader: jest.fn(() => createFluentMock()),
    newCardSection: jest.fn(() => createFluentMock()),
    newTextButton: jest.fn(() => createFluentMock()),
    newOpenLink: jest.fn(() => createFluentMock()),
    newKeyValue: jest.fn(() => createFluentMock()),
    newTextParagraph: jest.fn(() => createFluentMock()),
    newButtonSet: jest.fn(() => createFluentMock()),
    newAction: jest.fn(() => createFluentMock()),
    newActionResponseBuilder: jest.fn(() => mockActionResponse),
    newNavigation: jest.fn(() => createFluentMock()),
    newNotification: jest.fn(() => createFluentMock()),
    newTextInput: jest.fn(() => createFluentMock()),
    newSelectionInput: jest.fn(() => createFluentMock()),
    TextButtonStyle: { FILLED: 'FILLED', TEXT: 'TEXT' },
    OpenAs: { FULL_SIZE: 'FULL_SIZE' },
    OnClose: { RELOAD_ADD_ON: 'RELOAD_ADD_ON' },
    SelectionInputType: { DROPDOWN: 'DROPDOWN', RADIO_BUTTON: 'RADIO_BUTTON' }
  };
}

// Mock global dependencies from other modules
global.initializeCategorizerCache = jest.fn();
global.getCategoryForEmail = jest.fn(() => 'work');
global.getCategoryForDomain = jest.fn(() => 'newsletters');
global.getWebAppUrl = jest.fn(() => 'https://example.com/dashboard');
global.getAllCategories = jest.fn(() => ({
  work: { displayName: 'Work' },
  newsletters: { displayName: 'Newsletters' }
}));
global.updateCategoryForEmail = jest.fn(() => ({ success: true }));
global.updateCategoryForDomain = jest.fn(() => ({ success: true }));
global.createLabel = jest.fn();

describe('Gmail Add-on', () => {
  let originalCardService;

  beforeEach(() => {
    originalCardService = global.CardService;
    setupCardServiceMock();
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.CardService = originalCardService;
  });

  describe('getContextualAddOn', () => {
    it('should return dashboard card when no message is selected', () => {
      const e = {};
      const result = addon.getContextualAddOn(e);
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return category card when a message is selected', () => {
      const messageMock = {
        getFrom: jest.fn(() => 'sender@example.com'),
        getSubject: jest.fn(() => 'Test Subject'),
        getThread: jest.fn(() => ({
          getId: jest.fn(() => 'thread-1')
        }))
      };
      global.GmailApp.getMessageById = jest.fn(() => messageMock);

      const e = { messageMetadata: { messageId: 'msg-1' } };
      const result = addon.getContextualAddOn(e);
      expect(GmailApp.getMessageById).toHaveBeenCalledWith('msg-1');
      expect(result).toBeDefined();
    });

    it('should return error card on exception', () => {
      global.GmailApp.getMessageById = jest.fn(() => {
        throw new Error('Gmail error');
      });
      const e = { messageMetadata: { messageId: 'msg-1' } };
      const result = addon.getContextualAddOn(e);
      expect(result).toBeDefined();
      expect(CardService.newCardBuilder).toHaveBeenCalled();
    });
  });

  describe('createDashboardCard', () => {
    it('should build a dashboard card with Open Dashboard button', () => {
      const result = addon.createDashboardCard();
      expect(getWebAppUrl).toHaveBeenCalled();
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return error card when getWebAppUrl throws', () => {
      global.getWebAppUrl = jest.fn(() => { throw new Error('URL error'); });
      const result = addon.createDashboardCard();
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getDisplayNameForCategory', () => {
    it('should return display name when category has displayName', () => {
      expect(addon.getDisplayNameForCategory('work')).toBe('Work');
    });

    it('should return the key when category is not found', () => {
      expect(addon.getDisplayNameForCategory('unknown')).toBe('unknown');
    });

    it('should return "None" for falsy input', () => {
      expect(addon.getDisplayNameForCategory(null)).toBe('None');
      expect(addon.getDisplayNameForCategory('')).toBe('None');
    });
  });

  describe('createErrorCard', () => {
    it('should build an error card with the given message', () => {
      const result = addon.createErrorCard('Something broke');
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(CardService.newCardHeader).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('returnToMessageView', () => {
    it('should return an action response that pops to root', () => {
      const result = addon.returnToMessageView({});
      expect(CardService.newActionResponseBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('writeLog', () => {
    it('should append a message to ADDON_LOG property', () => {
      addon.writeLog('test message');
      const log = PropertiesService.getScriptProperties().getProperty('ADDON_LOG');
      expect(log).toContain('test message');
    });
  });

  describe('readPersistedLog', () => {
    it('should return ADDON_LOG when present', () => {
      PropertiesService.getScriptProperties().setProperty('ADDON_LOG', 'existing log');
      expect(addon.readPersistedLog()).toBe('existing log');
    });

    it('should return default message when log is absent', () => {
      PropertiesService.getScriptProperties().deleteProperty('ADDON_LOG');
      expect(addon.readPersistedLog()).toBe('No logs found');
    });
  });

  describe('clearPersistedLog', () => {
    it('should delete ADDON_LOG and return confirmation', () => {
      PropertiesService.getScriptProperties().setProperty('ADDON_LOG', 'some log');
      expect(addon.clearPersistedLog()).toBe('Log cleared');
      expect(PropertiesService.getScriptProperties().getProperty('ADDON_LOG')).toBeNull();
    });
  });

  describe('entry point delegates', () => {
    it('onHomepage should return a dashboard card', () => {
      const result = addon.onHomepage({});
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('onGmailMessage should delegate to getContextualAddOn', () => {
      const e = { messageMetadata: { messageId: 'msg-1' } };
      global.GmailApp.getMessageById = jest.fn(() => ({
        getFrom: jest.fn(() => 'a@b.com'),
        getSubject: jest.fn(() => 'S'),
        getThread: jest.fn(() => ({ getId: jest.fn(() => 't1') }))
      }));
      const result = addon.onGmailMessage(e);
      expect(GmailApp.getMessageById).toHaveBeenCalledWith('msg-1');
      expect(result).toBeDefined();
    });
  });
});
