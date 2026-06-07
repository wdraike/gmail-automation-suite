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

    it('reuses an existing folder when two nested labels share a parent', () => {
      // Second label hits the `if (!currentLevel.children[parts[i]])` FALSE branch
      // because the 'Work' folder already exists from the first label.
      const labels = [
        { name: 'Work/Projects' },
        { name: 'Work/Archive' }
      ];
      const result = labelManager.organizeLabelsHierarchically(labels);
      expect(Object.keys(result.root.children)).toEqual(['Work']);
      expect(result.root.children.Work.labels.map(l => l.name).sort())
        .toEqual(['Archive', 'Projects']);
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

    it('still builds the confirm card when the label is not found (if(label) false branch)', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const result = labelManager.confirmDeleteLabel({ parameters: { labelName: 'Ghost' } });
      // No thread-count widget added, but the card still builds.
      expect(CardService.newCardBuilder).toHaveBeenCalled();
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

  describe('showEnhancedLabelManager', () => {
    it('builds the manager card from the current labels', () => {
      global.getGmailLabels = jest.fn(() => [
        { name: 'Work' },
        { name: 'Work/Projects' }
      ]);
      const result = labelManager.showEnhancedLabelManager();
      // It pulls labels and builds a card (no navigation wrapper — returns build()).
      expect(getGmailLabels).toHaveBeenCalledWith(false);
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(result).toEqual({ mockCard: true });
    });
  });

  describe('addHierarchicalLabelsToSection', () => {
    // Build a real section spy so we can count how many widgets get added.
    function makeSectionSpy() {
      const addWidget = jest.fn(function () { return this; });
      return { addWidget };
    }

    it('adds a button widget for each top-level label', () => {
      const section = makeSectionSpy();
      const hierarchy = {
        labels: [
          { name: 'Work', fullName: 'Work', count: 3 },
          { name: 'Personal', count: 1 }
        ],
        children: {}
      };
      labelManager.addHierarchicalLabelsToSection(section, hierarchy, 0);
      // One widget per label.
      expect(section.addWidget).toHaveBeenCalledTimes(2);
      expect(CardService.newTextButton).toHaveBeenCalled();
    });

    it('recurses into child folders, adding a header per child', () => {
      const section = makeSectionSpy();
      const hierarchy = {
        labels: [],
        children: {
          Work: {
            name: 'Work',
            labels: [{ name: 'Projects', fullName: 'Work/Projects', count: 2 }],
            children: {}
          }
        }
      };
      labelManager.addHierarchicalLabelsToSection(section, hierarchy, 0);
      // 1 folder header (newTextParagraph) + 1 nested label button.
      expect(CardService.newTextParagraph).toHaveBeenCalled();
      expect(section.addWidget).toHaveBeenCalledTimes(2);
    });

    it('adds nothing when there are no labels and no children', () => {
      const section = makeSectionSpy();
      labelManager.addHierarchicalLabelsToSection(section, { labels: [], children: {} }, 0);
      expect(section.addWidget).not.toHaveBeenCalled();
    });
  });

  describe('selectLabel', () => {
    function makeThread(unread, id) {
      return {
        isUnread: jest.fn(() => unread),
        getId: jest.fn(() => id),
        getMessages: jest.fn(() => [{
          getFrom: jest.fn(() => 'sender@example.com'),
          getSubject: jest.fn(() => 'Subject line'),
          getDate: jest.fn(() => new Date('2026-01-01T00:00:00Z'))
        }])
      };
    }

    it('returns a no-label notification when no label is selected', () => {
      const result = labelManager.selectLabel({ parameters: {} });
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(result).toEqual({ mockActionResponse: true });
    });

    it('handles a falsy event object (e && e.parameters short-circuit)', () => {
      const result = labelManager.selectLabel(null);
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(result).toEqual({ mockActionResponse: true });
    });

    it('returns a not-found notification when the label does not exist', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const result = labelManager.selectLabel({ parameters: { selectedLabel: 'Ghost' } });
      expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('Ghost');
      expect(result).toEqual({ mockActionResponse: true });
    });

    it('builds a detail card with stats and recent emails for an existing label', () => {
      const threads = [makeThread(true, 't1'), makeThread(false, 't2')];
      const mockLabel = { getThreads: jest.fn(() => threads) };
      global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);
      const result = labelManager.selectLabel({ parameters: { selectedLabel: 'Work' } });
      expect(mockLabel.getThreads).toHaveBeenCalledWith(0, 100);
      // Recent emails section iterated messages.
      expect(threads[0].getMessages).toHaveBeenCalled();
      expect(CardService.newNavigation).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('shows the empty-state paragraph when the label has no threads', () => {
      const mockLabel = { getThreads: jest.fn(() => []) };
      global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);
      labelManager.selectLabel({ parameters: { selectedLabel: 'Empty' } });
      // The "No recent emails" paragraph branch.
      expect(CardService.newTextParagraph).toHaveBeenCalled();
    });

    it('reports "100+" when there are 100 or more threads', () => {
      const many = Array.from({ length: 100 }, (_, i) => makeThread(false, `t${i}`));
      const mockLabel = { getThreads: jest.fn(() => many) };
      global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);
      // Capture the values fed into KeyValue widgets so we can assert the
      // displayed thread count is exactly "100+".
      const setContents = [];
      CardService.newKeyValue = jest.fn(() => {
        const kv = {
          setTopLabel: jest.fn(() => kv),
          setContent: jest.fn((v) => { setContents.push(v); return kv; }),
          setMultiline: jest.fn(() => kv),
          setBottomLabel: jest.fn(() => kv),
          setOnClickAction: jest.fn(() => kv)
        };
        return kv;
      });
      labelManager.selectLabel({ parameters: { selectedLabel: 'Big' } });
      expect(setContents).toContain('100+');
    });
  });

  describe('createNewLabel — error branch', () => {
    it('returns an error notification when label creation throws', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      global.GmailApp.createLabel = jest.fn(() => { throw new Error('quota'); });
      const result = labelManager.createNewLabel({ formInput: { parentLabel: '', labelName: 'New' } });
      expect(CardService.newActionResponseBuilder).toHaveBeenCalled();
      expect(result).toEqual({ mockActionResponse: true });
    });
  });

  describe('showRenameLabelDialog', () => {
    it('rejects a missing label name', () => {
      const result = labelManager.showRenameLabelDialog({ parameters: {} });
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(result).toEqual({ mockActionResponse: true });
    });

    it('builds the rename dialog for a valid label', () => {
      const result = labelManager.showRenameLabelDialog({ parameters: { labelName: 'Work' } });
      expect(CardService.newCardBuilder).toHaveBeenCalled();
      expect(CardService.newNavigation).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('renameLabel', () => {
    it('rejects when names are missing or blank', () => {
      const result = labelManager.renameLabel({ parameters: { labelName: 'Work' }, formInput: { newLabelName: '  ' } });
      expect(CardService.newNotification).toHaveBeenCalled();
      expect(result).toEqual({ mockActionResponse: true });
    });

    it('returns not-found when the source label does not exist', () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const result = labelManager.renameLabel({ parameters: { labelName: 'Ghost' }, formInput: { newLabelName: 'New' } });
      expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('Ghost');
      expect(result).toEqual({ mockActionResponse: true });
    });

    it('rejects when the target name already exists', () => {
      const source = { setName: jest.fn() };
      // First lookup (source) returns the label; second lookup (target) returns an existing label.
      global.GmailApp.getUserLabelByName = jest.fn()
        .mockReturnValueOnce(source)
        .mockReturnValueOnce({ getName: jest.fn(() => 'Existing') });
      const result = labelManager.renameLabel({ parameters: { labelName: 'Work' }, formInput: { newLabelName: 'Existing' } });
      expect(source.setName).not.toHaveBeenCalled();
      expect(result).toEqual({ mockActionResponse: true });
    });

    it('renames the label and navigates to the renamed detail card', () => {
      const source = { setName: jest.fn(), getThreads: jest.fn(() => []) };
      global.GmailApp.getUserLabelByName = jest.fn()
        .mockReturnValueOnce(source)   // source lookup in renameLabel
        .mockReturnValueOnce(null)     // target does not exist
        .mockReturnValue(source);      // subsequent selectLabel lookups
      const result = labelManager.renameLabel({ parameters: { labelName: 'Work' }, formInput: { newLabelName: 'Renamed' } });
      expect(source.setName).toHaveBeenCalledWith('Renamed');
      expect(CardService.newNavigation).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('returns an error notification when setName throws', () => {
      const source = { setName: jest.fn(() => { throw new Error('boom'); }) };
      global.GmailApp.getUserLabelByName = jest.fn()
        .mockReturnValueOnce(source)
        .mockReturnValueOnce(null);
      const result = labelManager.renameLabel({ parameters: { labelName: 'Work' }, formInput: { newLabelName: 'New' } });
      expect(result).toEqual({ mockActionResponse: true });
    });
  });

  describe('deleteLabel — error branch', () => {
    it('returns an error notification when deleteLabel throws', () => {
      const mockLabel = { deleteLabel: jest.fn(() => { throw new Error('boom'); }) };
      global.GmailApp.getUserLabelByName = jest.fn(() => mockLabel);
      const result = labelManager.deleteLabel({ parameters: { labelName: 'X' } });
      expect(result).toEqual({ mockActionResponse: true });
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });

    it('resolves the GAS-global serviceFactory when present', () => {
      global.serviceFactory = serviceFactory;
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      // openThread doesn't use the factory; use deleteLabel which calls _elmGmail().
      const result = labelManager.deleteLabel({ parameters: { labelName: 'Y' } });
      expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('Y');
      expect(result).toBeDefined();
    });
  });
});
