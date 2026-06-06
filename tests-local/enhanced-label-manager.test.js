/**
 * Enhanced Label Manager Tests
 * Tests for src/features/enhanced-label-manager.js
 */

const { serviceFactory } = require('../src/core/services/index.js');
const labelManager = require('../src/features/enhanced-label-manager.js');

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

// Mock dependencies from other modules
global.getGmailLabels = jest.fn(() => [
  { name: 'Work', getName: jest.fn(() => 'Work') },
  { name: 'Work/Projects', getName: jest.fn(() => 'Work/Projects') },
  { name: 'Personal', getName: jest.fn(() => 'Personal') }
]);
global.createLabelHierarchy = jest.fn();

describe('Enhanced Label Manager', () => {
  let originalCardService;

  beforeEach(() => {
    originalCardService = global.CardService;
    setupCardServiceMock();
    jest.clearAllMocks();
    // Rebuild GmailAdapter so it binds to the current global.GmailApp mocks.
    serviceFactory.reset();
  });

  afterEach(() => {
    global.CardService = originalCardService;
  });

  describe('organizeLabelsHierarchically', () => {
    it('should place top-level labels under root', () => {
      const labels = [
        { name: 'Work' },
        { name: 'Personal' }
      ];
      const result = labelManager.organizeLabelsHierarchically(labels);
      expect(result.root.labels).toHaveLength(2);
      expect(result.root.labels.map(l => l.name)).toContain('Work');
      expect(result.root.labels.map(l => l.name)).toContain('Personal');
    });

    it('should nest labels with slashes into folders', () => {
      const labels = [
        { name: 'Work/Projects/Q1' }
      ];
      const result = labelManager.organizeLabelsHierarchically(labels);
      expect(result.root.children.Work).toBeDefined();
      expect(result.root.children.Work.children.Projects).toBeDefined();
      expect(result.root.children.Work.children.Projects.labels).toHaveLength(1);
      expect(result.root.children.Work.children.Projects.labels[0].name).toBe('Q1');
    });

    it('should skip invalid labels without names', () => {
      const labels = [
        { name: 'Valid' },
        null,
        { name: null }
      ];
      const result = labelManager.organizeLabelsHierarchically(labels);
      expect(result.root.labels).toHaveLength(1);
    });

    it('should create intermediate folders for deeply nested labels', () => {
      const labels = [
        { name: 'A/B/C/D' }
      ];
      const result = labelManager.organizeLabelsHierarchically(labels);
      expect(result.root.children.A.children.B.children.C).toBeDefined();
    });
  });

  describe('showCreateLabelDialog', () => {
    it('should return a navigation with create label card', () => {
      const result = labelManager.showCreateLabelDialog();
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(CardService.newNavigation).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('createNewLabel', () => {
    it('should reject empty label name', () => {
      const e = { formInput: { parentLabel: '', labelName: '   ' } };
      const result = labelManager.createNewLabel(e);
      expect(CardService.newActionResponseBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should reject duplicate label', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => ({ getName: jest.fn(() => 'Work') }));
      const e = { formInput: { parentLabel: '', labelName: 'Work' } };
      const result = labelManager.createNewLabel(e);
      expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('Work');
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should create flat label when no slash and not existing', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      global.GmailApp.createLabel = jest.fn(() => ({ getName: jest.fn(() => 'NewLabel') }));
      const e = { formInput: { parentLabel: '', labelName: 'NewLabel' } };
      const result = labelManager.createNewLabel(e);
      expect(GmailApp.createLabel).toHaveBeenCalledWith('NewLabel');
      expect(result).toBeDefined();
    });

    it('should call createLabelHierarchy for nested path', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const e = { formInput: { parentLabel: 'Work', labelName: 'Projects' } };
      const result = labelManager.createNewLabel(e);
      expect(createLabelHierarchy).toHaveBeenCalledWith('Work/Projects');
      expect(result).toBeDefined();
    });
  });

  describe('confirmDeleteLabel', () => {
    it('should reject missing label name', () => {
      const result = labelManager.confirmDeleteLabel({ parameters: {} });
      expect(CardService.newActionResponseBuilder).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should warn when label has threads', () => {
      const mockLabel = {
        getThreads: jest.fn(() => [{ getId: jest.fn(() => 't1') }])
      };
      global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);
      const result = labelManager.confirmDeleteLabel({ parameters: { labelName: 'Work' } });
      expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('Work');
      expect(CardService.newTextParagraph).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should not warn when label has no threads', () => {
      const mockLabel = {
        getThreads: jest.fn(() => [])
      };
      global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);
      const result = labelManager.confirmDeleteLabel({ parameters: { labelName: 'Empty' } });
      expect(result).toBeDefined();
    });
  });

  describe('deleteLabel', () => {
    it('should reject missing label name', () => {
      const result = labelManager.deleteLabel({ parameters: {} });
      expect(result).toBeDefined();
    });

    it('should return error when label not found', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const result = labelManager.deleteLabel({ parameters: { labelName: 'Missing' } });
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should delete label and navigate back to manager', () => {
      const mockLabel = { deleteLabel: jest.fn() };
      global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);
      const result = labelManager.deleteLabel({ parameters: { labelName: 'ToDelete' } });
      expect(mockLabel.deleteLabel).toHaveBeenCalled();
      expect(CardService.newNavigation).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('openThread', () => {
    it('should reject missing thread id', () => {
      const result = labelManager.openThread({ parameters: {} });
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should return open link action for valid thread', () => {
      const result = labelManager.openThread({ parameters: { threadId: 't123' } });
      expect(CardService.newOpenLink).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});
