/**
 * Unit Tests for Email Categorization Module
 */

describe('Email Categorization Cache', () => {
  let originalData;

  beforeEach(() => {
    // Backup original data
    if (EMAIL_CATEGORIZER && EMAIL_CATEGORIZER.data) {
      originalData = JSON.parse(JSON.stringify(EMAIL_CATEGORIZER.data));
    }
  });

  afterEach(() => {
    // Restore original data
    if (originalData && EMAIL_CATEGORIZER) {
      EMAIL_CATEGORIZER.data = originalData;
    }
  });

  describe('getDefaultCacheStructure', () => {
    it('should return a valid cache structure', () => {
      const structure = getDefaultCacheStructure();

      expect.value(structure).toHaveProperty('version');
      expect.value(structure).toHaveProperty('categories');
      expect.value(structure).toHaveProperty('labelMappings');
    });

    it('should include default categories', () => {
      const structure = getDefaultCacheStructure();
      const categories = structure.categories;

      expect.value(categories).toHaveProperty('work');
      expect.value(categories).toHaveProperty('personal');
      expect.value(categories).toHaveProperty('finance');
      expect.value(categories).toHaveProperty('other');
    });

    it('should have empty arrays for domains and emails', () => {
      const structure = getDefaultCacheStructure();
      const workCategory = structure.categories.work;

      expect.value(workCategory.domains).toHaveLength(0);
      expect.value(workCategory.emails).toHaveLength(0);
    });
  });

  describe('getAllCategories', () => {
    it('should return all categories', () => {
      const categories = getAllCategories();

      expect.value(typeof categories).toBe('object');
      expect.value(categories).toBeTruthy();
    });

    it('should include category keys and display names', () => {
      const categories = getAllCategories();

      if (Object.keys(categories).length > 0) {
        const firstCategory = categories[Object.keys(categories)[0]];
        expect.value(firstCategory).toHaveProperty('displayName');
      }
    });
  });

  describe('addCategory', () => {
    it('should add a new category successfully', () => {
      const testKey = 'test_category_' + new Date().getTime();
      const result = addCategory(testKey, 'Test Category', 'TestLabel');

      expect.value(result).toHaveProperty('success', true);

      // Verify category was added
      const categories = getAllCategories();
      expect.value(categories).toHaveProperty(testKey);

      // Clean up
      deleteCategory(testKey);
    });

    it('should reject duplicate category keys', () => {
      const testKey = 'duplicate_test_' + new Date().getTime();

      // Add first time - should succeed
      addCategory(testKey, 'First', 'FirstLabel');

      // Add second time - should fail
      const result = addCategory(testKey, 'Second', 'SecondLabel');
      expect.value(result).toHaveProperty('success', false);

      // Clean up
      deleteCategory(testKey);
    });

    it('should create category with empty email and domain arrays', () => {
      const testKey = 'empty_arrays_test_' + new Date().getTime();
      addCategory(testKey, 'Empty Test', 'EmptyLabel');

      const items = getItemsForCategory(testKey);
      expect.value(items.emails).toHaveLength(0);
      expect.value(items.domains).toHaveLength(0);

      // Clean up
      deleteCategory(testKey);
    });
  });

  describe('deleteCategory', () => {
    it('should delete an existing category', () => {
      const testKey = 'delete_test_' + new Date().getTime();

      // Add category
      addCategory(testKey, 'Delete Test', 'DeleteLabel');

      // Delete it
      const result = deleteCategory(testKey);
      expect.value(result).toHaveProperty('success', true);

      // Verify it's gone
      const categories = getAllCategories();
      expect.value(categories.hasOwnProperty(testKey)).toBeFalsy();
    });

    it('should fail when deleting non-existent category', () => {
      const result = deleteCategory('non_existent_category_xyz');
      expect.value(result).toHaveProperty('success', false);
    });
  });

  describe('updateCategoryForEmail', () => {
    it('should assign an email to a category', () => {
      const testEmail = 'test@example.com';
      const testKey = 'email_test_' + new Date().getTime();

      // Add test category
      addCategory(testKey, 'Email Test', 'EmailLabel');

      // Assign email
      const result = updateCategoryForEmail(testEmail, testKey);
      expect.value(result).toHaveProperty('success', true);

      // Verify assignment
      const category = getCategoryForEmail(testEmail);
      expect.value(category).toBe(testKey);

      // Clean up
      removeCategoryFromEmail(testEmail);
      deleteCategory(testKey);
    });

    it('should move email from one category to another', () => {
      const testEmail = 'move@example.com';
      const category1 = 'move_test_1_' + new Date().getTime();
      const category2 = 'move_test_2_' + (new Date().getTime() + 1);

      // Add categories
      addCategory(category1, 'Move Test 1', 'MoveLabel1');
      addCategory(category2, 'Move Test 2', 'MoveLabel2');

      // Assign to first category
      updateCategoryForEmail(testEmail, category1);
      expect.value(getCategoryForEmail(testEmail)).toBe(category1);

      // Move to second category
      updateCategoryForEmail(testEmail, category2);
      expect.value(getCategoryForEmail(testEmail)).toBe(category2);

      // Verify not in first category
      const items1 = getItemsForCategory(category1);
      expect.value(items1.emails.includes(testEmail)).toBeFalsy();

      // Clean up
      removeCategoryFromEmail(testEmail);
      deleteCategory(category1);
      deleteCategory(category2);
    });
  });

  describe('updateCategoryForDomain', () => {
    it('should assign a domain to a category', () => {
      const testDomain = 'example.com';
      const testKey = 'domain_test_' + new Date().getTime();

      // Add test category
      addCategory(testKey, 'Domain Test', 'DomainLabel');

      // Assign domain
      const result = updateCategoryForDomain(testDomain, testKey);
      expect.value(result).toHaveProperty('success', true);

      // Verify assignment
      const category = getCategoryForDomain(testDomain);
      expect.value(category).toBe(testKey);

      // Clean up
      removeCategoryFromDomain(testDomain);
      deleteCategory(testKey);
    });
  });

  describe('getCategoryForEmail', () => {
    it('should return null for unassigned email', () => {
      const category = getCategoryForEmail('unassigned@example.com');
      expect.value(category).toBeNull();
    });

    it('should return correct category for assigned email', () => {
      const testEmail = 'assigned@example.com';
      const testKey = 'assigned_test_' + new Date().getTime();

      addCategory(testKey, 'Assigned Test', 'AssignedLabel');
      updateCategoryForEmail(testEmail, testKey);

      const category = getCategoryForEmail(testEmail);
      expect.value(category).toBe(testKey);

      // Clean up
      removeCategoryFromEmail(testEmail);
      deleteCategory(testKey);
    });
  });

  describe('getItemsForCategory', () => {
    it('should return emails and domains for a category', () => {
      const testKey = 'items_test_' + new Date().getTime();

      addCategory(testKey, 'Items Test', 'ItemsLabel');
      updateCategoryForEmail('test1@example.com', testKey);
      updateCategoryForDomain('example.org', testKey);

      const items = getItemsForCategory(testKey);
      expect.value(items).toHaveProperty('emails');
      expect.value(items).toHaveProperty('domains');
      expect.value(items.emails).toContain('test1@example.com');
      expect.value(items.domains).toContain('example.org');

      // Clean up
      removeCategoryFromEmail('test1@example.com');
      removeCategoryFromDomain('example.org');
      deleteCategory(testKey);
    });
  });

  describe('removeCategoryFromEmail', () => {
    it('should remove email assignment', () => {
      const testEmail = 'remove@example.com';
      const testKey = 'remove_test_' + new Date().getTime();

      addCategory(testKey, 'Remove Test', 'RemoveLabel');
      updateCategoryForEmail(testEmail, testKey);

      // Verify it's assigned
      expect.value(getCategoryForEmail(testEmail)).toBe(testKey);

      // Remove it
      const result = removeCategoryFromEmail(testEmail);
      expect.value(result).toHaveProperty('success', true);

      // Verify it's removed
      expect.value(getCategoryForEmail(testEmail)).toBeNull();

      // Clean up
      deleteCategory(testKey);
    });
  });
});

describe('Label-Category Mappings', () => {
  describe('getAllLabelCategories', () => {
    it('should return label mappings object', () => {
      const mappings = getAllLabelCategories();
      expect.value(typeof mappings).toBe('object');
    });
  });

  describe('addCategoryToLabel', () => {
    it('should map a category to a label', () => {
      const testLabel = 'TestLabel_' + new Date().getTime();
      const testKey = 'label_map_test_' + new Date().getTime();

      addCategory(testKey, 'Label Map Test', testLabel);

      const result = addCategoryToLabel(testLabel, testKey);
      expect.value(result).toHaveProperty('success', true);

      // Verify mapping
      const categories = getCategoriesForLabel(testLabel);
      expect.value(categories).toContain(testKey);

      // Clean up
      removeCategoryFromLabel(testLabel, testKey);
      deleteCategory(testKey);
    });
  });

  describe('removeCategoryFromLabel', () => {
    it('should remove category from label mapping', () => {
      const testLabel = 'RemoveLabel_' + new Date().getTime();
      const testKey = 'label_remove_test_' + new Date().getTime();

      addCategory(testKey, 'Label Remove Test', testLabel);
      addCategoryToLabel(testLabel, testKey);

      // Remove mapping
      const result = removeCategoryFromLabel(testLabel, testKey);
      expect.value(result).toHaveProperty('success', true);

      // Verify removal
      const categories = getCategoriesForLabel(testLabel);
      expect.value(categories.includes(testKey)).toBeFalsy();

      // Clean up
      deleteCategory(testKey);
    });
  });

  describe('getCategoriesForLabel', () => {
    it('should return empty array for unmapped label', () => {
      const categories = getCategoriesForLabel('NonExistentLabel_XYZ');
      expect.value(Array.isArray(categories)).toBeTruthy();
      expect.value(categories).toHaveLength(0);
    });
  });
});
