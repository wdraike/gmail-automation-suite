/**
 * Dashboard API Tests
 * Tests for src/ui/dashboard-api.js endpoints and helpers
 */

const dashboardApi = require('../src/ui/dashboard-api.js');
// Gmail/Properties/Utilities/Gemini access is routed through serviceFactory
// ports; the real adapters delegate to the global SDK mocks (setup.js). Tests
// drive those globals and reset the factory each test.
const { serviceFactory } = require('../src/core/services/index.js');

// Mock global dependencies from other modules
global.getAllLabelsAndCategories = jest.fn(() => ({
  labels: [{ name: 'Work' }],
  categories: { work: 'Work' },
  labelCategories: { Work: ['work'] },
  retentionRules: [{ label: 'Work', days: 30 }]
}));
global.updateCategoryForEmail = jest.fn(() => ({ success: true, message: 'updated' }));
global.addCategoryToLabel = jest.fn(() => ({ success: true, message: 'added' }));
global.createLabel = jest.fn(() => ({ success: true, message: 'created' }));
global.updateRetentionRule = jest.fn(() => ({ success: true, rule: { labelName: 'Work' } }));
global.deleteRetentionRuleByLabel = jest.fn(() => ({ success: true, message: 'deleted' }));
global.runAllRetentionRules = jest.fn(() => ({
  success: true,
  message: 'run',
  processedRules: [],
  totalProcessed: 0,
  totalAffected: 0,
  ruleResults: []
}));
global.processBatchedChanges = jest.fn(() => ({
  success: true,
  message: 'processed',
  processedCount: 2,
  errorCount: 0
}));
global.saveSettings = jest.fn(() => ({ success: true, message: 'saved' }));
global.verifyGeminiApiKey = jest.fn(() => ({ valid: true, message: 'ok' }));
global.getLastRunTime = jest.fn(() => 'Never');
// callGeminiApi is the global the GeminiAdapter delegates to.
global.callGeminiApi = jest.fn(() => ({ success: true, categories: ['work'] }));
global.UnifiedCacheService = {
  labelCategories: { getAll: jest.fn(() => ({})) },
  emailCategories: { getAll: jest.fn(() => ({})) },
  retentionRules: { getAll: jest.fn(() => []) }
};

describe('Dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Fresh adapters bound to current global SDK mocks.
    serviceFactory.reset();
    // Restore a clean UnifiedCacheService each test (some tests poison getAll).
    global.UnifiedCacheService = {
      labelCategories: { getAll: jest.fn(() => ({})) },
      emailCategories: { getAll: jest.fn(() => ({})) },
      retentionRules: { getAll: jest.fn(() => []) }
    };
  });

  describe('getDashboardData', () => {
    it('should return structured data on success', () => {
      const result = dashboardApi.getDashboardData();
      expect(result.success).toBe(true);
      expect(result.data.labels).toEqual([{ name: 'Work' }]);
      expect(result.data.systemStatus).toBeDefined();
    });

    it('should return error object when dependency throws', () => {
      global.getAllLabelsAndCategories = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.getDashboardData();
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });
  });

  describe('updateEmailCategory', () => {
    it('should reject missing email', () => {
      const result = dashboardApi.updateEmailCategory('', 'work');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return success when update succeeds', () => {
      const result = dashboardApi.updateEmailCategory('a@b.com', 'work');
      expect(result.success).toBe(true);
      expect(result.data.email).toBe('a@b.com');
    });
  });

  describe('updateLabelCategories', () => {
    it('should reject missing label name', () => {
      const result = dashboardApi.updateLabelCategories('', ['work']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return success when categories are added', () => {
      const result = dashboardApi.updateLabelCategories('Work', ['work']);
      expect(result.success).toBe(true);
      expect(result.data.label).toBe('Work');
    });
  });

  describe('createGmailLabel', () => {
    it('should reject empty label name', () => {
      const result = dashboardApi.createGmailLabel('   ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should return success when label is created', () => {
      const result = dashboardApi.createGmailLabel('NewLabel');
      expect(result.success).toBe(true);
      expect(result.data.labelName).toBe('NewLabel');
    });
  });

  describe('saveRetentionRule', () => {
    it('should reject missing required fields', () => {
      const result = dashboardApi.saveRetentionRule({ labelName: 'Work' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return success with rule data', () => {
      const result = dashboardApi.saveRetentionRule({ labelName: 'Work', retentionDays: 30, action: 'archive' });
      expect(result.success).toBe(true);
      expect(result.data.labelName).toBe('Work');
    });
  });

  describe('deleteRetentionRule', () => {
    it('should reject missing label name', () => {
      const result = dashboardApi.deleteRetentionRule('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should return success when rule is deleted', () => {
      const result = dashboardApi.deleteRetentionRule('Work');
      expect(result.success).toBe(true);
      expect(result.data.labelName).toBe('Work');
    });
  });

  describe('executeRetentionRules', () => {
    it('should return execution summary', () => {
      const result = dashboardApi.executeRetentionRules();
      expect(result.success).toBe(true);
      expect(result.data.totalProcessed).toBe(0);
    });
  });

  describe('processBatchChanges', () => {
    it('should reject non-array input', () => {
      const result = dashboardApi.processBatchChanges(null);
      expect(result.success).toBe(false);
      expect(result.error).toContain('array');
    });

    it('should return success for valid array', () => {
      const result = dashboardApi.processBatchChanges([{ op: 'add' }]);
      expect(result.success).toBe(true);
      expect(result.data.processedCount).toBe(2);
    });
  });

  describe('getDashboardStatistics (port-routed Gmail)', () => {
    it('counts user labels via GmailAdapter.getAllLabels', () => {
      // GmailAdapter.getAllLabels reads getUserLabels and prepends system labels.
      global.CacheService.getScriptCache().removeAll([]);
      global.GmailApp.getUserLabels = jest.fn(() => [
        { getName: () => 'Work' },
        { getName: () => 'Personal' },
      ]);
      const stats = dashboardApi.getDashboardStatistics();
      // 2 user labels (system labels are type 'system', excluded from count)
      expect(stats.labels.total).toBe(2);
      expect(global.GmailApp.getUserLabels).toHaveBeenCalled();
    });
  });

  describe('getDashboardStatistics with populated data', () => {
    it('counts categorized emails, unique domains, and active retention rules', () => {
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Work' }]);
      global.UnifiedCacheService = {
        labelCategories: { getAll: jest.fn(() => ({ Work: ['work'], Personal: ['personal'] })) },
        emailCategories: { getAll: jest.fn(() => ({
          'a@x.com': 'work',
          'b@x.com': 'work',   // same domain x.com
          'c@y.com': 'personal'
        })) },
        retentionRules: { getAll: jest.fn(() => [
          { enabled: true }, { enabled: false }, { enabled: true }
        ]) }
      };
      serviceFactory.reset();
      const stats = dashboardApi.getDashboardStatistics();
      expect(stats.labels.withCategories).toBe(2);
      expect(stats.emails.categorized).toBe(3);
      expect(stats.emails.domains).toBe(2); // x.com, y.com
      expect(stats.retention.activeRules).toBe(2);
    });
  });

  describe('getLastRunTime (port-routed Properties + Utilities/Session)', () => {
    it('returns "Never" when no LAST_RUN property exists', () => {
      global.PropertiesService.getScriptProperties().deleteProperty('LAST_RUN_categorizeEmails');
      expect(dashboardApi.getLastRunTime('categorizeEmails')).toBe('Never');
    });

    it('formats the date via UtilitiesAdapter when property exists', () => {
      global.PropertiesService.getScriptProperties().setProperty(
        'LAST_RUN_categorizeEmails',
        '2026-01-01T10:00:00Z'
      );
      global.Utilities.formatDate = jest.fn(() => 'Jan 01, 10:00');
      global.Session = { getScriptTimeZone: jest.fn(() => 'GMT') };
      const result = dashboardApi.getLastRunTime('categorizeEmails');
      expect(result).toBe('Jan 01, 10:00');
      expect(global.Utilities.formatDate).toHaveBeenCalled();
      expect(global.Session.getScriptTimeZone).toHaveBeenCalled();
    });
  });

  describe('testEmailCategorization (port-routed Gemini)', () => {
    it('rejects missing email text', () => {
      const result = dashboardApi.testEmailCategorization('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('delegates to GeminiAdapter.call and returns categories', () => {
      global.callGeminiApi.mockReturnValue({ success: true, categories: ['work'], response: 'raw' });
      const result = dashboardApi.testEmailCategorization('some email');
      expect(global.callGeminiApi).toHaveBeenCalledWith(expect.any(String), 'test_categorization');
      expect(result.success).toBe(true);
      expect(result.categories).toEqual(['work']);
    });
  });

  describe('getEmailThreads (port-routed Gmail threads)', () => {
    it('rejects missing label name', () => {
      const result = dashboardApi.getEmailThreads('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('returns thread metadata via GmailAdapter', () => {
      const thread = {
        getMessages: () => [
          { getDate: () => new Date('2026-01-01'), getFrom: () => 'a@b.com', getAttachments: () => [] },
        ],
        getId: () => 't1',
        getFirstMessageSubject: () => 'Hello',
        isUnread: () => false,
        isImportant: () => false,
        getLabels: () => [],
      };
      const label = { getThreads: jest.fn(() => [thread]) };
      global.GmailApp.getUserLabelByName = jest.fn(() => label);

      const result = dashboardApi.getEmailThreads('Work', 10);
      expect(result.success).toBe(true);
      expect(result.data.threadCount).toBe(1);
      expect(result.data.threads[0].id).toBe('t1');
    });
  });

  describe('DashboardAPI export', () => {
    it('should expose all endpoint functions', () => {
      expect(typeof dashboardApi.DashboardAPI.getDashboardData).toBe('function');
      expect(typeof dashboardApi.DashboardAPI.updateEmailCategory).toBe('function');
      expect(typeof dashboardApi.DashboardAPI.createGmailLabel).toBe('function');
      expect(typeof dashboardApi.DashboardAPI.saveRetentionRule).toBe('function');
      expect(typeof dashboardApi.DashboardAPI.executeRetentionRules).toBe('function');
      expect(typeof dashboardApi.DashboardAPI.processBatchChanges).toBe('function');
    });
  });

  describe('doGet / include (HTML serving)', () => {
    it('doGet builds the dashboard template with title and frame options', () => {
      const tpl = {
        evaluate: jest.fn(() => tpl),
        setTitle: jest.fn(() => tpl),
        setXFrameOptionsMode: jest.fn(() => tpl)
      };
      global.HtmlService = {
        createTemplateFromFile: jest.fn(() => tpl),
        XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }
      };
      const out = dashboardApi.doGet({});
      expect(global.HtmlService.createTemplateFromFile)
        .toHaveBeenCalledWith('ui/dashboard-html/DashboardMain');
      expect(tpl.setTitle).toHaveBeenCalledWith('Email Tools Dashboard');
      expect(tpl.setXFrameOptionsMode).toHaveBeenCalledWith('ALLOWALL');
      expect(out).toBe(tpl);
    });

    it('include returns the named HTML partial content', () => {
      global.HtmlService = {
        createHtmlOutputFromFile: jest.fn(() => ({ getContent: () => '<div>partial</div>' }))
      };
      const content = dashboardApi.include('SomePartial');
      expect(global.HtmlService.createHtmlOutputFromFile)
        .toHaveBeenCalledWith('ui/dashboard-html/SomePartial');
      expect(content).toBe('<div>partial</div>');
    });
  });

  describe('error / catch branches for API endpoints', () => {
    it('updateEmailCategory returns an error when the update throws', () => {
      global.updateCategoryForEmail = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.updateEmailCategory('a@b.com', 'work');
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('updateLabelCategories returns an error when the add throws', () => {
      global.addCategoryToLabel = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.updateLabelCategories('Work', ['work']);
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('createGmailLabel returns an error when create throws', () => {
      global.createLabel = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.createGmailLabel('NewLabel');
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('saveRetentionRule returns an error when the update throws', () => {
      global.updateRetentionRule = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.saveRetentionRule({ labelName: 'W', retentionDays: 30, action: 'archive' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('deleteRetentionRule returns an error when the delete throws', () => {
      global.deleteRetentionRuleByLabel = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.deleteRetentionRule('Work');
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('executeRetentionRules returns an error when the run throws', () => {
      global.runAllRetentionRules = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.executeRetentionRules();
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('processBatchChanges returns an error when processing throws', () => {
      global.processBatchedChanges = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.processBatchChanges([{ op: 'x' }]);
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('saveApplicationSettings returns success and forwards the settings', () => {
      global.saveSettings = jest.fn(() => ({ success: true, message: 'saved' }));
      const settings = { theme: 'dark' };
      const result = dashboardApi.saveApplicationSettings(settings);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(settings);
    });

    it('saveApplicationSettings returns an error when saving throws', () => {
      global.saveSettings = jest.fn(() => { throw new Error('boom'); });
      const result = dashboardApi.saveApplicationSettings({ a: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('testEmailCategorization defaults categories to [] when the response omits them', () => {
      global.callGeminiApi = jest.fn(() => ({ success: true, response: 'raw' })); // no categories
      serviceFactory.reset();
      const result = dashboardApi.testEmailCategorization('email');
      expect(result.success).toBe(true);
      expect(result.categories).toEqual([]);
    });

    it('testEmailCategorization returns failure when the Gemini call fails', () => {
      global.callGeminiApi = jest.fn(() => ({ success: false, error: 'quota' }));
      serviceFactory.reset();
      const result = dashboardApi.testEmailCategorization('email');
      expect(result.success).toBe(false);
      expect(result.error).toBe('quota');
    });

    it('testEmailCategorization returns an error when the call throws (catch)', () => {
      global.callGeminiApi = jest.fn(() => { throw new Error('boom'); });
      serviceFactory.reset();
      const result = dashboardApi.testEmailCategorization('email');
      expect(result.success).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('getDashboardStatistics returns {} when the cache service throws (catch)', () => {
      // GmailAdapter.getAllLabels swallows Gmail errors (returns []), so drive the
      // catch via UnifiedCacheService instead.
      global.UnifiedCacheService.labelCategories.getAll = jest.fn(() => { throw new Error('cache down'); });
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Work' }]);
      serviceFactory.reset();
      const stats = dashboardApi.getDashboardStatistics();
      expect(stats).toEqual({});
    });

    it('getLastRunTime returns "Unknown" when the properties read throws (catch)', () => {
      global.PropertiesService.getScriptProperties = jest.fn(() => { throw new Error('props down'); });
      serviceFactory.reset();
      expect(dashboardApi.getLastRunTime('categorizeEmails')).toBe('Unknown');
    });
  });

  describe('getSystemStatus', () => {
    it('reports healthy api key + enabled triggers when all are scheduled', () => {
      global.verifyGeminiApiKey = jest.fn(() => ({ valid: true, message: 'ok' }));
      global.getLastRunTime = jest.fn(() => 'Jan 01');
      global.ScriptApp = {
        getProjectTriggers: jest.fn(() => [
          { getHandlerFunction: () => 'categorizeEmails' },
          { getHandlerFunction: () => 'runAllRetentionRules' },
          { getHandlerFunction: () => 'processJobEmailsMain' }
        ])
      };
      const status = dashboardApi.getSystemStatus();
      expect(status.apiKey.status).toBe('HEALTHY');
      expect(status.triggers.emailSorter.enabled).toBe(true);
      expect(status.triggers.retention.enabled).toBe(true);
      expect(status.triggers.jobFinder.enabled).toBe(true);
      expect(status.triggers.emailSorter.frequency).toBe('Every hour');
    });

    it('reports ERROR api key + not-scheduled triggers when none exist', () => {
      global.verifyGeminiApiKey = jest.fn(() => ({ valid: false, message: 'no key' }));
      global.ScriptApp = { getProjectTriggers: jest.fn(() => []) };
      const status = dashboardApi.getSystemStatus();
      expect(status.apiKey.status).toBe('ERROR');
      expect(status.triggers.emailSorter.enabled).toBe(false);
      expect(status.triggers.retention.frequency).toBe('Not scheduled');
      expect(status.triggers.jobFinder.frequency).toBe('Not scheduled');
    });

    it('returns an error object when status gathering throws (catch)', () => {
      global.verifyGeminiApiKey = jest.fn(() => { throw new Error('verify boom'); });
      const status = dashboardApi.getSystemStatus();
      expect(status.error).toContain('verify boom');
    });
  });

  describe('getDashboardData defensive defaults', () => {
    it('falls back to empty collections when the labels payload omits fields', () => {
      global.getAllLabelsAndCategories = jest.fn(() => ({})); // no labels/categories/etc.
      global.verifyGeminiApiKey = jest.fn(() => ({ valid: true, message: 'ok' }));
      global.ScriptApp = { getProjectTriggers: jest.fn(() => []) };
      global.getLastRunTime = jest.fn(() => 'Never');
      const result = dashboardApi.getDashboardData();
      expect(result.success).toBe(true);
      expect(result.data.labels).toEqual([]);
      expect(result.data.categories).toEqual({});
      expect(result.data.labelCategories).toEqual({});
      expect(result.data.retentionRules).toEqual([]);
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });
    it('resolves the GAS-global serviceFactory when present', () => {
      global.serviceFactory = serviceFactory;
      // Restore a clean cache service (a prior test poisoned getAll to throw).
      global.UnifiedCacheService = {
        labelCategories: { getAll: jest.fn(() => ({})) },
        emailCategories: { getAll: jest.fn(() => ({})) },
        retentionRules: { getAll: jest.fn(() => []) }
      };
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Work' }]);
      const stats = dashboardApi.getDashboardStatistics();
      expect(stats.labels.total).toBe(1);
    });
  });
});
