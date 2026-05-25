/**
 * Dashboard API Tests
 * Tests for src/ui/dashboard-api.js endpoints and helpers
 */

const dashboardApi = require('../src/ui/dashboard-api.js');

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
global.callGeminiApi = jest.fn(() => ({ success: true, categories: ['work'] }));
global.GmailService = {
  labels: { getAllLabels: jest.fn(() => [{ type: 'user', name: 'Work' }]) },
  threads: {
    getThreadsFromLabel: jest.fn(() => []),
    getThreadMetadata: jest.fn(() => ({ id: 't1', subject: 'Test' }))
  }
};
global.UnifiedCacheService = {
  labelCategories: { getAll: jest.fn(() => ({})) },
  emailCategories: { getAll: jest.fn(() => ({})) },
  retentionRules: { getAll: jest.fn(() => []) }
};

describe('Dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
