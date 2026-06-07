/**
 * Gmail Add-on Tests
 * Tests for src/ui/gmail-addon.js entry points and helpers
 */

// Dependencies used by gmail-addon.js that are defined in other modules
const addon = require('../src/ui/gmail-addon.js');
// Gmail + Properties access is routed through serviceFactory ports; the real
// adapters delegate to the global GmailApp / PropertiesService mocks (setup.js),
// so tests drive those globals and reset the factory each test.
const { serviceFactory } = require('../src/core/services/index.js');

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
    // Fresh adapters bound to the current global SDK mocks each test.
    serviceFactory.reset();
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

    it('returns an error card when initializeCategorizerCache throws (outer catch)', () => {
      global.initializeCategorizerCache = jest.fn(() => { throw new Error('cache boom'); });
      const result = addon.getContextualAddOn({});
      expect(result).toBeDefined();
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      global.initializeCategorizerCache = jest.fn();
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
    function stubMessage(from = 'a@b.com') {
      global.GmailApp.getMessageById = jest.fn(() => ({
        getFrom: jest.fn(() => from),
        getSubject: jest.fn(() => 'S'),
        getThread: jest.fn(() => ({ getId: jest.fn(() => 't1') }))
      }));
    }

    it('onHomepage should return a dashboard card', () => {
      const result = addon.onHomepage({});
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('onGmailMessage should delegate to getContextualAddOn', () => {
      const e = { messageMetadata: { messageId: 'msg-1' } };
      stubMessage();
      const result = addon.onGmailMessage(e);
      expect(GmailApp.getMessageById).toHaveBeenCalledWith('msg-1');
      expect(result).toBeDefined();
    });

    it('onInstall delegates to getContextualAddOn', () => {
      const result = addon.onInstall({});
      expect(result).toBeDefined();
    });

    it('onGmailThread delegates to getContextualAddOn', () => {
      stubMessage();
      const result = addon.onGmailThread({ messageMetadata: { messageId: 'm' } });
      expect(GmailApp.getMessageById).toHaveBeenCalledWith('m');
      expect(result).toBeDefined();
    });

    it('onGmailConversation delegates to getContextualAddOn', () => {
      const result = addon.onGmailConversation({});
      expect(result).toBeDefined();
    });

    it('onGmailCompose delegates to getContextualAddOn', () => {
      const result = addon.onGmailCompose({});
      expect(result).toBeDefined();
    });
  });

  describe('createCategoryCard branches', () => {
    function stubMessage(from) {
      global.GmailApp.getMessageById = jest.fn(() => ({
        getFrom: jest.fn(() => from),
        getSubject: jest.fn(() => 'Subject'),
        getThread: jest.fn(() => ({ getId: jest.fn(() => 't1') }))
      }));
    }
    const e = { messageMetadata: { messageId: 'msg-1' } };

    it('builds the card with an angle-bracket sender (domain + categories present)', () => {
      stubMessage('Acme <jobs@acme.com>');
      global.getCategoryForEmail = jest.fn(() => 'work');
      global.getCategoryForDomain = jest.fn(() => 'newsletters');
      const result = addon.createCategoryCard(e);
      expect(global.getCategoryForEmail).toHaveBeenCalledWith('jobs@acme.com');
      expect(global.getCategoryForDomain).toHaveBeenCalledWith('acme.com');
      expect(result).toBeDefined();
    });

    it('handles a bare-address sender with no categories assigned', () => {
      stubMessage('plain@acme.com');
      global.getCategoryForEmail = jest.fn(() => null);
      global.getCategoryForDomain = jest.fn(() => null);
      const result = addon.createCategoryCard(e);
      expect(global.getCategoryForEmail).toHaveBeenCalledWith('plain@acme.com');
      expect(result).toBeDefined();
    });

    it('handles a sender with no parseable domain', () => {
      stubMessage('nodomain');
      global.getCategoryForEmail = jest.fn(() => null);
      const result = addon.createCategoryCard(e);
      // No domain -> getCategoryForDomain not called.
      expect(global.getCategoryForDomain).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('continues when category lookup throws (inner catch)', () => {
      stubMessage('x@y.com');
      global.getCategoryForEmail = jest.fn(() => { throw new Error('cat boom'); });
      const result = addon.createCategoryCard(e);
      expect(result).toBeDefined();
    });

    it('returns an error card when message retrieval throws', () => {
      global.GmailApp.getMessageById = jest.fn(() => { throw new Error('no msg'); });
      const result = addon.createCategoryCard(e);
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('applyCategory', () => {
    const baseEvent = (overrides = {}) => ({
      parameters: { emailAddress: 'a@x.com', domain: 'x.com', messageId: 'm1' },
      formInput: { categoryKey: 'work', assignmentType: 'email' },
      ...overrides
    });

    beforeEach(() => {
      global.initializeCategorizerCache = jest.fn();
      global.GmailApp.getMessageById = jest.fn(() => ({
        getFrom: jest.fn(() => 'a@x.com'),
        getSubject: jest.fn(() => 'S'),
        getThread: jest.fn(() => ({ getId: jest.fn(() => 't') }))
      }));
    });

    it('applies to email only and does NOT touch the domain', () => {
      global.updateCategoryForEmail = jest.fn(() => true);
      global.updateCategoryForDomain = jest.fn(() => true);
      const result = addon.applyCategory(baseEvent());
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith('a@x.com', 'work');
      // assignmentType 'email' must NOT update the domain.
      expect(global.updateCategoryForDomain).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('reports a failure when the email update returns falsy', () => {
      global.updateCategoryForEmail = jest.fn(() => false);
      const result = addon.applyCategory(baseEvent());
      expect(result).toBeDefined();
    });

    it('reports an error when the email update throws', () => {
      global.updateCategoryForEmail = jest.fn(() => { throw new Error('upd boom'); });
      const result = addon.applyCategory(baseEvent());
      expect(result).toBeDefined();
    });

    it('applies to both email and domain', () => {
      global.updateCategoryForEmail = jest.fn(() => true);
      global.updateCategoryForDomain = jest.fn(() => true);
      const result = addon.applyCategory(baseEvent({
        formInput: { categoryKey: 'work', assignmentType: 'both' }
      }));
      expect(global.updateCategoryForEmail).toHaveBeenCalled();
      expect(global.updateCategoryForDomain).toHaveBeenCalledWith('x.com', 'work');
      expect(result).toBeDefined();
    });

    it('applies to domain only and does NOT touch the email', () => {
      global.updateCategoryForEmail = jest.fn(() => true);
      global.updateCategoryForDomain = jest.fn(() => true);
      const result = addon.applyCategory(baseEvent({
        formInput: { categoryKey: 'work', assignmentType: 'domain' }
      }));
      expect(global.updateCategoryForDomain).toHaveBeenCalledWith('x.com', 'work');
      // assignmentType 'domain' must NOT update the email address.
      expect(global.updateCategoryForEmail).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('reports a failure when the domain update returns falsy', () => {
      global.updateCategoryForDomain = jest.fn(() => false);
      const result = addon.applyCategory(baseEvent({
        formInput: { categoryKey: 'work', assignmentType: 'domain' }
      }));
      expect(result).toBeDefined();
    });

    it('reports an error when the domain update throws', () => {
      global.updateCategoryForDomain = jest.fn(() => { throw new Error('dom boom'); });
      const result = addon.applyCategory(baseEvent({
        formInput: { categoryKey: 'work', assignmentType: 'domain' }
      }));
      expect(result).toBeDefined();
    });

    it('defaults assignmentType to "email" when not provided', () => {
      global.updateCategoryForEmail = jest.fn(() => true);
      const result = addon.applyCategory(baseEvent({
        formInput: { categoryKey: 'work' }
      }));
      expect(global.updateCategoryForEmail).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('returns a partial notification when there are both successes and errors', () => {
      global.updateCategoryForEmail = jest.fn(() => true);
      global.updateCategoryForDomain = jest.fn(() => false);
      const result = addon.applyCategory(baseEvent({
        formInput: { categoryKey: 'work', assignmentType: 'both' }
      }));
      expect(result).toBeDefined();
    });

    it('returns an error response when the whole handler throws', () => {
      const result = addon.applyCategory(null); // accessing e.parameters throws
      expect(CardService.newActionResponseBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('showCategorySelector', () => {
    const e = {
      parameters: { emailAddress: 'a@x.com', domain: 'x.com', emailCategory: 'work', domainCategory: 'newsletters', messageId: 'm' }
    };

    it('builds a selector card flagging the current email and domain categories', () => {
      global.getAllCategories = jest.fn(() => ({
        work: { displayName: 'Work' },
        newsletters: { displayName: 'Newsletters' },
        misc: 'Misc'   // string-valued category exercises the fallback
      }));
      const result = addon.showCategorySelector(e);
      expect(CardService.newSelectionInput).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('handles empty category parameters', () => {
      global.getAllCategories = jest.fn(() => ({ work: { displayName: 'Work' } }));
      const result = addon.showCategorySelector({ parameters: {} });
      expect(result).toBeDefined();
    });

    it('flags a category that is BOTH the current email and domain category', () => {
      global.getAllCategories = jest.fn(() => ({ work: { displayName: 'Work' } }));
      const result = addon.showCategorySelector({
        parameters: { emailAddress: 'a@x.com', emailCategory: 'work', domainCategory: 'work' }
      });
      expect(result).toBeDefined();
    });

    it('flags a domain-only current category', () => {
      global.getAllCategories = jest.fn(() => ({ work: { displayName: 'Work' }, news: { displayName: 'News' } }));
      const result = addon.showCategorySelector({
        parameters: { emailAddress: 'a@x.com', emailCategory: 'news', domainCategory: 'work' }
      });
      expect(result).toBeDefined();
    });

    it('falls back to the category key when the value is falsy (sort + display tails)', () => {
      // Two categories with falsy values, keys ordered so each appears as both
      // the `a` and `b` operand of the sort comparator -> the `|| key` tails run.
      global.getAllCategories = jest.fn(() => ({ aaa: 0, zzz: '' }));
      const result = addon.showCategorySelector({
        parameters: { emailAddress: 'a@x.com', emailCategory: '', domainCategory: '' }
      });
      expect(result).toBeDefined();
    });
  });

  describe('filterCategories', () => {
    const e = (search) => ({
      formInput: { categorySearch: search },
      parameters: { emailAddress: 'a@x.com', domain: 'x.com', emailCategory: 'work', domainCategory: 'newsletters' }
    });

    beforeEach(() => {
      global.getAllCategories = jest.fn(() => ({
        work: { displayName: 'Work' },
        newsletters: { displayName: 'Newsletters' },
        misc: 'Misc'
      }));
    });

    it('filters categories by the search text (display name match)', () => {
      const result = addon.filterCategories(e('work'));
      expect(CardService.newButtonSet).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('returns all categories when search is empty (default "")', () => {
      const result = addon.filterCategories({ formInput: {}, parameters: { emailAddress: 'a@x.com' } });
      expect(result).toBeDefined();
    });

    it('matches on the category key as well as display name', () => {
      const result = addon.filterCategories(e('misc'));
      expect(result).toBeDefined();
    });

    it('flags a category that is BOTH current email and domain in the filtered list', () => {
      const result = addon.filterCategories({
        formInput: { categorySearch: '' },
        parameters: { emailAddress: 'a@x.com', emailCategory: 'work', domainCategory: 'work' }
      });
      expect(result).toBeDefined();
    });

    it('flags a domain-only current category in the filtered list', () => {
      const result = addon.filterCategories({
        formInput: { categorySearch: '' },
        parameters: { emailAddress: 'a@x.com', emailCategory: 'newsletters', domainCategory: 'work' }
      });
      expect(result).toBeDefined();
    });

    it('falls back to the category key when the value is falsy (sort + filter tails)', () => {
      global.getAllCategories = jest.fn(() => ({ aaa: 0, zzz: '' }));
      const result = addon.filterCategories({
        formInput: { categorySearch: 'aaa' },
        parameters: { emailAddress: 'a@x.com', emailCategory: '', domainCategory: '' }
      });
      expect(result).toBeDefined();
    });
  });

  describe('reloadGmailUI', () => {
    it('returns an action response that pops to root', () => {
      const result = addon.reloadGmailUI();
      expect(CardService.newActionResponseBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('getDisplayNameForCategory — additional branches', () => {
    it('returns the string value when the category maps to a string', () => {
      global.getAllCategories = jest.fn(() => ({ misc: 'Miscellaneous' }));
      expect(addon.getDisplayNameForCategory('misc')).toBe('Miscellaneous');
    });

    it('returns the key when the category object has no displayName', () => {
      global.getAllCategories = jest.fn(() => ({ work: { name: 'no-display' } }));
      expect(addon.getDisplayNameForCategory('work')).toBe('work');
    });

    it('returns the key (or "Unknown") when lookup throws', () => {
      global.getAllCategories = jest.fn(() => { throw new Error('cats boom'); });
      expect(addon.getDisplayNameForCategory('work')).toBe('work');
    });
  });

  describe('writeLog — truncation + error safety', () => {
    it('truncates the log to 5000 chars when it grows too large', () => {
      const big = 'x'.repeat(6000);
      PropertiesService.getScriptProperties().setProperty('ADDON_LOG', big);
      addon.writeLog('new entry');
      const log = PropertiesService.getScriptProperties().getProperty('ADDON_LOG');
      expect(log.length).toBeLessThanOrEqual(5000);
      expect(log).toContain('new entry');
    });

    it('swallows errors when the properties write fails', () => {
      const original = PropertiesService.getScriptProperties;
      PropertiesService.getScriptProperties = jest.fn(() => { throw new Error('props down'); });
      expect(() => addon.writeLog('x')).not.toThrow();
      PropertiesService.getScriptProperties = original;
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });

    it('resolves the GAS-global serviceFactory when one is present', () => {
      global.serviceFactory = serviceFactory;
      const result = addon.readPersistedLog();
      expect(result).toBeDefined();
    });
  });
});
