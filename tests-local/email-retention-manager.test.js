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
  setupRetentionTrigger,
  logRetentionActivity,
  getRetentionActivityLog
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

    it('should delete existing triggers first', () => {
      const mockTrigger = {
        getHandlerFunction: jest.fn(() => 'runAllRetentionRules'),
        getUniqueId: jest.fn(() => 'old-trigger')
      };

      global.ScriptApp.getProjectTriggers = jest.fn(() => [mockTrigger]);

      setupRetentionTrigger('daily', '03:00');

      expect(ScriptApp.deleteTrigger).toHaveBeenCalledWith(mockTrigger);
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
  });
});
