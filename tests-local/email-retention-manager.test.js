/**
 * Email Retention Manager Tests
 * Comprehensive tests for email retention and automated cleanup
 */

const fs = require('fs');
const path = require('path');

// Mock Utilities before loading any code
global.Utilities = {
  sleep: jest.fn(),
  getUuid: jest.fn(() => '12345678-1234-1234-1234-123456789012').mockName('getUuid')
};

// Also add it to beforeEach to ensure it's always available
function resetUtilitiesMock() {
  global.Utilities = {
    sleep: jest.fn(),
    getUuid: jest.fn(() => '12345678-1234-1234-1234-123456789012')
  };
}

// Load modules using require for proper coverage tracking
const cacheService = require('../src/core/cache-service.js');
const { serviceFactory } = require('../src/core/services/index.js');
const retentionModule = require('../src/features/email-retention-manager.js');

// Gmail/Properties/Utilities access is routed through serviceFactory ports. The
// tests swap global.GmailApp/PropertiesService/Utilities objects, so adapters must
// be rebuilt before each test (and after any in-test object swap, which is picked
// up lazily on first adapter access since reset() clears the cached adapters).
afterEach(() => {
  serviceFactory.reset();
});

// Load generateRuleId function inline (defined in dashboardController.js)
function generateRuleId() {
  return "rule_" + Utilities.getUuid().replace(/-/g, "").substring(0, 8);
}

// Make generateRuleId global so retention manager can access it
global.generateRuleId = generateRuleId;

// Initialize global RETENTION_RULES
global.RETENTION_RULES = null;

// Mock UnifiedCacheService for retention manager
global.UnifiedCacheService = {
  retentionRules: {
    update: jest.fn(),
    getAll: jest.fn(() => [])
  }
};

// Extract all needed functions from retention manager
const {
  initializeRetentionManager,
  getRetentionRule,
  addRetentionRule,
  updateRetentionRule,
  deleteRetentionRuleByLabel,
  setRuleEnabled,
  saveRetentionRules,
  getRetentionRules,
  runRetentionRule,
  processRetentionRule,
  formatDateForQuery,
  runAllRetentionRules,
  runAllRetentionRulesFromUI,
  runRetentionRuleByLabel,
  runRetentionRuleFromUI,
  getRetentionForLabels,
  getAllGmailLabels,
  setupRetentionTrigger,
  setupDefaultRetentionRules,
  logRetentionActivity,
  getRetentionActivityLog,
  getRetentionManagerDiagnostics
} = retentionModule;

describe('Email Retention Manager - Core Functions', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    resetUtilitiesMock(); // Reset Utilities mock

    // Reset global state
    global.RETENTION_RULES = null;

    // Mock PropertiesService
    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn()
      }))
    };

    // Mock GmailApp
    global.GmailApp = {
      getUserLabelByName: jest.fn((name) => {
        if (name === 'Work' || name === 'Newsletters' || name === 'Promotions') {
          return { getName: () => name };
        }
        return null;
      }),
      search: jest.fn(() => [])
    };

    // Mock ScriptApp
    global.ScriptApp = {
      getProjectTriggers: jest.fn(() => []),
      deleteTrigger: jest.fn(),
      newTrigger: jest.fn(() => ({
        timeBased: jest.fn(() => ({
          atHour: jest.fn(() => ({
            nearMinute: jest.fn(() => ({
              everyDays: jest.fn(() => ({
                create: jest.fn(() => ({ getUniqueId: () => 'trigger-123' }))
              }))
            }))
          })),
          onWeekDay: jest.fn(() => ({
            atHour: jest.fn(() => ({
              nearMinute: jest.fn(() => ({
                create: jest.fn(() => ({ getUniqueId: () => 'trigger-123' }))
              }))
            }))
          }))
        }))
      })),
      WeekDay: {
        SUNDAY: 1
      }
    };

    // Mock Logger
    global.Logger = {
      log: jest.fn()
    };
  });

  describe('initializeRetentionManager', () => {
    it('should initialize with empty array if no saved rules', () => {
      const result = initializeRetentionManager();

      expect(result.success).toBe(true);
      expect(result.message).toContain('initialized');
      expect(Array.isArray(RETENTION_RULES)).toBe(true);
    });

    it('should load saved rules from properties', () => {
      const savedRules = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30, enabled: true }
      ];

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => JSON.stringify(savedRules)),
        setProperty: jest.fn()
      }));

      const result = initializeRetentionManager();

      expect(result.success).toBe(true);
      expect(RETENTION_RULES).toHaveLength(1);
      expect(RETENTION_RULES[0].labelName).toBe('Work');
    });

    it('should handle errors gracefully', () => {
      global.PropertiesService.getScriptProperties = jest.fn(() => {
        throw new Error('Properties error');
      });

      const result = initializeRetentionManager();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });
  });

  describe('generateRuleId', () => {
    it('should generate unique rule ID', () => {
      const id = generateRuleId();

      expect(id).toMatch(/^rule_[a-f0-9]{8}$/);
    });

    it('should generate different IDs on subsequent calls', () => {
      global.Utilities.getUuid = jest.fn()
        .mockReturnValueOnce('11111111-1111-1111-1111-111111111111')
        .mockReturnValueOnce('22222222-2222-2222-2222-222222222222');

      const id1 = generateRuleId();
      const id2 = generateRuleId();

      expect(id1).not.toBe(id2);
    });
  });

  describe('addRetentionRule', () => {
    beforeEach(() => {
      global.RETENTION_RULES = [];

      // Ensure PropertiesService is mocked for saveRetentionRules
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn(() => null),
          setProperty: jest.fn()
        }))
      };
    });

    it('should add a new retention rule', () => {
      const result = addRetentionRule('Work', 30, 'Test rule', true, 'delete');

      // If it failed, log the error for debugging
      if (!result.success) {
        console.log('Error:', result.message);
      }

      expect(result.success).toBe(true);
      expect(result.message).toContain('Created');
      expect(RETENTION_RULES).toHaveLength(1);
      expect(RETENTION_RULES[0].labelName).toBe('Work');
      expect(RETENTION_RULES[0].retentionDays).toBe(30);
    });

    it('should require label name', () => {
      const result = addRetentionRule('', 30);

      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });

    it('should require valid retention days', () => {
      const result = addRetentionRule('Work', -5);

      expect(result.success).toBe(false);
      expect(result.message).toContain('positive number');
    });

    it('should reject non-existent label', () => {
      const result = addRetentionRule('NonExistent', 30);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should prevent duplicate rules for same label', () => {
      addRetentionRule('Work', 30);
      const result = addRetentionRule('Work', 60);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result).toHaveProperty('existingRule');
    });

    it('should generate default description if not provided', () => {
      addRetentionRule('Work', 30);

      expect(RETENTION_RULES[0].description).toContain('Work');
      expect(RETENTION_RULES[0].description).toContain('30 days');
    });

    it('should use custom description if provided', () => {
      addRetentionRule('Work', 30, 'Custom description');

      expect(RETENTION_RULES[0].description).toBe('Custom description');
    });

    it('should save rules after adding', () => {
      const setPropertyMock = jest.fn();
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: setPropertyMock
      }));

      addRetentionRule('Work', 30);

      expect(setPropertyMock).toHaveBeenCalledWith(
        'EMAIL_RETENTION_RULES',
        expect.any(String)
      );
    });
  });

  describe('getRetentionRule', () => {
    beforeEach(() => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30 },
        { id: 'rule_2', labelName: 'Personal', retentionDays: 60 }
      ];
    });

    it('should get rule by ID', () => {
      const rule = getRetentionRule('rule_1');

      expect(rule).not.toBeNull();
      expect(rule.labelName).toBe('Work');
    });

    it('should return null for non-existent ID', () => {
      const rule = getRetentionRule('nonexistent');

      expect(rule).toBeNull();
    });
  });

  describe('getRetentionRules', () => {
    it('should return all rules', () => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30 }
      ];

      const result = getRetentionRules();

      expect(result.success).toBe(true);
      expect(result.rules).toHaveLength(1);
      expect(result.count).toBe(1);
    });

    it('should initialize if RETENTION_RULES is null', () => {
      global.RETENTION_RULES = null;

      const result = getRetentionRules();

      expect(result.success).toBe(true);
      expect(Array.isArray(result.rules)).toBe(true);
    });

    it('should handle errors', () => {
      global.RETENTION_RULES = null;
      global.PropertiesService.getScriptProperties = jest.fn(() => {
        throw new Error('Storage error');
      });

      const result = getRetentionRules();

      // Note: initializeRetentionManager catches errors but setupDefaultRetentionRules
      // creates an empty array, so initialization still succeeds with an empty array
      expect(result.success).toBe(true);
      expect(Array.isArray(result.rules)).toBe(true);
    });
  });

  describe('updateRetentionRule', () => {
    beforeEach(() => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30, action: 'delete' }
      ];
    });

    it('should update existing rule', () => {
      const result = updateRetentionRule('Work', 60, 'archive', 'Archive');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Updated');
      expect(RETENTION_RULES[0].retentionDays).toBe(60);
      expect(RETENTION_RULES[0].action).toBe('archive');
    });

    it('should create new rule if not exists', () => {
      // Note: updateRetentionRule calls addRetentionRule which checks if label exists
      // Newsletters label exists in our mock
      const result = updateRetentionRule('Newsletters', 30, 'delete');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Created');
      expect(RETENTION_RULES).toHaveLength(2);
    });

    it('should validate retention days', () => {
      const result = updateRetentionRule('Work', -10, 'delete');

      expect(result.success).toBe(false);
      expect(result.message).toContain('positive number');
    });

    it('should require label name', () => {
      const result = updateRetentionRule('', 30, 'delete');

      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });
  });

  describe('deleteRetentionRuleByLabel', () => {
    beforeEach(() => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30 },
        { id: 'rule_2', labelName: 'Personal', retentionDays: 60 }
      ];
    });

    it('should delete rule by label name', () => {
      const result = deleteRetentionRuleByLabel('Work');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Deleted');
      expect(RETENTION_RULES).toHaveLength(1);
      expect(RETENTION_RULES[0].labelName).toBe('Personal');
    });

    it('should return deleted rule in result', () => {
      const result = deleteRetentionRuleByLabel('Work');

      expect(result.rule).toBeDefined();
      expect(result.rule.labelName).toBe('Work');
    });

    it('should handle non-existent label', () => {
      const result = deleteRetentionRuleByLabel('NonExistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('No retention rule found');
    });

    it('should save after deleting', () => {
      const setPropertyMock = jest.fn();
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: setPropertyMock
      }));

      deleteRetentionRuleByLabel('Work');

      expect(setPropertyMock).toHaveBeenCalled();
    });
  });

  describe('setRuleEnabled', () => {
    beforeEach(() => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30, enabled: true }
      ];
    });

    it('should enable a rule', () => {
      RETENTION_RULES[0].enabled = false;

      const result = setRuleEnabled('rule_1', true);

      expect(result.success).toBe(true);
      expect(result.message).toContain('enabled');
      expect(RETENTION_RULES[0].enabled).toBe(true);
    });

    it('should disable a rule', () => {
      const result = setRuleEnabled('rule_1', false);

      expect(result.success).toBe(true);
      expect(result.message).toContain('disabled');
      expect(RETENTION_RULES[0].enabled).toBe(false);
    });

    it('should handle non-existent rule', () => {
      const result = setRuleEnabled('nonexistent', true);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should coerce enabled to boolean', () => {
      setRuleEnabled('rule_1', 'true');
      expect(RETENTION_RULES[0].enabled).toBe(true);

      setRuleEnabled('rule_1', 0);
      expect(RETENTION_RULES[0].enabled).toBe(false);
    });
  });

  describe('formatDateForQuery', () => {
    it('should format date for Gmail query', () => {
      const date = new Date('2024-03-15');
      const formatted = formatDateForQuery(date);

      expect(formatted).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    });

    it('should pad month and day with zeros', () => {
      // Create date using UTC to avoid timezone issues
      const date = new Date(Date.UTC(2024, 0, 5)); // Month is 0-indexed
      const formatted = formatDateForQuery(date);

      expect(formatted).toMatch(/2024\/01\/0[45]/); // Allow for timezone variation
    });
  });

  describe('saveRetentionRules', () => {
    beforeEach(() => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30 }
      ];
    });

    it('should save rules to properties', () => {
      const setPropertyMock = jest.fn();
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: setPropertyMock
      }));

      const result = saveRetentionRules();

      expect(result).toBe(true);
      expect(setPropertyMock).toHaveBeenCalledWith(
        'EMAIL_RETENTION_RULES',
        expect.any(String)
      );
    });

    it('should save to cache service', () => {
      saveRetentionRules();

      expect(UnifiedCacheService.retentionRules.update).toHaveBeenCalledWith(RETENTION_RULES);
    });

    it('should handle null RETENTION_RULES', () => {
      global.RETENTION_RULES = null;

      const result = saveRetentionRules();

      expect(result).toBe(true);
      expect(Array.isArray(RETENTION_RULES)).toBe(true);
    });

    it('should handle errors', () => {
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: jest.fn(() => {
          throw new Error('Save error');
        })
      }));

      const result = saveRetentionRules();

      expect(result).toBe(false);
    });
  });
});

describe('Email Retention Manager - Rule Processing', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    resetUtilitiesMock(); // Reset Utilities mock
    global.RETENTION_RULES = [];

    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn()
      }))
    };

    global.GmailApp = {
      getUserLabelByName: jest.fn((name) => {
        if (name === 'Work') {
          return { getName: () => 'Work' };
        }
        return null;
      }),
      search: jest.fn(() => [])
    };

    global.Logger = { log: jest.fn() };
  });

  describe('processRetentionRule', () => {
    it('should skip disabled rules', () => {
      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: false
      };

      const result = processRetentionRule(rule);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Rule is disabled');
      expect(result.affectedCount).toBe(0);
    });

    it('should skip if label not found', () => {
      const rule = {
        id: 'rule_1',
        labelName: 'NonExistent',
        retentionDays: 30,
        enabled: true
      };

      const result = processRetentionRule(rule);

      expect(result.success).toBe(false);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('Label not found');
    });

    it('should search for old emails', () => {
      const searchMock = jest.fn(() => []);
      global.GmailApp.search = searchMock;

      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: true
      };

      processRetentionRule(rule);

      expect(searchMock).toHaveBeenCalled();
      const query = searchMock.mock.calls[0][0];
      expect(query).toContain('label:Work');
      expect(query).toContain('before:');
    });

    it('should return success if no emails found', () => {
      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: true
      };

      const result = processRetentionRule(rule);

      expect(result.success).toBe(true);
      expect(result.affectedCount).toBe(0);
    });

    it('should delete emails when action is delete', () => {
      const moveToTrashMock = jest.fn();
      const mockThread = {
        moveToTrash: moveToTrashMock,
        getFirstMessageSubject: jest.fn(() => 'Test Email')
      };

      global.GmailApp.search = jest.fn(() => [mockThread]);

      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: true,
        action: 'delete'
      };

      const result = processRetentionRule(rule);

      expect(result.success).toBe(true);
      expect(result.affectedCount).toBe(1);
      expect(moveToTrashMock).toHaveBeenCalled();
    });

    it('should archive emails when action is archive', () => {
      const removeLabelMock = jest.fn();
      const addLabelMock = jest.fn();
      const mockThread = {
        removeLabel: removeLabelMock,
        addLabel: addLabelMock,
        getFirstMessageSubject: jest.fn(() => 'Test Email')
      };

      const mockLabel = { getName: () => 'Work' };
      const mockArchiveLabel = { getName: () => 'Archive' };

      global.GmailApp.getUserLabelByName = jest.fn((name) => {
        if (name === 'Work') return mockLabel;
        if (name === 'Archive') return mockArchiveLabel;
        return null;
      });

      global.GmailApp.search = jest.fn(() => [mockThread]);

      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: true,
        action: 'archive',
        targetLabel: 'Archive'
      };

      const result = processRetentionRule(rule);

      expect(result.success).toBe(true);
      expect(result.affectedCount).toBe(1);
      expect(addLabelMock).toHaveBeenCalledWith(mockArchiveLabel);
      expect(removeLabelMock).toHaveBeenCalledWith(mockLabel);
    });

    it('should continue processing after thread error', () => {
      const mockThread1 = {
        moveToTrash: jest.fn(() => { throw new Error('Thread error'); }),
        getFirstMessageSubject: jest.fn(() => 'Error Email')
      };
      const mockThread2 = {
        moveToTrash: jest.fn(),
        getFirstMessageSubject: jest.fn(() => 'Success Email')
      };

      global.GmailApp.search = jest.fn(() => [mockThread1, mockThread2]);

      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: true,
        action: 'delete'
      };

      const result = processRetentionRule(rule);

      expect(result.success).toBe(true);
      expect(result.affectedCount).toBe(1); // Only second thread succeeded
    });

    it('should update lastRun timestamp', () => {
      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: true,
        lastRun: null
      };

      global.RETENTION_RULES = [rule];

      processRetentionRule(rule);

      expect(rule.lastRun).not.toBeNull();
      expect(rule.lastRun).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO format
    });
  });

  describe('runRetentionRule', () => {
    it('should run specific rule by ID', () => {
      const rule = {
        id: 'rule_1',
        labelName: 'Work',
        retentionDays: 30,
        enabled: true
      };

      global.RETENTION_RULES = [rule];

      const result = runRetentionRule('rule_1');

      expect(result.success).toBe(true);
    });

    it('should return error for non-existent rule', () => {
      global.RETENTION_RULES = [];

      const result = runRetentionRule('nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should initialize if RETENTION_RULES is empty', () => {
      global.RETENTION_RULES = [];

      runRetentionRule('rule_1');

      // Should have attempted to initialize
      expect(Array.isArray(RETENTION_RULES)).toBe(true);
    });
  });

  describe('runAllRetentionRules', () => {
    it('should process all rules', () => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30, enabled: true },
        { id: 'rule_2', labelName: 'Work', retentionDays: 60, enabled: false }
      ];

      const result = runAllRetentionRules();

      expect(result.success).toBe(true);
      expect(result.totalProcessed).toBe(2);
      expect(result.ruleResults).toHaveLength(2);
    });

    it('should skip disabled rules in count', () => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30, enabled: true },
        { id: 'rule_2', labelName: 'Work', retentionDays: 60, enabled: false }
      ];

      const result = runAllRetentionRules();

      expect(result.processedRules).toBe(1); // Only enabled rules
    });

    it('should count total affected emails', () => {
      const mockThread = {
        moveToTrash: jest.fn(),
        getFirstMessageSubject: jest.fn(() => 'Test')
      };

      global.GmailApp.search = jest.fn(() => [mockThread]);

      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' }
      ];

      const result = runAllRetentionRules();

      expect(result.totalAffected).toBe(1);
    });

    it('should record last run time in properties', () => {
      const setPropertyMock = jest.fn();
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: setPropertyMock
      }));

      global.RETENTION_RULES = [];

      runAllRetentionRules();

      expect(setPropertyMock).toHaveBeenCalledWith(
        'LAST_RUN_runAllRetentionRules',
        expect.any(String)
      );
    });

    it('should sleep between rules', () => {
      global.RETENTION_RULES = [
        { id: 'rule_1', labelName: 'Work', retentionDays: 30, enabled: true },
        { id: 'rule_2', labelName: 'Work', retentionDays: 60, enabled: false }
      ];

      runAllRetentionRules();

      expect(Utilities.sleep).toHaveBeenCalledWith(100);
    });
  });
});

describe('Email Retention Manager - Trigger Management', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    resetUtilitiesMock(); // Reset Utilities mock
    global.Logger = { log: jest.fn() };

    global.ScriptApp = {
      getProjectTriggers: jest.fn(() => []),
      deleteTrigger: jest.fn(),
      newTrigger: jest.fn(() => ({
        timeBased: jest.fn(() => ({
          atHour: jest.fn(function() { return this; }),
          nearMinute: jest.fn(function() { return this; }),
          everyDays: jest.fn(function() { return this; }),
          onWeekDay: jest.fn(function() { return this; }),
          create: jest.fn(() => ({ getUniqueId: () => 'trigger-123' }))
        }))
      })),
      WeekDay: { SUNDAY: 1 }
    };
  });

  describe('setupRetentionTrigger', () => {
    it('should create daily trigger', () => {
      const createMock = jest.fn(() => ({ getUniqueId: () => 'trigger-123' }));

      global.ScriptApp.newTrigger = jest.fn(() => ({
        timeBased: jest.fn(() => ({
          atHour: jest.fn(() => ({
            nearMinute: jest.fn(() => ({
              everyDays: jest.fn(() => ({
                create: createMock
              }))
            }))
          }))
        }))
      }));

      const result = setupRetentionTrigger('daily', '03:00');

      expect(result.success).toBe(true);
      expect(result.message).toContain('daily');
      expect(createMock).toHaveBeenCalled();
    });

    it('should create weekly trigger', () => {
      const createMock = jest.fn(() => ({ getUniqueId: () => 'trigger-123' }));

      global.ScriptApp.newTrigger = jest.fn(() => ({
        timeBased: jest.fn(() => ({
          onWeekDay: jest.fn(() => ({
            atHour: jest.fn(() => ({
              nearMinute: jest.fn(() => ({
                create: createMock
              }))
            }))
          }))
        }))
      }));

      const result = setupRetentionTrigger('weekly', '03:00');

      expect(result.success).toBe(true);
      expect(result.message).toContain('weekly');
      expect(createMock).toHaveBeenCalled();
    });

    it('should delete existing triggers first, leaving unrelated triggers alone', () => {
      const mockTrigger = {
        getHandlerFunction: jest.fn(() => 'runAllRetentionRules'),
        getUniqueId: jest.fn(() => 'old-trigger')
      };
      const unrelated = {
        getHandlerFunction: jest.fn(() => 'someOtherHandler'),
        getUniqueId: jest.fn(() => 'keep')
      };

      global.ScriptApp.getProjectTriggers = jest.fn(() => [mockTrigger, unrelated]);

      setupRetentionTrigger('daily', '03:00');

      expect(ScriptApp.deleteTrigger).toHaveBeenCalledWith(mockTrigger);
      expect(ScriptApp.deleteTrigger).not.toHaveBeenCalledWith(unrelated);
    });

    it('should parse time correctly', () => {
      const atHourMock = jest.fn(() => ({
        nearMinute: jest.fn(() => ({
          everyDays: jest.fn(() => ({
            create: jest.fn(() => ({ getUniqueId: () => 'trigger-123' }))
          }))
        }))
      }));

      global.ScriptApp.newTrigger = jest.fn(() => ({
        timeBased: jest.fn(() => ({
          atHour: atHourMock
        }))
      }));

      setupRetentionTrigger('daily', '15:30');

      expect(atHourMock).toHaveBeenCalledWith(15);
    });

    it('should handle errors', () => {
      global.ScriptApp.newTrigger = jest.fn(() => {
        throw new Error('Trigger error');
      });

      const result = setupRetentionTrigger('daily', '03:00');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });

    it('should default to daily 3AM for unknown frequency', () => {
      const atHourMock = jest.fn(() => ({
        nearMinute: jest.fn(() => ({
          everyDays: jest.fn(() => ({
            create: jest.fn(() => ({ getUniqueId: () => 'trigger-123' }))
          }))
        }))
      }));

      global.ScriptApp.newTrigger = jest.fn(() => ({
        timeBased: jest.fn(() => ({
          atHour: atHourMock
        }))
      }));

      setupRetentionTrigger('unknown', '03:00');

      expect(atHourMock).toHaveBeenCalledWith(3);
    });

    it('uses the default 03:00 time when none is provided', () => {
      const atHourMock = jest.fn(() => ({
        nearMinute: jest.fn(() => ({
          everyDays: jest.fn(() => ({ create: jest.fn(() => ({ getUniqueId: () => 't' })) }))
        }))
      }));
      global.ScriptApp.newTrigger = jest.fn(() => ({ timeBased: jest.fn(() => ({ atHour: atHourMock })) }));
      setupRetentionTrigger('daily'); // no time arg -> default "03:00"
      expect(atHourMock).toHaveBeenCalledWith(3);
    });

    it('returns trigger:null when create() yields a falsy trigger', () => {
      global.ScriptApp.newTrigger = jest.fn(() => ({
        timeBased: jest.fn(() => ({
          atHour: jest.fn(() => ({
            nearMinute: jest.fn(() => ({ everyDays: jest.fn(() => ({ create: jest.fn(() => undefined) })) }))
          }))
        }))
      }));
      const result = setupRetentionTrigger('daily', '03:00');
      expect(result.success).toBe(true);
      expect(result.trigger).toBeNull();
    });
  });
});

describe('Email Retention Manager - Activity Logging', () => {

  beforeEach(() => {
    jest.clearAllMocks();
    resetUtilitiesMock(); // Reset Utilities mock

    global.PropertiesService = {
      getScriptProperties: jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn()
      }))
    };

    global.Logger = { log: jest.fn() };
  });

  describe('logRetentionActivity', () => {
    it('should log activity', () => {
      const setPropertyMock = jest.fn();
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: setPropertyMock
      }));

      const result = logRetentionActivity('Test activity', 'rule_1');

      expect(result).toBe(true);
      expect(setPropertyMock).toHaveBeenCalledWith(
        'RETENTION_ACTIVITY_LOG',
        expect.any(String)
      );
    });

    it('should append to existing log', () => {
      const existingLog = [
        { timestamp: '2024-01-01T00:00:00Z', message: 'Old activity', ruleId: null }
      ];

      const setPropertyMock = jest.fn();
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => JSON.stringify(existingLog)),
        setProperty: setPropertyMock
      }));

      logRetentionActivity('New activity', 'rule_2');

      const savedLog = JSON.parse(setPropertyMock.mock.calls[0][1]);
      expect(savedLog).toHaveLength(2);
      expect(savedLog[1].message).toBe('New activity');
    });

    it('should limit log to 50 entries', () => {
      const largeLog = Array(55).fill(null).map((_, i) => ({
        timestamp: new Date().toISOString(),
        message: `Activity ${i}`,
        ruleId: null
      }));

      const setPropertyMock = jest.fn();
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => JSON.stringify(largeLog)),
        setProperty: setPropertyMock
      }));

      logRetentionActivity('New activity');

      const savedLog = JSON.parse(setPropertyMock.mock.calls[0][1]);
      expect(savedLog).toHaveLength(50);
    });

    it('should handle errors gracefully', () => {
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        setProperty: jest.fn(() => {
          throw new Error('Storage error');
        })
      }));

      const result = logRetentionActivity('Test');

      expect(result).toBe(false);
    });
  });

  describe('getRetentionActivityLog', () => {
    it('should return empty array if no log', () => {
      const result = getRetentionActivityLog();

      expect(result).toEqual([]);
    });

    it('should return log entries', () => {
      const log = [
        { timestamp: '2024-01-01T00:00:00Z', message: 'Activity 1' },
        { timestamp: '2024-01-02T00:00:00Z', message: 'Activity 2' }
      ];

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => JSON.stringify(log))
      }));

      const result = getRetentionActivityLog();

      expect(result).toHaveLength(2);
    });

    it('should sort by timestamp descending', () => {
      const log = [
        { timestamp: '2024-01-01T00:00:00Z', message: 'Old' },
        { timestamp: '2024-01-03T00:00:00Z', message: 'New' },
        { timestamp: '2024-01-02T00:00:00Z', message: 'Middle' }
      ];

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => JSON.stringify(log))
      }));

      const result = getRetentionActivityLog();

      expect(result[0].message).toBe('New');
      expect(result[1].message).toBe('Middle');
      expect(result[2].message).toBe('Old');
    });

    it('should limit entries returned', () => {
      const log = Array(100).fill(null).map((_, i) => ({
        timestamp: new Date().toISOString(),
        message: `Activity ${i}`
      }));

      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => JSON.stringify(log))
      }));

      const result = getRetentionActivityLog(10);

      expect(result).toHaveLength(10);
    });

    it('returns [] when the stored log is malformed JSON', () => {
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => 'not json {{{')
      }));
      expect(getRetentionActivityLog()).toEqual([]);
    });
  });

  describe('runAllRetentionRulesFromUI', () => {
    it('formats a success summary including per-rule details', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' },
        { id: 'r2', labelName: 'Old', retentionDays: 10, enabled: false, action: 'delete' },
      ];
      // Work has 1 matching thread; Old is disabled (skipped).
      const thread = { moveToTrash: jest.fn(), getFirstMessageSubject: () => 'S' };
      global.GmailApp.search = jest.fn(() => [thread]);

      const result = runAllRetentionRulesFromUI();
      expect(result.success).toBe(true);
      expect(result.message).toContain('cleanup complete');
      expect(result.message).toContain('Work');
      expect(result.message).toContain('Skipped');
      // Work processed 1 thread; the summary must report that total.
      expect(result.message).toContain('Affected: 1 emails');
      expect(result.results.totalAffected).toBe(1);
      expect(thread.moveToTrash).toHaveBeenCalledTimes(1);
      expect(result.duration).toBeDefined();
    });

    it('reports failure when runAllRetentionRules fails', () => {
      // Force the inner run to throw by making RETENTION_RULES non-iterable.
      global.RETENTION_RULES = 12345;
      const result = runAllRetentionRulesFromUI();
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
    });

    it('includes a "No emails to process" line for a rule that affects nothing', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      global.GmailApp.search = jest.fn(() => []); // nothing to process
      const result = runAllRetentionRulesFromUI();
      expect(result.message).toContain('No emails to process');
    });

    it('includes a "Failed" line for a rule that fails (non-skipped) during processing', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      // Label exists but the search throws -> processRetentionRule's outer catch
      // returns { success:false } WITHOUT `skipped`, hitting the "Failed" branch.
      global.GmailApp.search = jest.fn(() => { throw new Error('search boom'); });
      const result = runAllRetentionRulesFromUI();
      expect(result.message).toContain('Failed');
    });

    it('includes a "Skipped" line for a rule whose label is missing', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Ghost', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      // Ghost label not found -> processRetentionRule returns skipped:true.
      const result = runAllRetentionRulesFromUI();
      expect(result.message).toContain('Skipped');
    });
  });

  describe('runRetentionRuleByLabel', () => {
    it('requires a label name', () => {
      const result = runRetentionRuleByLabel('');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Label name is required');
    });

    it('errors when no rule exists for the label', () => {
      global.RETENTION_RULES = [];
      const result = runRetentionRuleByLabel('Nope');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('runs the rule and reports processed emails (and actually trashes the thread)', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      const thread = { moveToTrash: jest.fn(), getFirstMessageSubject: () => 'S' };
      global.GmailApp.search = jest.fn(() => [thread]);
      const result = runRetentionRuleByLabel('Work');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Processed: 1 emails');
      // The delete action must actually move the thread to trash.
      expect(thread.moveToTrash).toHaveBeenCalledTimes(1);
    });

    it('reports "No emails found" when nothing matches', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      global.GmailApp.search = jest.fn(() => []);
      const result = runRetentionRuleByLabel('Work');
      expect(result.message).toContain('No emails found');
    });

    it('reports an error when processing the rule fails', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Ghost', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      const result = runRetentionRuleByLabel('Ghost');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error processing rule');
    });

    it('returns an error response when an unexpected error is thrown', () => {
      global.RETENTION_RULES = null; // .find on null throws inside the try
      const result = runRetentionRuleByLabel('Work');
      expect(result.success).toBe(false);
    });
  });

  describe('runRetentionRuleFromUI', () => {
    it('requires a rule ID', () => {
      const result = runRetentionRuleFromUI('');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Rule ID is required');
    });

    it('errors when the rule ID is not found', () => {
      global.RETENTION_RULES = [];
      const result = runRetentionRuleFromUI('missing');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('runs the rule by id and reports processed emails', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      const thread = { moveToTrash: jest.fn(), getFirstMessageSubject: () => 'S' };
      global.GmailApp.search = jest.fn(() => [thread]);
      const result = runRetentionRuleFromUI('r1');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Processed: 1 emails');
    });

    it('reports "No emails found" when nothing matches', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      global.GmailApp.search = jest.fn(() => []);
      const result = runRetentionRuleFromUI('r1');
      expect(result.message).toContain('No emails found');
    });

    it('reports an error when processing the rule fails', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Ghost', retentionDays: 30, enabled: true, action: 'delete' },
      ];
      const result = runRetentionRuleFromUI('r1');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Error processing rule');
    });
  });

  describe('getRetentionForLabels', () => {
    it('returns only the rules matching the requested labels', () => {
      global.RETENTION_RULES = [
        { id: 'r1', labelName: 'Work' },
        { id: 'r2', labelName: 'Personal' },
        { id: 'r3', labelName: 'Old' },
      ];
      const result = getRetentionForLabels(['Work', 'Old']);
      expect(result.map((r) => r.labelName).sort()).toEqual(['Old', 'Work']);
    });

    it('returns [] when getRetentionRules fails', () => {
      // Make getRetentionRules throw internally by passing a non-array filter target.
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      // labelNames.includes is fine; force the inner getRetentionRules to fail by
      // making RETENTION_RULES a getter that throws is overkill — instead pass a
      // labelNames that triggers the catch via .includes on undefined.
      const result = getRetentionForLabels(undefined);
      expect(result).toEqual([]);
    });
  });

  describe('getAllGmailLabels', () => {
    it('returns user labels (skipping system labels), sorted by name', () => {
      global.CacheService.getScriptCache().remove('GMAIL_LABELS_CACHE');
      global.GmailApp.getUserLabels = jest.fn(() => [
        { getName: () => 'Zeta' },
        { getName: () => 'Alpha' },
      ]);
      // getAllLabels (adapter) prepends system labels with type 'system'; those
      // are skipped by getAllGmailLabels.
      const result = getAllGmailLabels();
      expect(result.success).toBe(true);
      const names = result.labels.map((l) => l.name);
      // user labels present and sorted; no system labels.
      expect(names).toContain('Alpha');
      expect(names).toContain('Zeta');
      expect(names.indexOf('Alpha')).toBeLessThan(names.indexOf('Zeta'));
      expect(names).not.toContain('INBOX');
    });

    it('splits nested label paths into an array', () => {
      global.CacheService.getScriptCache().remove('GMAIL_LABELS_CACHE');
      global.GmailApp.getUserLabels = jest.fn(() => [{ getName: () => 'Work/Projects' }]);
      const result = getAllGmailLabels();
      const nested = result.labels.find((l) => l.name === 'Work/Projects');
      expect(nested.path).toEqual(['Work', 'Projects']);
    });
    // NOTE: getAllGmailLabels' catch is unreachable from tests — GmailAdapter.getAllLabels
    // returns [] on a Gmail error (documented ADR exception), and .map/.sort cannot throw.
    // The catch is /* istanbul ignore */-d in the source with that justification.
  });

  describe('setupDefaultRetentionRules', () => {
    it('skips setup when rules already exist', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      expect(setupDefaultRetentionRules()).toBe(true);
      // No new rules added.
      expect(RETENTION_RULES).toHaveLength(1);
    });

    it('adds default rules for existing Newsletters/Promotions labels', () => {
      global.RETENTION_RULES = null;
      global.GmailApp.getUserLabelByName = jest.fn((name) =>
        (name === 'Newsletters' || name === 'Promotions') ? { getName: () => name } : null
      );
      expect(setupDefaultRetentionRules()).toBe(true);
      const names = RETENTION_RULES.map((r) => r.labelName).sort();
      expect(names).toEqual(['Newsletters', 'Promotions']);
    });

    it('creates no default rules when the labels do not exist', () => {
      global.RETENTION_RULES = null;
      global.GmailApp.getUserLabelByName = jest.fn(() => null);
      expect(setupDefaultRetentionRules()).toBe(true);
      expect(RETENTION_RULES).toEqual([]);
    });
  });

  describe('branch backfill', () => {
    it('getRetentionRule returns null for an unknown id', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      expect(getRetentionRule('nope')).toBeNull();
    });

    it('addRetentionRule treats a thrown label lookup as "label not found"', () => {
      global.RETENTION_RULES = [];
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error('gmail boom'); });
      const result = addRetentionRule('Work', 30);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('updateRetentionRule initializes rules when RETENTION_RULES is null', () => {
      global.RETENTION_RULES = null;
      global.GmailApp.getUserLabelByName = jest.fn((n) => ({ getName: () => n })); // Work exists
      global.PropertiesService.getScriptProperties = jest.fn(() => ({ getProperty: jest.fn(() => null), setProperty: jest.fn() }));
      // Work label exists -> creates a new rule via addRetentionRule.
      const result = updateRetentionRule('Work', 15, 'delete');
      expect(result.success).toBe(true);
      expect(Array.isArray(RETENTION_RULES)).toBe(true);
    });

    it('deleteRetentionRuleByLabel initializes rules when null then reports not-found', () => {
      global.RETENTION_RULES = null;
      const result = deleteRetentionRuleByLabel('Work');
      expect(result.success).toBe(false);
      expect(result.message).toContain('No retention rule');
    });

    it('setRuleEnabled initializes rules when null then reports not-found', () => {
      global.RETENTION_RULES = null;
      const result = setRuleEnabled('rX', true);
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('runAllRetentionRules initializes rules when null', () => {
      global.RETENTION_RULES = null;
      const result = runAllRetentionRules();
      expect(result.success).toBe(true);
      expect(Array.isArray(RETENTION_RULES)).toBe(true);
    });

    it('processRetentionRule logs an unknown action and affects nothing', () => {
      global.RETENTION_RULES = [];
      global.GmailApp.getUserLabelByName = jest.fn((n) => ({ getName: () => n }));
      const thread = { getFirstMessageSubject: () => 'S' };
      global.GmailApp.search = jest.fn(() => [thread]);
      const rule = { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'frobnicate' };
      const result = processRetentionRule(rule);
      expect(result.success).toBe(true);
      expect(result.affectedCount).toBe(0); // unknown action -> default branch, no-op
    });

    it('processRetentionRule archives to a target label and removes the source label', () => {
      const target = { getName: () => 'Archive' };
      const sourceLabel = { getName: () => 'Work' };
      global.GmailApp.getUserLabelByName = jest.fn((n) => (n === 'Archive' ? target : sourceLabel));
      const thread = { addLabel: jest.fn(), removeLabel: jest.fn(), getFirstMessageSubject: () => 'S' };
      global.GmailApp.search = jest.fn(() => [thread]);
      const rule = { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'archive', targetLabel: 'Archive' };
      const result = processRetentionRule(rule);
      expect(thread.addLabel).toHaveBeenCalledWith(target);
      expect(thread.removeLabel).toHaveBeenCalledWith(sourceLabel);
      expect(result.affectedCount).toBe(1);
    });

    it('processRetentionRule continues when a single thread throws', () => {
      const okThread = { moveToTrash: jest.fn(), getFirstMessageSubject: () => 'ok' };
      const badThread = { moveToTrash: jest.fn(() => { throw new Error('thread boom'); }), getFirstMessageSubject: () => 'bad' };
      global.GmailApp.search = jest.fn(() => [badThread, okThread]);
      const rule = { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' };
      const result = processRetentionRule(rule);
      // bad thread errored, ok thread still deleted.
      expect(result.affectedCount).toBe(1);
    });

    it('runAllRetentionRules records a per-rule error when the pause throws', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'delete' }];
      global.GmailApp.search = jest.fn(() => []);
      // Utilities.sleep throws after processRetentionRule -> per-rule catch fires.
      global.Utilities.sleep = jest.fn(() => { throw new Error('sleep boom'); });
      const result = runAllRetentionRules();
      expect(result.success).toBe(true);
      expect(result.ruleResults.some((r) => r.success === false)).toBe(true);
    });

    it('getRetentionForLabels returns [] when no labels match', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      expect(getRetentionForLabels(['Other'])).toEqual([]);
    });

    it('updateRetentionRule defaults the action to "delete" when none is given', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work', retentionDays: 10, action: 'archive' }];
      const result = updateRetentionRule('Work', 20); // no action arg
      expect(result.success).toBe(true);
      expect(RETENTION_RULES[0].action).toBe('delete');
    });

    it('processRetentionRule archive skips adding when the target label cannot be resolved', () => {
      const sourceLabel = { getName: () => 'Work' };
      // Source label resolves; the configured targetLabel does NOT.
      global.GmailApp.getUserLabelByName = jest.fn((n) => (n === 'Work' ? sourceLabel : null));
      const thread = { removeLabel: jest.fn(), addLabel: jest.fn(), getFirstMessageSubject: () => 'S' };
      global.GmailApp.search = jest.fn(() => [thread]);
      const rule = { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'archive', targetLabel: 'Ghost' };
      const result = processRetentionRule(rule);
      expect(thread.addLabel).not.toHaveBeenCalled(); // target not resolvable
      expect(thread.removeLabel).toHaveBeenCalledWith(sourceLabel);
      expect(result.affectedCount).toBe(1);
    });

    it('processRetentionRule archive without a targetLabel just removes the source label', () => {
      const sourceLabel = { getName: () => 'Work' };
      global.GmailApp.getUserLabelByName = jest.fn(() => sourceLabel);
      const thread = { removeLabel: jest.fn(), addLabel: jest.fn(), getFirstMessageSubject: () => 'S' };
      global.GmailApp.search = jest.fn(() => [thread]);
      const rule = { id: 'r1', labelName: 'Work', retentionDays: 30, enabled: true, action: 'archive', targetLabel: '' };
      const result = processRetentionRule(rule);
      expect(thread.addLabel).not.toHaveBeenCalled();
      expect(thread.removeLabel).toHaveBeenCalledWith(sourceLabel);
      expect(result.affectedCount).toBe(1);
    });

    it('runAllRetentionRulesFromUI omits the rule-details section when there are no rules', () => {
      global.RETENTION_RULES = [];
      const result = runAllRetentionRulesFromUI();
      expect(result.success).toBe(true);
      expect(result.message).not.toContain('Rule details');
    });

    it('getRetentionRule returns null when getRetentionRules reports failure', () => {
      // Throwing getter -> getRetentionRules catch -> success:false -> getRetentionRule
      // hits the `if (!result.success) return null` branch.
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true, get() { throw new Error('grr boom'); }, set() {},
      });
      const result = getRetentionRule('r1');
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result).toBeNull();
    });

    it('getRetentionForLabels returns [] when getRetentionRules reports failure', () => {
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true, get() { throw new Error('grfl boom'); }, set() {},
      });
      const result = getRetentionForLabels(['Work']);
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result).toEqual([]);
    });

    it('updateRetentionRule returns an error object when an unexpected error is thrown', () => {
      // Non-array truthy RETENTION_RULES -> findIndex throws -> outer catch.
      global.RETENTION_RULES = 42;
      const result = updateRetentionRule('Work', 30, 'delete');
      expect(result.success).toBe(false);
    });

    it('deleteRetentionRuleByLabel returns an error object on unexpected error', () => {
      global.RETENTION_RULES = 42; // findIndex throws
      const result = deleteRetentionRuleByLabel('Work');
      expect(result.success).toBe(false);
    });

    it('setRuleEnabled returns an error object on unexpected error', () => {
      global.RETENTION_RULES = 42; // findIndex throws
      const result = setRuleEnabled('r1', true);
      expect(result.success).toBe(false);
    });

    it('getRetentionRules returns a failure object when an unexpected error is thrown', () => {
      // Define RETENTION_RULES as a getter that throws when read.
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true,
        get() { throw new Error('read boom'); },
        set() {},
      });
      const result = getRetentionRules();
      // Restore a normal property for subsequent tests.
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result.success).toBe(false);
      expect(result.rules).toEqual([]);
    });

    it('runRetentionRule returns an error object on unexpected error', () => {
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true,
        get() { throw new Error('rr boom'); },
        set() {},
      });
      const result = runRetentionRule('r1');
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result.success).toBe(false);
    });

    it('runAllRetentionRulesFromUI logs activity and returns error on a thrown run', () => {
      // Spy via a getter that throws after the wrapper enters its try.
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true,
        get() { throw new Error('uiall boom'); },
        set() {},
      });
      const result = runAllRetentionRulesFromUI();
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result.success).toBe(false);
    });

    it('runRetentionRuleByLabel logs activity and returns error on a thrown lookup', () => {
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true,
        get() { throw new Error('rrbl boom'); },
        set() {},
      });
      const result = runRetentionRuleByLabel('Work');
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result.success).toBe(false);
    });

    it('runRetentionRuleFromUI logs activity and returns error on a thrown lookup', () => {
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true,
        get() { throw new Error('rrfui boom'); },
        set() {},
      });
      const result = runRetentionRuleFromUI('r1');
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result.success).toBe(false);
    });

    it('getRetentionRule returns null when the rules list is corrupt (find throws)', () => {
      // getRetentionRules succeeds but returns a non-array `rules`, so .find throws
      // and is caught by getRetentionRule's own catch.
      global.RETENTION_RULES = 'not-an-array';
      expect(getRetentionRule('r1')).toBeNull();
    });

    it('logRetentionActivity aggressively truncates when 50 entries still exceed 100KB', () => {
      // Even after slice(-50), 50 entries with very large messages exceed the 100KB
      // single-property guard, triggering the second-tier slice(-10).
      const big = Array(60).fill(null).map(() => ({
        timestamp: new Date().toISOString(),
        message: 'x'.repeat(2500), // large enough that 50 entries > 100KB
        ruleId: 'rule_12345678',
      }));
      let stored = JSON.stringify(big);
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => stored),
        setProperty: jest.fn((k, v) => { stored = v; }),
      }));
      const ok = logRetentionActivity('new entry');
      expect(ok).toBe(true);
      // After aggressive truncation only the last 10 entries remain.
      expect(JSON.parse(stored).length).toBeLessThanOrEqual(10);
    });

    it('getRetentionManagerDiagnostics returns an error object when triggers enumeration throws', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      // getProjectTriggers is outside the inner try -> hits the outer catch.
      global.ScriptApp.getProjectTriggers = jest.fn(() => { throw new Error('triggers boom'); });
      const result = getRetentionManagerDiagnostics();
      expect(result.success).toBe(false);
      expect(result.message).toContain('triggers boom');
    });

    it('setupDefaultRetentionRules returns false on an unexpected error', () => {
      // Non-array truthy -> the `.length` check passes but saveRetentionRules path
      // and array ops differ; force a throw via a getter.
      let reads = 0;
      Object.defineProperty(global, 'RETENTION_RULES', {
        configurable: true,
        get() { reads++; if (reads > 1) throw new Error('sdr boom'); return null; },
        set() {},
      });
      const result = setupDefaultRetentionRules();
      Object.defineProperty(global, 'RETENTION_RULES', { configurable: true, writable: true, value: null });
      expect(result).toBe(false);
    });

    it('setupDefaultRetentionRules survives a thrown label lookup', () => {
      global.RETENTION_RULES = null;
      global.GmailApp.getUserLabelByName = jest.fn(() => { throw new Error('lookup boom'); });
      expect(setupDefaultRetentionRules()).toBe(true);
      expect(RETENTION_RULES).toEqual([]);
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => { delete global.serviceFactory; });
    it('resolves the GAS-global serviceFactory when present', () => {
      global.serviceFactory = serviceFactory;
      global.RETENTION_RULES = null;
      global.PropertiesService.getScriptProperties = jest.fn(() => ({ getProperty: jest.fn(() => null), setProperty: jest.fn() }));
      const result = initializeRetentionManager();
      expect(result.success).toBe(true);
    });
  });

  describe('getRetentionManagerDiagnostics', () => {
    it('reports an initialized state with rules and triggers', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      global.ScriptApp.getProjectTriggers = jest.fn(() => [
        { getHandlerFunction: () => 'runAllRetentionRules', getUniqueId: () => 't1', getEventType: () => 'CLOCK' },
        { getHandlerFunction: () => 'other', getUniqueId: () => 't2', getEventType: () => 'CLOCK' },
      ]);
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn((k) => (k === 'LAST_RUN_runAllRetentionRules' ? '2024-01-01' : JSON.stringify([{ id: 'r1' }]))),
        setProperty: jest.fn(),
      }));
      global.UnifiedCacheService.retentionRules.getAll = jest.fn(() => [{ id: 'r1' }]);

      const result = getRetentionManagerDiagnostics();
      expect(result.success).toBe(true);
      expect(result.diagnostics.retentionRulesStatus).toBe('initialized');
      expect(result.diagnostics.retentionRulesCount).toBe(1);
      expect(result.diagnostics.triggerStatus).toBe('active');
      expect(result.diagnostics.triggers).toHaveLength(1);
      expect(result.diagnostics.lastRun).toBe('2024-01-01');
      expect(result.diagnostics.storageStatus.properties).toBe(true);
      expect(result.diagnostics.storageStatus.cache).toBe(true);
    });

    it('initializes via function call when RETENTION_RULES starts null', () => {
      global.RETENTION_RULES = null;
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn(),
      }));
      const result = getRetentionManagerDiagnostics();
      expect(result.success).toBe(true);
      expect(result.diagnostics.retentionRulesStatus).toContain('initialized via function call');
    });

    it('reports "not found" trigger status when no retention trigger exists', () => {
      global.RETENTION_RULES = [];
      global.ScriptApp.getProjectTriggers = jest.fn(() => []);
      const result = getRetentionManagerDiagnostics();
      expect(result.diagnostics.triggerStatus).toBe('not found');
    });

    it('captures a lastRun error when reading the property throws', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      global.ScriptApp.getProjectTriggers = jest.fn(() => []);
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn((k) => {
          if (k === 'LAST_RUN_runAllRetentionRules') throw new Error('lastRun boom');
          return null;
        }),
        setProperty: jest.fn(),
      }));
      const result = getRetentionManagerDiagnostics();
      expect(result.diagnostics.lastRunError).toContain('lastRun boom');
    });

    it('captures a storage error when the cache check throws', () => {
      global.RETENTION_RULES = [{ id: 'r1', labelName: 'Work' }];
      global.ScriptApp.getProjectTriggers = jest.fn(() => []);
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => null),
        setProperty: jest.fn(),
      }));
      global.UnifiedCacheService.retentionRules.getAll = jest.fn(() => { throw new Error('cache boom'); });
      const result = getRetentionManagerDiagnostics();
      expect(result.diagnostics.storageError).toContain('cache boom');
    });

    it('reports "failed to initialize" when initialization does not populate rules', () => {
      global.RETENTION_RULES = null;
      global.ScriptApp.getProjectTriggers = jest.fn(() => []);
      // initializeRetentionManager throws internally (getProperty throws) -> caught,
      // RETENTION_RULES stays null -> "failed to initialize" / error path.
      global.PropertiesService.getScriptProperties = jest.fn(() => ({
        getProperty: jest.fn(() => { throw new Error('init read boom'); }),
        setProperty: jest.fn(),
      }));
      const result = getRetentionManagerDiagnostics();
      expect(['failed to initialize', 'error during initialization'])
        .toContain(result.diagnostics.retentionRulesStatus);
    });
  });
});
