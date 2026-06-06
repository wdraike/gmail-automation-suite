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
});
