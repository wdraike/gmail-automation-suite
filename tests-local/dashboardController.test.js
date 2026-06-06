/**
 * Tests for src/ui/dashboardController.js
 * Focus on server-side exported functions.
 */

// Mock globals before requiring the module
global.initializeCategorizerCache = jest.fn();
global.getCategoryDefinitions = jest.fn(() => ({ work: { label: "Work", name: "Work" } }));
global.getAllCategories = jest.fn(() => ({ work: { label: "Work" } }));
global.setupEmailCategorizationTrigger = jest.fn();
global.setupRetentionTrigger = jest.fn();
global.getGmailLabels = jest.fn(() => []);

global.UnifiedCacheService = {
  retentionRules: { getAll: jest.fn(() => []) },
};

const dashboardController = require("../src/ui/dashboardController.js");
// Gmail/Properties/Drive/Utilities access is routed through serviceFactory
// ports; the real adapters delegate to the global SDK mocks (setup.js). Tests
// drive those globals and reset the factory each test.
const { serviceFactory } = require("../src/core/services/index.js");

describe("dashboardController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serviceFactory.reset();
    // GmailAdapter.getAllLabels caches in CacheService; clear so each test's
    // getUserLabels mock is exercised deterministically.
    global.CacheService.getScriptCache().remove("GMAIL_LABELS_CACHE");
  });

  describe("getAllLabelsAndCategories", () => {
    it("returns labels, categories, labelCategories and retentionRules", () => {
      // GmailAdapter.getAllLabels reads getUserLabels + prepends system labels.
      global.GmailApp.getUserLabels = jest.fn(() => [
        { getName: () => "Work" },
        { getName: () => "Personal" },
      ]);
      const result = dashboardController.getAllLabelsAndCategories();
      expect(result.success).toBe(true);
      expect(result.labels.some((l) => l.name === "Work")).toBe(true);
      expect(result.labels.some((l) => l.name === "Personal")).toBe(true);
      expect(result.categories).toEqual({ work: { label: "Work", name: "Work" } });
      expect(result.retentionRules).toEqual([]);
      expect(global.initializeCategorizerCache).toHaveBeenCalled();
    });

    it("returns error object when dependency throws", () => {
      global.initializeCategorizerCache = jest.fn(() => { throw new Error("cache fail"); });
      const result = dashboardController.getAllLabelsAndCategories();
      expect(result.success).toBe(false);
      expect(result.message).toContain("cache fail");
    });
  });

  describe("createLabel", () => {
    it("creates a simple label when it does not exist", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      global.GmailApp.createLabel = jest.fn((name) => ({ getName: () => name }));
      const result = dashboardController.createLabel("NewLabel");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Created label");
      expect(global.GmailApp.createLabel).toHaveBeenCalledWith("NewLabel");
    });

    it("returns error when label already exists", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => ({ getName: () => "Existing" }));
      const result = dashboardController.createLabel("Existing");
      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");
    });

    it("creates hierarchy when name contains slash", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      global.GmailApp.createLabel = jest.fn((name) => ({ getName: () => name }));
      const result = dashboardController.createLabel("Parent/Child");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Created label");
    });
  });

  describe("saveSettings", () => {
    it("saves settings and returns success", () => {
      const result = dashboardController.saveSettings({
        categorizationFrequency: 6,
        retentionFrequency: "daily",
        cleanupTime: 2,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("saved");
      expect(global.setupEmailCategorizationTrigger).toHaveBeenCalledWith(6);
      expect(global.setupRetentionTrigger).toHaveBeenCalledWith("daily", 2);
    });
  });

  describe("forceClearLabelCategoryMappings", () => {
    it("clears properties and returns success", () => {
      const result = dashboardController.forceClearLabelCategoryMappings();
      expect(result.success).toBe(true);
      expect(result.message).toContain("reset");
    });
  });

  describe("moveGmailLabel", () => {
    it("moves threads from source to target label", () => {
      const mockThread = {};
      const sourceLabel = {
        getThreads: jest.fn(() => [mockThread]),
        addToThread: jest.fn(),
        removeFromThread: jest.fn(),
        deleteLabel: jest.fn(),
      };
      const targetLabel = {
        getName: jest.fn(() => "Target"),
        addToThread: jest.fn(),
      };
      global.GmailApp.getUserLabelByName = jest.fn((name) => {
        if (name === "Source") return sourceLabel;
        return null;
      });
      global.GmailApp.createLabel = jest.fn((name) => targetLabel);
      const result = dashboardController.moveGmailLabel("Source", "Target");
      expect(result.success).toBe(true);
      expect(result.message).toContain("Successfully moved");
    });

    it("returns error when source missing", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const result = dashboardController.moveGmailLabel("Missing", "Target");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });
  });

  describe("createLabelHierarchyForMove", () => {
    it("creates nested parent labels when moving to new path", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      global.GmailApp.createLabel = jest.fn((name) => ({ getName: () => name }));
      dashboardController.createLabelHierarchyForMove("A/B/C");
      expect(global.GmailApp.createLabel).toHaveBeenCalledWith("A");
      expect(global.GmailApp.createLabel).toHaveBeenCalledWith("A/B");
      expect(global.GmailApp.createLabel).toHaveBeenCalledWith("A/B/C");
    });
  });

  describe("renameGmailLabel", () => {
    it("renames label when source exists and target does not", () => {
      const label = { setName: jest.fn() };
      global.GmailApp.getUserLabelByName = jest.fn((name) => {
        if (name === "Old") return label;
        return null;
      });
      const result = dashboardController.renameGmailLabel("Old", "New");
      expect(result.success).toBe(true);
      expect(label.setName).toHaveBeenCalledWith("New");
    });

    it("returns error when target already exists", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => ({ getName: () => "Exists" }));
      const result = dashboardController.renameGmailLabel("Old", "Exists");
      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");
    });
  });

  describe("getThreadCount", () => {
    it("returns exact count when under 100 threads", () => {
      const label = { getThreads: jest.fn(() => new Array(42)) };
      const result = dashboardController.getThreadCount(label);
      expect(result).toBe("42");
    });

    it("returns 100+ when thread count reaches 100", () => {
      const label = { getThreads: jest.fn(() => new Array(100)) };
      const result = dashboardController.getThreadCount(label);
      expect(result).toBe("100+");
    });

    it("returns 0 on error", () => {
      const label = { getThreads: jest.fn(() => { throw new Error("fail"); }) };
      const result = dashboardController.getThreadCount(label);
      expect(result).toBe("0");
    });
  });
});
