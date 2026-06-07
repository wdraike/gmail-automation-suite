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
    // Re-establish good defaults — several tests REPLACE these globals with
    // throwing stubs, and clearAllMocks does not restore reassigned globals.
    global.initializeCategorizerCache = jest.fn();
    global.getCategoryDefinitions = jest.fn(() => ({ work: { label: "Work", name: "Work" } }));
    global.getAllCategories = jest.fn(() => ({ work: { label: "Work" } }));
    global.getGmailLabels = jest.fn(() => []);
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

  describe("getAllLabelsAndCategories — labelCategories mapping", () => {
    it("builds the reverse label->categoryKeys mapping from category data", () => {
      global.getAllCategories = jest.fn(() => ({
        work: { label: "Work" },
        jobs: { label: "Work" },     // shares the "Work" label
        nolabel: { name: "x" },      // no label -> skipped
      }));
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => "Work" }]);
      const result = dashboardController.getAllLabelsAndCategories();
      expect(result.success).toBe(true);
      expect(result.labelCategories.Work.sort()).toEqual(["jobs", "work"]);
      expect(result.labelCategories.nolabel).toBeUndefined();
    });
  });

  describe("createLabel — error path", () => {
    it("returns an error object when the adapter throws", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error("gmail down"); });
      const result = dashboardController.createLabel("X");
      expect(result.success).toBe(false);
      expect(result.message).toContain("gmail down");
    });
  });

  describe("saveSettings — error path and conditional triggers", () => {
    it("returns an error when a property write throws", () => {
      // settings.categorizationFrequency.toString() on undefined throws.
      const result = dashboardController.saveSettings({});
      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it("does not set up the retention trigger when cleanupTime is missing", () => {
      const result = dashboardController.saveSettings({
        categorizationFrequency: 3,
        retentionFrequency: "weekly",
        cleanupTime: 0, // falsy -> retention trigger skipped
      });
      expect(result.success).toBe(true);
      expect(global.setupEmailCategorizationTrigger).toHaveBeenCalledWith(3);
      expect(global.setupRetentionTrigger).not.toHaveBeenCalled();
    });

    it("does not set up the categorization trigger when frequency is falsy (0)", () => {
      const result = dashboardController.saveSettings({
        categorizationFrequency: 0, // (0).toString() works but `if (0)` is false
        retentionFrequency: "daily",
        cleanupTime: 2,
      });
      expect(result.success).toBe(true);
      expect(global.setupEmailCategorizationTrigger).not.toHaveBeenCalled();
      expect(global.setupRetentionTrigger).toHaveBeenCalledWith("daily", 2);
    });
  });

  describe("forceClearLabelCategoryMappings", () => {
    it("resets the DATA_LAYER caches when present", () => {
      global.DATA_LAYER = { categories: { x: 1 }, lastLoaded: { categories: 123 } };
      global.getCategoryDefinitions = jest.fn(() => ({ a: {}, b: {} }));
      const result = dashboardController.forceClearLabelCategoryMappings();
      expect(result.success).toBe(true);
      expect(global.DATA_LAYER.categories).toBeNull();
      expect(global.DATA_LAYER.lastLoaded.categories).toBeNull();
      delete global.DATA_LAYER;
    });

    it("returns an error object when reload throws", () => {
      global.getCategoryDefinitions = jest.fn(() => { throw new Error("reload fail"); });
      const result = dashboardController.forceClearLabelCategoryMappings();
      expect(result.success).toBe(false);
      expect(result.message).toContain("reload fail");
    });
  });

  describe("moveGmailLabel — additional branches", () => {
    it("returns an error when paths are missing", () => {
      expect(dashboardController.moveGmailLabel("", "X").success).toBe(false);
      expect(dashboardController.moveGmailLabel("X", "").message).toContain("required");
    });

    it("returns an error when the target path already exists", () => {
      global.GmailApp.getUserLabelByName = jest.fn((name) => ({ getName: () => name }));
      const result = dashboardController.moveGmailLabel("Source", "Target");
      expect(result.success).toBe(false);
      expect(result.message).toContain("already exists");
    });

    it("creates the target hierarchy for a slash path and survives a non-fatal delete error", () => {
      const thread = {};
      const sourceLabel = {
        getThreads: jest.fn(() => [thread]),
        removeFromThread: jest.fn(),
        deleteLabel: jest.fn(() => { throw new Error("cannot delete"); }),
      };
      const created = { addToThread: jest.fn() };
      const seen = {};
      global.GmailApp.getUserLabelByName = jest.fn((name) => {
        if (name === "Source") return sourceLabel;
        if (name === "Parent/Child" && seen[name]) return created;
        seen[name] = true; // first lookup of the new path returns null
        return null;
      });
      global.GmailApp.createLabel = jest.fn((name) => (name === "Parent/Child" ? created : { getName: () => name }));

      const result = dashboardController.moveGmailLabel("Source", "Parent/Child");
      expect(result.success).toBe(true);
      expect(result.threadsAffected).toBe(1);
      expect(created.addToThread).toHaveBeenCalledWith(thread);
      expect(sourceLabel.removeFromThread).toHaveBeenCalledWith(thread);
    });

    it("returns an error when creating the target hierarchy fails", () => {
      const sourceLabel = { getThreads: jest.fn(() => []) };
      let call = 0;
      global.GmailApp.getUserLabelByName = jest.fn((name) => {
        if (name === "Source") return sourceLabel;
        return null;
      });
      // createLabelHierarchy will call createLabel which throws.
      global.GmailApp.createLabel = jest.fn(() => { throw new Error("hierarchy boom"); });
      const result = dashboardController.moveGmailLabel("Source", "A/B");
      expect(result.success).toBe(false);
      expect(result.message).toContain("Error creating label hierarchy");
    });

    it("returns an error object when an unexpected error is thrown", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error("boom"); });
      const result = dashboardController.moveGmailLabel("S", "T");
      expect(result.success).toBe(false);
      expect(result.message).toContain("boom");
    });
  });

  describe("createLabelHierarchyForMove — additional branches", () => {
    it("returns the existing full-path label without recreating it", () => {
      const existing = { getName: () => "A/B" };
      global.GmailApp.getUserLabelByName = jest.fn((name) => (name === "A/B" ? existing : null));
      global.GmailApp.createLabel = jest.fn((name) => ({ getName: () => name }));
      const result = dashboardController.createLabelHierarchyForMove("A/B");
      // Parent "A" created; full "A/B" already exists so returned as-is.
      expect(global.GmailApp.createLabel).toHaveBeenCalledWith("A");
      expect(global.GmailApp.createLabel).not.toHaveBeenCalledWith("A/B");
      expect(result).toBe(existing);
    });

    it("handles a single-segment path (no parent) and creates it", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const created = { getName: () => "Solo" };
      global.GmailApp.createLabel = jest.fn(() => created);
      const result = dashboardController.createLabelHierarchyForMove("Solo");
      expect(result).toBe(created);
    });

    it("skips creating a parent level that already exists", () => {
      const existingParent = { getName: () => "A" };
      const createdChild = { getName: () => "A/B" };
      global.GmailApp.getUserLabelByName = jest.fn((name) => (name === "A" ? existingParent : null));
      global.GmailApp.createLabel = jest.fn(() => createdChild);
      const result = dashboardController.createLabelHierarchyForMove("A/B");
      // Parent "A" already exists -> not recreated; only the full path is created.
      expect(global.GmailApp.createLabel).not.toHaveBeenCalledWith("A");
      expect(global.GmailApp.createLabel).toHaveBeenCalledWith("A/B");
      expect(result).toBe(createdChild);
    });

    it("logs and rethrows on error", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error("hboom"); });
      expect(() => dashboardController.createLabelHierarchyForMove("A/B")).toThrow("hboom");
    });
  });

  describe("renameGmailLabel — additional branches", () => {
    it("returns an error when names are missing", () => {
      expect(dashboardController.renameGmailLabel("", "x").success).toBe(false);
      expect(dashboardController.renameGmailLabel("x", "").message).toContain("required");
    });

    it("returns an error when the source label is not found", () => {
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      const result = dashboardController.renameGmailLabel("Missing", "New");
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
    });

    it("returns an error object when setName throws", () => {
      const label = { setName: jest.fn(() => { throw new Error("rename boom"); }) };
      global.GmailApp.getUserLabelByName = jest.fn((name) => (name === "Old" ? label : null));
      const result = dashboardController.renameGmailLabel("Old", "New");
      expect(result.success).toBe(false);
      expect(result.message).toContain("rename boom");
    });
  });

  describe("getNestedLabelsHierarchy", () => {
    it("organizes top-level and nested labels into a hierarchy", () => {
      global.getGmailLabels = jest.fn(() => [
        { getName: () => "Work", getThreads: jest.fn(() => new Array(3)) },
        { getName: () => "Work/Projects", getThreads: jest.fn(() => new Array(5)) },
        { getName: () => "Work/Projects/Q1", getThreads: jest.fn(() => new Array(100)) },
      ]);
      const result = dashboardController.getNestedLabelsHierarchy();
      expect(result.success).toBe(true);
      // Top-level "Work" label (1 segment).
      expect(result.hierarchy.root.labels[0].name).toBe("Work");
      expect(result.hierarchy.root.labels[0].count).toBe("3");
      // "Work/Projects" leaf lives under the Work intermediate node.
      const projects = result.hierarchy.root.children.Work.children.Projects;
      expect(projects.path).toBe("Work/Projects");
      expect(projects.labels[0].fullName).toBe("Work/Projects/Q1");
      // The deepest leaf (Q1, 100 threads) -> "100+".
      expect(projects.labels[0].count).toBe("100+");
    });

    it("returns an error object when label enumeration throws", () => {
      global.getGmailLabels = jest.fn(() => { throw new Error("labels boom"); });
      const result = dashboardController.getNestedLabelsHierarchy();
      expect(result.success).toBe(false);
      expect(result.message).toContain("labels boom");
    });
  });

  describe("moveCategoryBetweenLabels", () => {
    beforeEach(() => {
      global.getAllLabelCategories = jest.fn(() => ({}));
      global.removeCategoryFromLabel = jest.fn(() => ({ success: true }));
      global.addCategoryToLabel = jest.fn(() => ({ success: true }));
    });

    it("no-ops when source and target are the same", () => {
      const result = dashboardController.moveCategoryBetweenLabels("k", "L", "L");
      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
      expect(global.removeCategoryFromLabel).not.toHaveBeenCalled();
    });

    it("moves the category by removing from source then adding to target", () => {
      const result = dashboardController.moveCategoryBetweenLabels("k", "S", "T");
      expect(global.removeCategoryFromLabel).toHaveBeenCalledWith("S", "k");
      expect(global.addCategoryToLabel).toHaveBeenCalledWith("T", "k");
      expect(result.success).toBe(true);
      expect(result.changed).toBe(true);
    });

    it("returns the remove result when removal fails", () => {
      global.removeCategoryFromLabel = jest.fn(() => ({ success: false, message: "nope" }));
      const result = dashboardController.moveCategoryBetweenLabels("k", "S", "T");
      expect(result.success).toBe(false);
      expect(global.addCategoryToLabel).not.toHaveBeenCalled();
    });

    it("reports a partial failure when add to target fails", () => {
      global.addCategoryToLabel = jest.fn(() => ({ success: false, message: "addfail" }));
      const result = dashboardController.moveCategoryBetweenLabels("k", "S", "T");
      expect(result.success).toBe(false);
      expect(result.changed).toBe(true);
      expect(result.message).toContain("failed to add");
    });

    it("returns an error object when an exception is thrown", () => {
      global.getAllLabelCategories = jest.fn(() => { throw new Error("state boom"); });
      const result = dashboardController.moveCategoryBetweenLabels("k", "S", "T");
      expect(result.success).toBe(false);
      expect(result.message).toContain("state boom");
    });
  });

  describe("checkStorageUpdated", () => {
    it("returns file metadata when the file exists", () => {
      global.PropertiesService.getScriptProperties().setProperty("EMAIL_CATEGORIZER_FILE_ID", "file123");
      const file = {
        getLastUpdated: jest.fn(() => new Date("2024-01-01T00:00:00Z")),
        getName: jest.fn(() => "data.json"),
        getSize: jest.fn(() => 4096),
      };
      global.DriveApp.getFileById = jest.fn(() => file);
      const result = dashboardController.checkStorageUpdated();
      expect(result.success).toBe(true);
      expect(result.fileExists).toBe(true);
      expect(result.fileName).toBe("data.json");
      expect(result.fileSize).toBe(4096);
    });

    it("returns an error when the file cannot be accessed", () => {
      global.PropertiesService.getScriptProperties().setProperty("EMAIL_CATEGORIZER_FILE_ID", "bad");
      global.DriveApp.getFileById = jest.fn(() => { throw new Error("no file"); });
      const result = dashboardController.checkStorageUpdated();
      expect(result.success).toBe(false);
      expect(result.fileExists).toBe(false);
      expect(result.message).toContain("Error accessing file");
    });

    it("returns a failure when no file ID is stored", () => {
      const result = dashboardController.checkStorageUpdated();
      expect(result.success).toBe(false);
      expect(result.message).toContain("No file ID");
    });

    it("returns an error when reading properties throws", () => {
      const original = global.PropertiesService.getScriptProperties;
      global.PropertiesService.getScriptProperties = jest.fn(() => { throw new Error("props boom"); });
      const result = dashboardController.checkStorageUpdated();
      expect(result.success).toBe(false);
      expect(result.message).toContain("Error checking storage");
      global.PropertiesService.getScriptProperties = original;
    });
  });

  describe("getCategoryAssignments", () => {
    it("returns the category items map", () => {
      global.getAllCategoryItems = jest.fn(() => ({ work: ["a@x.com"] }));
      const result = dashboardController.getCategoryAssignments();
      expect(result.success).toBe(true);
      expect(result.assignments).toEqual({ work: ["a@x.com"] });
    });

    it("returns an error object on failure", () => {
      global.getAllCategoryItems = jest.fn(() => { throw new Error("items boom"); });
      const result = dashboardController.getCategoryAssignments();
      expect(result.success).toBe(false);
      expect(result.message).toContain("items boom");
    });
  });

  describe("moveItemToCategory", () => {
    beforeEach(() => {
      global.updateCategoryForEmail = jest.fn();
      global.updateCategoryForDomain = jest.fn();
    });

    it("moves an email", () => {
      const result = dashboardController.moveItemToCategory("a@x.com", "work", "email");
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith("a@x.com", "work");
      expect(result.success).toBe(true);
    });

    it("moves a domain", () => {
      const result = dashboardController.moveItemToCategory("x.com", "work", "domain");
      expect(global.updateCategoryForDomain).toHaveBeenCalledWith("x.com", "work");
      expect(result.success).toBe(true);
    });

    it("rejects an unknown item type", () => {
      const result = dashboardController.moveItemToCategory("x", "work", "bogus");
      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown item type");
    });

    it("returns an error object when the update throws", () => {
      global.updateCategoryForEmail = jest.fn(() => { throw new Error("upd boom"); });
      const result = dashboardController.moveItemToCategory("a@x.com", "work", "email");
      expect(result.success).toBe(false);
      expect(result.message).toContain("upd boom");
    });
  });

  describe("removeCategoryAssignment", () => {
    beforeEach(() => {
      global.removeCategoryFromEmail = jest.fn(() => true);
      global.removeCategoryFromDomain = jest.fn(() => true);
    });

    it("removes an email assignment", () => {
      const result = dashboardController.removeCategoryAssignment("a@x.com", "email");
      expect(result.success).toBe(true);
      expect(global.removeCategoryFromEmail).toHaveBeenCalledWith("a@x.com");
    });

    it("removes a domain assignment", () => {
      const result = dashboardController.removeCategoryAssignment("x.com", "domain");
      expect(result.success).toBe(true);
      expect(global.removeCategoryFromDomain).toHaveBeenCalledWith("x.com");
    });

    it("rejects an unknown item type", () => {
      const result = dashboardController.removeCategoryAssignment("x", "bogus");
      expect(result.success).toBe(false);
      expect(result.message).toContain("Unknown item type");
    });

    it("returns a failure when removal returns falsy", () => {
      global.removeCategoryFromEmail = jest.fn(() => false);
      const result = dashboardController.removeCategoryAssignment("a@x.com", "email");
      expect(result.success).toBe(false);
      expect(result.message).toContain("Failed to remove");
    });

    it("returns an error object when removal throws", () => {
      global.removeCategoryFromEmail = jest.fn(() => { throw new Error("rm boom"); });
      const result = dashboardController.removeCategoryAssignment("a@x.com", "email");
      expect(result.success).toBe(false);
      expect(result.message).toContain("rm boom");
    });
  });

  describe("getCategoriesAndAssignments", () => {
    it("returns categories and label assignments", () => {
      global.loadCategories = jest.fn(() => ({ work: {} }));
      global.getAllLabelCategories = jest.fn(() => ({ Work: ["work"] }));
      const result = dashboardController.getCategoriesAndAssignments();
      expect(result.success).toBe(true);
      expect(result.categories).toEqual({ work: {} });
      expect(result.labelCategories).toEqual({ Work: ["work"] });
    });

    it("returns an error object on failure", () => {
      global.loadCategories = jest.fn(() => { throw new Error("load boom"); });
      const result = dashboardController.getCategoriesAndAssignments();
      expect(result.success).toBe(false);
      expect(result.message).toContain("load boom");
    });
  });

  describe("processBatchedChanges", () => {
    beforeEach(() => {
      global.updateCategoryForEmail = jest.fn();
      global.updateCategoryForDomain = jest.fn();
      global.removeCategoryFromLabel = jest.fn();
      global.addCategoryToLabel = jest.fn();
    });

    it("returns early for null/empty/non-array changes", () => {
      expect(dashboardController.processBatchedChanges(null).processedCount).toBe(0);
      expect(dashboardController.processBatchedChanges([]).processedCount).toBe(0);
      expect(dashboardController.processBatchedChanges("nope").processedCount).toBe(0);
    });

    it("processes moveItem (email + domain) and moveCategory changes", () => {
      const result = dashboardController.processBatchedChanges([
        { type: "moveItem", item: "a@x.com", targetCategory: "work", itemType: "email" },
        { type: "moveItem", item: "x.com", targetCategory: "work", itemType: "domain" },
        { type: "moveCategory", categoryKey: "k", sourceLabel: "S", targetLabel: "T" },
      ]);
      expect(result.processedCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith("a@x.com", "work");
      expect(global.updateCategoryForDomain).toHaveBeenCalledWith("x.com", "work");
      expect(global.removeCategoryFromLabel).toHaveBeenCalledWith("S", "k");
      expect(global.addCategoryToLabel).toHaveBeenCalledWith("T", "k");
    });

    it("counts per-change errors and continues", () => {
      global.updateCategoryForEmail = jest.fn(() => { throw new Error("boom"); });
      const result = dashboardController.processBatchedChanges([
        { type: "moveItem", item: "a@x.com", targetCategory: "work", itemType: "email" },
        { type: "moveCategory", categoryKey: "k", sourceLabel: "S", targetLabel: "T" },
      ]);
      expect(result.errorCount).toBe(1);
      expect(result.processedCount).toBe(1);
    });

    it("ignores moveItem changes with an unrecognized itemType", () => {
      const result = dashboardController.processBatchedChanges([
        { type: "moveItem", item: "x", targetCategory: "work", itemType: "weird" },
      ]);
      // No update fns called, but the change still counts as processed.
      expect(result.processedCount).toBe(1);
      expect(global.updateCategoryForEmail).not.toHaveBeenCalled();
    });

    it("ignores changes of an unrecognized type", () => {
      const result = dashboardController.processBatchedChanges([
        { type: "somethingElse" },
      ]);
      // Neither moveItem nor moveCategory -> nothing processed.
      expect(result.processedCount).toBe(0);
      expect(result.errorCount).toBe(0);
    });

    it("returns an error object when the outer loop throws", () => {
      // A genuine Array (passes Array.isArray + length>0) whose iterator throws
      // inside the outer try but outside the per-change inner try/catch.
      const evil = [1];
      evil[Symbol.iterator] = function () { throw new Error("iter boom"); };
      const result = dashboardController.processBatchedChanges(evil);
      expect(result.success).toBe(false);
      expect(result.message).toContain("iter boom");
    });
  });

  describe("generateRuleId", () => {
    it("generates a rule_-prefixed 8-char id from a UUID", () => {
      global.Utilities.getUuid = jest.fn(() => "abcdef12-3456-7890-abcd-ef1234567890");
      const id = dashboardController.generateRuleId();
      expect(id).toMatch(/^rule_[a-f0-9]{8}$/);
      expect(id).toBe("rule_abcdef12");
    });
  });

  describe("serviceFactory seam (GAS-global branch)", () => {
    afterEach(() => { delete global.serviceFactory; });

    it("resolves the GAS-global serviceFactory when one is present", () => {
      // Exercises the `typeof serviceFactory !== 'undefined'` true branch.
      global.serviceFactory = serviceFactory;
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      global.GmailApp.createLabel = jest.fn((name) => ({ getName: () => name }));
      const result = dashboardController.createLabel("ViaGlobalFactory");
      expect(result.success).toBe(true);
    });
  });

  describe("client-side DOM handlers", () => {
    let listeners;
    let createdEls;

    beforeEach(() => {
      listeners = {};
      createdEls = [];
      global.labelCategories = {};
      global.allCategories = {};
      global.console = { error: jest.fn(), log: jest.fn() };
      global.moveCategoryBetweenLabels = jest.fn();
      global.addCategoryToLabel = jest.fn();
    });

    afterEach(() => {
      delete global.document;
      delete global.labelCategories;
      delete global.allCategories;
    });

    function makeZone(labelName) {
      const handlers = {};
      return {
        _handlers: handlers,
        getAttribute: jest.fn(() => labelName),
        classList: { add: jest.fn(), remove: jest.fn() },
        addEventListener: jest.fn((evt, fn) => { handlers[evt] = fn; }),
      };
    }

    describe("setupCategoryDropZones", () => {
      it("wires dragover/dragleave/drop handlers and adds a new category on drop", () => {
        const zone = makeZone("Work");
        global.document = { querySelectorAll: jest.fn(() => [zone]) };
        global.labelCategories = { Work: [] };

        dashboardController.setupCategoryDropZones();
        expect(zone.addEventListener).toHaveBeenCalledTimes(3);

        // dragover highlights and prevents default
        const e1 = { preventDefault: jest.fn() };
        zone._handlers.dragover.call(zone, e1);
        expect(e1.preventDefault).toHaveBeenCalled();
        expect(zone.classList.add).toHaveBeenCalledWith("highlight");

        // dragleave removes highlight
        zone._handlers.dragleave.call(zone);
        expect(zone.classList.remove).toHaveBeenCalledWith("highlight");

        // drop with a brand-new category -> addCategoryToLabel
        const dropEvt = {
          preventDefault: jest.fn(),
          dataTransfer: { getData: jest.fn(() => JSON.stringify({ type: "category", categoryKey: "k" })) },
        };
        zone._handlers.drop.call(zone, dropEvt);
        expect(global.addCategoryToLabel).toHaveBeenCalledWith("Work", "k");
      });

      it("moves a category between labels when dropped from a different source label", () => {
        // In Node the drop handler calls the in-module moveCategoryBetweenLabels
        // (not a global spy), so assert through its real dependencies.
        global.getAllLabelCategories = jest.fn(() => ({}));
        global.removeCategoryFromLabel = jest.fn(() => ({ success: true }));
        global.addCategoryToLabel = jest.fn(() => ({ success: true }));

        const zone = makeZone("Target");
        global.document = { querySelectorAll: jest.fn(() => [zone]) };
        dashboardController.setupCategoryDropZones();
        const dropEvt = {
          preventDefault: jest.fn(),
          dataTransfer: { getData: jest.fn(() => JSON.stringify({ type: "category", categoryKey: "k", sourceLabel: "Other" })) },
        };
        zone._handlers.drop.call(zone, dropEvt);
        // moveCategoryBetweenLabels("k","Other","Target") removes from source then adds to target.
        expect(global.removeCategoryFromLabel).toHaveBeenCalledWith("Other", "k");
        expect(global.addCategoryToLabel).toHaveBeenCalledWith("Target", "k");
      });

      it("treats a label with no existing entry as empty (|| [] fallback)", () => {
        const zone = makeZone("Unknown");
        global.document = { querySelectorAll: jest.fn(() => [zone]) };
        global.labelCategories = {}; // "Unknown" not present -> existingCategories = []
        dashboardController.setupCategoryDropZones();
        const dropEvt = {
          preventDefault: jest.fn(),
          dataTransfer: { getData: jest.fn(() => JSON.stringify({ type: "category", categoryKey: "k" })) },
        };
        zone._handlers.drop.call(zone, dropEvt);
        expect(global.addCategoryToLabel).toHaveBeenCalledWith("Unknown", "k");
      });

      it("does not re-add a category that is already assigned", () => {
        const zone = makeZone("Work");
        global.document = { querySelectorAll: jest.fn(() => [zone]) };
        global.labelCategories = { Work: ["k"] };
        dashboardController.setupCategoryDropZones();
        const dropEvt = {
          preventDefault: jest.fn(),
          dataTransfer: { getData: jest.fn(() => JSON.stringify({ type: "category", categoryKey: "k" })) },
        };
        zone._handlers.drop.call(zone, dropEvt);
        expect(global.addCategoryToLabel).not.toHaveBeenCalled();
      });

      it("ignores a drop whose payload type is not 'category'", () => {
        const zone = makeZone("Work");
        global.document = { querySelectorAll: jest.fn(() => [zone]) };
        dashboardController.setupCategoryDropZones();
        const dropEvt = {
          preventDefault: jest.fn(),
          dataTransfer: { getData: jest.fn(() => JSON.stringify({ type: "other" })) },
        };
        zone._handlers.drop.call(zone, dropEvt);
        expect(global.addCategoryToLabel).not.toHaveBeenCalled();
      });

      it("logs to console.error when the drop payload is malformed JSON", () => {
        const zone = makeZone("Work");
        global.document = { querySelectorAll: jest.fn(() => [zone]) };
        dashboardController.setupCategoryDropZones();
        const dropEvt = {
          preventDefault: jest.fn(),
          dataTransfer: { getData: jest.fn(() => "not json") },
        };
        zone._handlers.drop.call(zone, dropEvt);
        expect(global.console.error).toHaveBeenCalled();
      });
    });

    describe("createCategoryPill", () => {
      function makePill() {
        const handlers = {};
        return {
          _handlers: handlers,
          className: "",
          innerHTML: "",
          setAttribute: jest.fn(),
          classList: { add: jest.fn(), remove: jest.fn() },
          addEventListener: jest.fn((evt, fn) => { handlers[evt] = fn; }),
        };
      }

      it("uses the string display name when the category maps to a string", () => {
        const pill = makePill();
        global.document = { createElement: jest.fn(() => pill) };
        global.allCategories = { k: "Pretty Name" };
        const result = dashboardController.createCategoryPill("k", "Work");
        expect(result).toBe(pill);
        expect(pill.innerHTML).toContain("Pretty Name");
        expect(pill.setAttribute).toHaveBeenCalledWith("data-category", "k");
        // a11y: the remove-X button carries a descriptive aria-label (ux-a11y-fix Wave 2)
        expect(pill.innerHTML).toContain(
          'aria-label="Remove Pretty Name from Work"'
        );
      });

      it("uses the object displayName when present", () => {
        const pill = makePill();
        global.document = { createElement: jest.fn(() => pill) };
        global.allCategories = { k: { displayName: "Object Name" } };
        const result = dashboardController.createCategoryPill("k", "Work");
        expect(result.innerHTML).toContain("Object Name");
      });

      it("falls back to the category key when no mapping exists", () => {
        const pill = makePill();
        global.document = { createElement: jest.fn(() => pill) };
        global.allCategories = {};
        const result = dashboardController.createCategoryPill("rawkey", "Work");
        expect(result.innerHTML).toContain("rawkey");
      });

      it("wires dragstart (sets data + opacity) and dragend (removes opacity)", () => {
        const pill = makePill();
        global.document = { createElement: jest.fn(() => pill) };
        global.allCategories = { k: { name: "no-display" } }; // object w/o displayName
        dashboardController.createCategoryPill("k", "Work");

        const dragEvt = { dataTransfer: { setData: jest.fn() } };
        pill._handlers.dragstart.call(pill, dragEvt);
        expect(dragEvt.dataTransfer.setData).toHaveBeenCalledWith(
          "text/plain",
          JSON.stringify({ type: "category", categoryKey: "k", sourceLabel: "Work" })
        );
        expect(pill.classList.add).toHaveBeenCalledWith("opacity-50");

        pill._handlers.dragend.call(pill);
        expect(pill.classList.remove).toHaveBeenCalledWith("opacity-50");
      });
    });
  });
});
