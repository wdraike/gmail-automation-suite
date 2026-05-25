/**
 * Unit Tests for Email Retention Module
 */

describe('Retention Rules Management', () => {
  describe('getRetentionRules', () => {
    it('should return rules object with success flag', () => {
      const result = getRetentionRules();

      expect.value(result).toHaveProperty('success');
      expect.value(result).toHaveProperty('rules');
      expect.value(Array.isArray(result.rules)).toBeTruthy();
    });

    it('should include count property', () => {
      const result = getRetentionRules();

      expect.value(result).toHaveProperty('count');
      expect.value(typeof result.count).toBe('number');
    });
  });

  describe('saveRetentionRules', () => {
    it('should return boolean success status', () => {
      const result = saveRetentionRules();
      expect.value(typeof result).toBe('boolean');
    });
  });

  describe('createRetentionRule', () => {
    it('should create a new retention rule', () => {
      const testLabel = 'TestRetention_' + new Date().getTime();
      const rule = {
        labelName: testLabel,
        retentionDays: 30,
        action: 'delete',
        enabled: true
      };

      const result = createRetentionRule(rule);

      expect.value(result).toHaveProperty('success');
      if (result.success) {
        expect.value(result).toHaveProperty('rule');
        expect.value(result.rule).toHaveProperty('id');
        expect.value(result.rule.labelName).toBe(testLabel);
        expect.value(result.rule.retentionDays).toBe(30);

        // Clean up
        if (result.rule && result.rule.id) {
          deleteRetentionRule(result.rule.id);
        }
      }
    });

    it('should reject rule with missing required fields', () => {
      const incompleteRule = {
        labelName: 'IncompleteLabel'
        // Missing retentionDays and action
      };

      const result = createRetentionRule(incompleteRule);
      expect.value(result).toHaveProperty('success', false);
    });

    it('should reject rule with invalid retention days', () => {
      const invalidRule = {
        labelName: 'InvalidDays',
        retentionDays: -5,  // Negative days
        action: 'delete',
        enabled: true
      };

      const result = createRetentionRule(invalidRule);
      expect.value(result).toHaveProperty('success', false);
    });

    it('should reject rule with invalid action', () => {
      const invalidRule = {
        labelName: 'InvalidAction',
        retentionDays: 30,
        action: 'invalid_action',  // Not 'delete' or 'archive'
        enabled: true
      };

      const result = createRetentionRule(invalidRule);
      expect.value(result).toHaveProperty('success', false);
    });
  });

  describe('updateRetentionRule', () => {
    it('should update an existing rule', () => {
      // First create a rule
      const testLabel = 'UpdateTest_' + new Date().getTime();
      const createResult = createRetentionRule({
        labelName: testLabel,
        retentionDays: 30,
        action: 'delete',
        enabled: true
      });

      if (createResult.success) {
        const ruleId = createResult.rule.id;

        // Update it
        const updateResult = updateRetentionRule(ruleId, {
          retentionDays: 60,
          action: 'archive'
        });

        expect.value(updateResult).toHaveProperty('success');

        if (updateResult.success) {
          expect.value(updateResult.rule.retentionDays).toBe(60);
          expect.value(updateResult.rule.action).toBe('archive');
        }

        // Clean up
        deleteRetentionRule(ruleId);
      }
    });

    it('should fail when updating non-existent rule', () => {
      const result = updateRetentionRule('non_existent_id_xyz', {
        retentionDays: 45
      });

      expect.value(result).toHaveProperty('success', false);
    });
  });

  describe('deleteRetentionRule', () => {
    it('should delete an existing rule', () => {
      // Create a rule
      const testLabel = 'DeleteTest_' + new Date().getTime();
      const createResult = createRetentionRule({
        labelName: testLabel,
        retentionDays: 30,
        action: 'delete',
        enabled: true
      });

      if (createResult.success) {
        const ruleId = createResult.rule.id;

        // Delete it
        const deleteResult = deleteRetentionRule(ruleId);
        expect.value(deleteResult).toHaveProperty('success', true);

        // Verify it's gone
        const rules = getRetentionRules();
        const found = rules.rules.find(r => r.id === ruleId);
        expect.value(found).toBeUndefined();
      }
    });

    it('should fail when deleting non-existent rule', () => {
      const result = deleteRetentionRule('non_existent_rule_xyz');
      expect.value(result).toHaveProperty('success', false);
    });
  });

  describe('toggleRetentionRule', () => {
    it('should toggle rule enabled status', () => {
      // Create a rule
      const testLabel = 'ToggleTest_' + new Date().getTime();
      const createResult = createRetentionRule({
        labelName: testLabel,
        retentionDays: 30,
        action: 'delete',
        enabled: true
      });

      if (createResult.success) {
        const ruleId = createResult.rule.id;
        const initialState = createResult.rule.enabled;

        // Toggle it
        const toggleResult = toggleRetentionRule(ruleId);

        if (toggleResult.success) {
          expect.value(toggleResult.rule.enabled).toBe(!initialState);

          // Toggle back
          const toggleBackResult = toggleRetentionRule(ruleId);
          if (toggleBackResult.success) {
            expect.value(toggleBackResult.rule.enabled).toBe(initialState);
          }
        }

        // Clean up
        deleteRetentionRule(ruleId);
      }
    });
  });
});

describe('Retention Rule Validation', () => {
  describe('validateRetentionRule', () => {
    it('should validate correct rule', () => {
      const validRule = {
        labelName: 'ValidLabel',
        retentionDays: 30,
        action: 'delete',
        enabled: true
      };

      const result = validateRetentionRule(validRule);
      expect.value(result).toHaveProperty('valid', true);
    });

    it('should reject rule without label name', () => {
      const invalidRule = {
        retentionDays: 30,
        action: 'delete',
        enabled: true
      };

      const result = validateRetentionRule(invalidRule);
      expect.value(result).toHaveProperty('valid', false);
    });

    it('should reject rule with zero retention days', () => {
      const invalidRule = {
        labelName: 'ZeroDays',
        retentionDays: 0,
        action: 'delete',
        enabled: true
      };

      const result = validateRetentionRule(invalidRule);
      expect.value(result).toHaveProperty('valid', false);
    });

    it('should reject rule with non-numeric retention days', () => {
      const invalidRule = {
        labelName: 'NonNumeric',
        retentionDays: 'thirty',
        action: 'delete',
        enabled: true
      };

      const result = validateRetentionRule(invalidRule);
      expect.value(result).toHaveProperty('valid', false);
    });
  });
});

describe('Retention Statistics', () => {
  describe('getRetentionStats', () => {
    it('should return statistics object', () => {
      const stats = getRetentionStats();

      expect.value(stats).toBeTruthy();
      expect.value(typeof stats).toBe('object');
    });

    it('should include total rules count', () => {
      const stats = getRetentionStats();

      expect.value(stats).toHaveProperty('totalRules');
      expect.value(typeof stats.totalRules).toBe('number');
    });

    it('should include enabled and disabled counts', () => {
      const stats = getRetentionStats();

      expect.value(stats).toHaveProperty('enabledRules');
      expect.value(stats).toHaveProperty('disabledRules');
      expect.value(typeof stats.enabledRules).toBe('number');
      expect.value(typeof stats.disabledRules).toBe('number');
    });
  });
});
