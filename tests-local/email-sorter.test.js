/**
 * Email Sorter Tests
 * Comprehensive tests for email categorization and sorting.
 *
 * Platform access (Gmail, Properties) is routed through serviceFactory ports; the
 * real adapters delegate to the global SDK mocks in setup.js. The domain helpers
 * (getAllCategories, getCategoryForEmail, addCategory, ...) and config constants
 * are concatenated GAS globals, so they are stubbed on `global` here.
 */

const {
  extractCategoryFromResponse,
  cleanLabelName,
  sanitizeCategoryName,
  buildGeminiPrompt,
  queryGeminiForCategory,
  checkLockBeforeProcessing,
  setupEmailSorterTrigger,
  categorizeEmails,
  moveEmailToFolder,
  createNewCategory,
  setupEmailSorter,
  toggleDynamicCategories
} = require('../src/features/email-sorter/sorter.js');

const { serviceFactory } = require('../src/core/services/index.js');

// Domain-layer + config globals the sorter resolves from the concatenated scope.
global.callGeminiWithRateLimiting = jest.fn();
global.getCategoryForEmail = jest.fn();
global.getCategoryForDomain = jest.fn();
global.updateCategoryForEmail = jest.fn();
global.updateCategoryForDomain = jest.fn();
global.isDynamicCategoriesEnabled = jest.fn(() => false);
global.setDynamicCategoriesEnabled = jest.fn();
global.addCategory = jest.fn(() => ({ success: true }));
global.initializeCategorizerCache = jest.fn();
global.EMAIL_SORTER_CONFIG = {
  CHECK_INTERVAL_MINUTES: 5,
  MAX_GEMINI_CALLS_PER_MINUTE: 10,
  ENABLE_DYNAMIC_CATEGORIES: true
};

const DEFAULT_CATEGORIES = {
  work: 'Work',
  finance: { label: 'Finance' },
  shopping: {},
  other: 'Other'
};
global.getAllCategories = jest.fn(() => ({ ...DEFAULT_CATEGORIES }));

/** Build a fake Gmail thread whose latest message has the given from/subject. */
function makeThread({ unread = true, msgUnread = true, from = 'Acme <jobs@acme.com>', subject = 'Hello' } = {}) {
  const message = {
    isUnread: jest.fn(() => msgUnread),
    getFrom: jest.fn(() => from),
    getSubject: jest.fn(() => subject)
  };
  return {
    isUnread: jest.fn(() => unread),
    getMessages: jest.fn(() => [message]),
    moveToArchive: jest.fn(),
    _message: message
  };
}

describe('Email Sorter - Complete Test Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serviceFactory.reset();
    global.getAllCategories.mockImplementation(() => ({ ...DEFAULT_CATEGORIES }));
    global.isDynamicCategoriesEnabled.mockImplementation(() => false);
    global.addCategory.mockImplementation(() => ({ success: true }));
    global.initializeCategorizerCache.mockImplementation(() => {});
    global.callGeminiWithRateLimiting.mockReset();
    delete global.API_MONITOR;
  });

  describe('extractCategoryFromResponse', () => {
    it('should extract category from clean JSON', () => {
      expect(extractCategoryFromResponse('{"category":"work"}')).toBe('work');
    });

    it('should strip markdown code fences before parsing', () => {
      expect(extractCategoryFromResponse('```json\n{"category":"finance"}\n```')).toBe('finance');
    });

    it('should trim surrounding whitespace', () => {
      expect(extractCategoryFromResponse('  {"category":"shopping"}  ')).toBe('shopping');
    });

    it('should fall back to regex extraction when JSON.parse fails', () => {
      // Not valid JSON, but the "category":"x" regex pattern matches.
      const result = extractCategoryFromResponse('garbage before "category": "work" garbage after');
      expect(result).toBe('work');
    });

    it('should match a bare category name appearing as a word (method 3)', () => {
      // No JSON, no "category:" token — only the literal word "finance" present.
      const result = extractCategoryFromResponse('I think this belongs to finance honestly');
      expect(result).toBe('finance');
    });

    it('should return "other" when nothing matches', () => {
      expect(extractCategoryFromResponse('completely unrelated text zzz')).toBe('other');
    });

    it('should return "other" for missing category field', () => {
      expect(extractCategoryFromResponse('{"result":"no category here"}')).toBe('other');
    });

    it('should normalize category to lowercase via sanitize', () => {
      expect(extractCategoryFromResponse('{"category":"WORK"}')).toBe('work');
    });

    it('should return "other" and not throw on a null response', () => {
      expect(extractCategoryFromResponse(null)).toBe('other');
    });
  });

  describe('cleanLabelName', () => {
    it('returns "Other" for falsy input', () => {
      expect(cleanLabelName('')).toBe('Other');
      expect(cleanLabelName(null)).toBe('Other');
    });

    it('strips illegal characters but keeps slashes', () => {
      expect(cleanLabelName('Lab(el){a}%b*"c\\d/e')).toBe('Labelabcd/e');
    });

    it('trims leading/trailing dots, spaces and slashes', () => {
      expect(cleanLabelName('  ./Work/. ')).toBe('Work');
    });

    it('returns "Other" when cleaning yields an empty string', () => {
      expect(cleanLabelName('()%*"')).toBe('Other');
    });

    it('truncates names longer than 40 characters', () => {
      const long = 'a'.repeat(60);
      expect(cleanLabelName(long)).toHaveLength(40);
    });

    it('coerces non-string input to string', () => {
      expect(cleanLabelName(12345)).toBe('12345');
    });
  });

  describe('sanitizeCategoryName', () => {
    it('returns "other" for falsy input', () => {
      expect(sanitizeCategoryName('')).toBe('other');
      expect(sanitizeCategoryName(null)).toBe('other');
    });

    it('lowercases and replaces special chars with underscores, collapsing runs', () => {
      expect(sanitizeCategoryName('Work   Items!!')).toBe('work_items');
    });

    it('strips leading/trailing underscores', () => {
      expect(sanitizeCategoryName('__hi__')).toBe('hi');
    });

    it('returns "other" when result is empty or just an underscore', () => {
      expect(sanitizeCategoryName('!!!')).toBe('other');
    });

    it('truncates to 20 chars without a trailing underscore', () => {
      const result = sanitizeCategoryName('abcdefghijklmnopqrs_tuvwxyz');
      expect(result.length).toBeLessThanOrEqual(20);
      expect(result.endsWith('_')).toBe(false);
    });
  });

  describe('buildGeminiPrompt', () => {
    it('embeds the email fields and omits "other" from the category list', () => {
      const result = buildGeminiPrompt('test@example.com', 'example.com', 'Test Subject');
      expect(result).toContain('test@example.com');
      expect(result).toContain('example.com');
      expect(result).toContain('Test Subject');
      expect(result).toContain('TASK:');
      // "other" is filtered out of the offered list.
      expect(result).toMatch(/work, finance, shopping/);
    });
  });

  describe('queryGeminiForCategory', () => {
    it('returns the extracted category when Gemini responds with valid JSON', () => {
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"finance"}');
      const result = queryGeminiForCategory('a@b.com', 'b.com', 'Subj');
      expect(result).toEqual({ category: 'finance', explanation: 'Category determined by Gemini' });
    });

    it('returns the "other" fallback when extraction yields nothing usable', () => {
      // "other" extracts as the string "other" which is truthy, so it returns it.
      global.callGeminiWithRateLimiting.mockReturnValue('no category here at all');
      const result = queryGeminiForCategory('a@b.com', 'b.com', 'Subj');
      expect(result.category).toBe('other');
    });

    it('returns null when the API signals RATE_LIMIT_REACHED', () => {
      global.callGeminiWithRateLimiting.mockImplementation(() => {
        throw new Error('RATE_LIMIT_REACHED');
      });
      expect(queryGeminiForCategory('a@b.com', 'b.com', 'Subj')).toBeNull();
    });

    it('returns the error fallback on any other error', () => {
      global.callGeminiWithRateLimiting.mockImplementation(() => {
        throw new Error('Network error');
      });
      const result = queryGeminiForCategory('a@b.com', 'b.com', 'Subj');
      expect(result).toEqual({ category: 'other', explanation: "Error occurred, defaulted to 'other'" });
    });
  });

  describe('checkLockBeforeProcessing', () => {
    it('reports lock active when a recent lock exists', () => {
      const recent = `lock_${Date.now()}`;
      PropertiesService.getScriptProperties().setProperty('EMAIL_SORTER_LOCK', recent);
      const result = checkLockBeforeProcessing();
      expect(result.lockActive).toBe(true);
      expect(result.message).toMatch(/Category manager is active/);
    });

    it('reports lock inactive when the lock is stale (>30s)', () => {
      const stale = `lock_${Date.now() - 40000}`;
      PropertiesService.getScriptProperties().setProperty('EMAIL_SORTER_LOCK', stale);
      expect(checkLockBeforeProcessing()).toEqual({ lockActive: false });
    });

    it('reports lock inactive when no lock is set', () => {
      expect(checkLockBeforeProcessing()).toEqual({ lockActive: false });
    });
  });

  describe('setupEmailSorterTrigger', () => {
    it('deletes existing categorizeEmails triggers then creates a new minute-based one', () => {
      const stale = { getHandlerFunction: jest.fn(() => 'categorizeEmails') };
      const other = { getHandlerFunction: jest.fn(() => 'somethingElse') };
      ScriptApp.getProjectTriggers.mockReturnValue([stale, other]);

      const createSpy = jest.fn();
      const everyMinutesSpy = jest.fn(() => ({ create: createSpy }));
      ScriptApp.newTrigger.mockReturnValue({ timeBased: jest.fn(() => ({ everyMinutes: everyMinutesSpy })) });

      const msg = setupEmailSorterTrigger();

      expect(ScriptApp.deleteTrigger).toHaveBeenCalledTimes(1);
      expect(ScriptApp.deleteTrigger).toHaveBeenCalledWith(stale);
      expect(ScriptApp.newTrigger).toHaveBeenCalledWith('categorizeEmails');
      expect(everyMinutesSpy).toHaveBeenCalledWith(5);
      expect(createSpy).toHaveBeenCalled();
      expect(msg).toContain('every 5 minute');
    });
  });

  describe('moveEmailToFolder', () => {
    it('returns false for an empty or non-string folder name', () => {
      const thread = makeThread();
      expect(moveEmailToFolder(thread, '')).toBe(false);
      expect(moveEmailToFolder(thread, null)).toBe(false);
      expect(moveEmailToFolder(thread, 42)).toBe(false);
    });

    it('applies an existing label and archives the thread', () => {
      const addToThread = jest.fn();
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread });
      const thread = makeThread();

      expect(moveEmailToFolder(thread, 'Work')).toBe(true);
      expect(addToThread).toHaveBeenCalledWith(thread);
      expect(thread.moveToArchive).toHaveBeenCalled();
    });

    it('creates the label when it does not exist', () => {
      const addToThread = jest.fn();
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel.mockReturnValue({ addToThread });
      const thread = makeThread();

      expect(moveEmailToFolder(thread, 'NewLabel')).toBe(true);
      expect(GmailApp.createLabel).toHaveBeenCalledWith('NewLabel');
      expect(addToThread).toHaveBeenCalledWith(thread);
    });

    it('returns false when label creation throws', () => {
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel.mockImplementation(() => { throw new Error('quota'); });
      const thread = makeThread();
      expect(moveEmailToFolder(thread, 'Boom')).toBe(false);
    });
  });

  describe('createNewCategory', () => {
    it('returns null when addCategory fails', () => {
      global.addCategory.mockReturnValue({ success: false, message: 'dup' });
      expect(createNewCategory('travel', 'a@b.com', 'b.com', 'Subj')).toBeNull();
    });

    it('returns null when creating the Gmail label throws', () => {
      global.addCategory.mockReturnValue({ success: true });
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel.mockImplementation(() => { throw new Error('label fail'); });
      expect(createNewCategory('travel', 'a@b.com', 'b.com', 'Subj')).toBeNull();
    });

    it('creates the category + label and returns the folder name', () => {
      global.addCategory.mockReturnValue({ success: true });
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel.mockReturnValue({ getName: () => 'Travel' });
      const result = createNewCategory('travel', 'a@b.com', 'b.com', 'Subj');
      expect(result).toBe('Travel');
      expect(global.addCategory).toHaveBeenCalledWith('travel', 'Travel');
    });

    it('does not recreate the label when it already exists', () => {
      global.addCategory.mockReturnValue({ success: true });
      GmailApp.getUserLabelByName.mockReturnValue({ getName: () => 'Travel' });
      const result = createNewCategory('travel', 'a@b.com', 'b.com', 'Subj');
      expect(result).toBe('Travel');
      expect(GmailApp.createLabel).not.toHaveBeenCalled();
    });
  });

  describe('toggleDynamicCategories', () => {
    it('flips the setting off->on', () => {
      global.isDynamicCategoriesEnabled.mockReturnValue(false);
      expect(toggleDynamicCategories()).toBe(true);
      expect(global.setDynamicCategoriesEnabled).toHaveBeenCalledWith(true);
    });

    it('flips the setting on->off', () => {
      global.isDynamicCategoriesEnabled.mockReturnValue(true);
      expect(toggleDynamicCategories()).toBe(false);
      expect(global.setDynamicCategoriesEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('setupEmailSorter', () => {
    beforeEach(() => {
      ScriptApp.newTrigger.mockReturnValue({
        timeBased: jest.fn(() => ({ everyMinutes: jest.fn(() => ({ create: jest.fn() })) }))
      });
    });

    it('initializes the cache, creates missing labels, and reports Enabled', () => {
      global.isDynamicCategoriesEnabled.mockReturnValue(true); // status -> "Enabled"
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel.mockReturnValue({ getName: () => 'x' });

      const status = setupEmailSorter();

      expect(global.initializeCategorizerCache).toHaveBeenCalled();
      // One createLabel per category (work/finance/shopping/other).
      expect(GmailApp.createLabel).toHaveBeenCalledTimes(4);
      expect(global.setDynamicCategoriesEnabled).toHaveBeenCalledWith(true);
      expect(status).toContain('EMAIL SORTER SETUP COMPLETE');
      expect(status).toContain('Dynamic Categories: Enabled');
    });

    it('skips creating labels that already exist and survives a per-label error', () => {
      // First category errors during createLabel; the loop must continue.
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel
        .mockImplementationOnce(() => { throw new Error('boom'); })
        .mockReturnValue({ getName: () => 'x' });

      const status = setupEmailSorter();
      expect(status).toContain('EMAIL SORTER SETUP COMPLETE');
    });

    it('handles a non-object/non-string category value (default branch)', () => {
      global.getAllCategories.mockReturnValue({ weird: 12345 });
      GmailApp.getUserLabelByName.mockReturnValue({ getName: () => 'Weird' });
      const status = setupEmailSorter();
      expect(status).toContain('EMAIL SORTER SETUP COMPLETE');
    });

    it('returns an error message when setup throws', () => {
      global.initializeCategorizerCache.mockImplementation(() => { throw new Error('init fail'); });
      const status = setupEmailSorter();
      expect(status).toContain('ERROR DURING SETUP');
    });

    it('reports dynamic categories disabled when the flag is off', () => {
      global.isDynamicCategoriesEnabled.mockReturnValue(false);
      GmailApp.getUserLabelByName.mockReturnValue({ getName: () => 'x' });
      const status = setupEmailSorter();
      expect(status).toContain('Dynamic Categories: Disabled');
    });
  });

  describe('categorizeEmails', () => {
    it('postpones when the category manager lock is active', () => {
      PropertiesService.getScriptProperties().setProperty('EMAIL_SORTER_LOCK', `lock_${Date.now()}`);
      const result = categorizeEmails();
      expect(result.processedThreads).toBe(0);
      expect(result.message).toMatch(/postponed/);
    });

    it('skips read threads and read latest messages', () => {
      const readThread = makeThread({ unread: false });
      const readMsgThread = makeThread({ unread: true, msgUnread: false });
      GmailApp.getInboxThreads.mockReturnValue([readThread, readMsgThread]);

      const result = categorizeEmails();
      expect(result.processedThreads).toBe(0);
      expect(readMsgThread.getMessages).toHaveBeenCalled();
    });

    it('uses a cached email category and moves the thread', () => {
      const thread = makeThread({ from: 'Jobs <jobs@acme.com>', subject: 'Role' });
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('work');
      const addToThread = jest.fn();
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread });

      const result = categorizeEmails();
      expect(result.processedThreads).toBe(1);
      expect(result.categorizedThreads).toBe(1);
      expect(addToThread).toHaveBeenCalledWith(thread);
    });

    it('falls back to the domain category when the email is not cached', () => {
      const thread = makeThread({ from: 'jobs@acme.com', subject: 'Role' });
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue('finance'); // object-shaped {label:'Finance'}
      const addToThread = jest.fn();
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread });

      const result = categorizeEmails();
      expect(global.getCategoryForDomain).toHaveBeenCalledWith('acme.com');
      expect(result.categorizedThreads).toBe(1);
    });

    it('records API monitoring when API_MONITOR is present (cache hit path)', () => {
      const recordEmailProcessed = jest.fn();
      global.API_MONITOR = { recordEmailProcessed };
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('work');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      categorizeEmails();
      expect(recordEmailProcessed).toHaveBeenCalledWith('work');
    });

    it('counts an error when the cached-category move fails', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('work');
      // Move fails: label creation throws and getUserLabelByName returns null.
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel.mockImplementation(() => { throw new Error('nope'); });

      const result = categorizeEmails();
      expect(result.errors).toBe(1);
      expect(result.categorizedThreads).toBe(0);
    });

    it('derives the folder name from a string-valued category in cache', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('work'); // 'work' -> string 'Work'
      const label = { addToThread: jest.fn() };
      GmailApp.getUserLabelByName.mockImplementation((name) => (name === 'Work' ? label : null));

      const result = categorizeEmails();
      expect(result.categorizedThreads).toBe(1);
    });

    it('derives a capitalized folder name when the category is unknown in the map', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      // Cached category not present in getAllCategories() -> falls to capitalize branch.
      global.getCategoryForEmail.mockReturnValue('newsletters');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      const result = categorizeEmails();
      expect(result.categorizedThreads).toBe(1);
    });

    it('queries Gemini when not cached and moves to the suggested category', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"work"}');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      const result = categorizeEmails();
      expect(result.fromAPI).toBe(1);
      expect(result.categorizedThreads).toBe(1);
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith('jobs@acme.com', 'work');
      expect(global.updateCategoryForDomain).toHaveBeenCalledWith('acme.com', 'work');
    });

    it('creates a new dynamic category when enabled and the category is unknown', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.isDynamicCategoriesEnabled.mockReturnValue(true);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"travel"}');
      global.addCategory.mockReturnValue({ success: true });
      // Categories map will not contain "travel"; createNewCategory adds it.
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });
      GmailApp.createLabel.mockReturnValue({ getName: () => 'Travel' });

      const result = categorizeEmails();
      expect(result.newCategories).toBe(1);
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith('jobs@acme.com', 'travel');
    });

    it('derives the folder name from an object-shaped Gemini category (label field)', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      // "finance" is object-shaped { label: 'Finance' } in DEFAULT_CATEGORIES.
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"finance"}');
      const label = { addToThread: jest.fn() };
      GmailApp.getUserLabelByName.mockImplementation((name) => (name === 'Finance' ? label : null));

      const result = categorizeEmails();
      expect(result.categorizedThreads).toBe(1);
      expect(label.addToThread).toHaveBeenCalledWith(thread);
    });

    it('derives a capitalized folder name from a non-string/non-object Gemini category (default branch)', () => {
      // Category value is a number -> hits the else branch that capitalizes the key.
      global.getAllCategories.mockReturnValue({ numbered: 7, other: 'Other' });
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"numbered"}');
      const label = { addToThread: jest.fn() };
      GmailApp.getUserLabelByName.mockImplementation((name) => (name === 'Numbered' ? label : null));

      const result = categorizeEmails();
      expect(result.categorizedThreads).toBe(1);
    });

    it('uses displayName then the category key when an object category lacks a label (cache path)', () => {
      // displayName-only -> uses displayName; then neither -> uses the key.
      global.getAllCategories.mockReturnValue({
        promo: { displayName: 'Promotions' },
        bare: {},
        other: 'Other'
      });
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('promo');
      const promoLabel = { addToThread: jest.fn() };
      GmailApp.getUserLabelByName.mockImplementation((n) => (n === 'Promotions' ? promoLabel : null));

      const r1 = categorizeEmails();
      expect(promoLabel.addToThread).toHaveBeenCalledWith(thread);
      expect(r1.categorizedThreads).toBe(1);

      // Now an object with neither label nor displayName -> folderName = key 'bare'.
      jest.clearAllMocks();
      global.getAllCategories.mockReturnValue({ bare: {}, other: 'Other' });
      const thread2 = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread2]);
      global.getCategoryForEmail.mockReturnValue('bare');
      const bareLabel = { addToThread: jest.fn() };
      GmailApp.getUserLabelByName.mockImplementation((n) => (n === 'bare' ? bareLabel : null));

      const r2 = categorizeEmails();
      expect(bareLabel.addToThread).toHaveBeenCalledWith(thread2);
      expect(r2.categorizedThreads).toBe(1);
    });

    it('uses displayName then the category key when an object category lacks a label (Gemini path)', () => {
      global.getAllCategories.mockReturnValue({
        promo: { displayName: 'Promotions' },
        other: 'Other'
      });
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"promo"}');
      const promoLabel = { addToThread: jest.fn() };
      GmailApp.getUserLabelByName.mockImplementation((n) => (n === 'Promotions' ? promoLabel : null));

      const result = categorizeEmails();
      expect(promoLabel.addToThread).toHaveBeenCalledWith(thread);
      expect(result.categorizedThreads).toBe(1);
    });

    it('skips the domain cache update when the address has no domain (create + non-create paths)', () => {
      // Address with no '@' -> domain is undefined; the `if (domain)` guards skip.
      global.isDynamicCategoriesEnabled.mockReturnValue(true);
      const thread = makeThread({ from: 'nodomain' });
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"travel"}');
      global.addCategory.mockReturnValue({ success: true });
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });
      GmailApp.createLabel.mockReturnValue({ getName: () => 'Travel' });

      categorizeEmails();
      // Email cache updated, but domain cache NOT updated (no domain).
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith('nodomain', 'travel');
      expect(global.updateCategoryForDomain).not.toHaveBeenCalled();
    });

    it('skips the domain cache update on the non-create Gemini path when there is no domain', () => {
      global.isDynamicCategoriesEnabled.mockReturnValue(false); // forces the else branch
      const thread = makeThread({ from: 'nodomain' });
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"work"}');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      categorizeEmails();
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith('nodomain', 'work');
      expect(global.updateCategoryForDomain).not.toHaveBeenCalled();
    });

    it('falls through label/displayName to the category key on the Gemini move path', () => {
      // Object category with neither label nor displayName -> folderName = key.
      global.getAllCategories.mockReturnValue({ bare: {}, other: 'Other' });
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"bare"}');
      const label = { addToThread: jest.fn() };
      GmailApp.getUserLabelByName.mockImplementation((n) => (n === 'bare' ? label : null));

      const result = categorizeEmails();
      expect(label.addToThread).toHaveBeenCalledWith(thread);
      expect(result.categorizedThreads).toBe(1);
    });

    it('uses the raw "from" string when no email address can be parsed', () => {
      // No angle brackets and no @ -> both regexes fail, emailMatch is null,
      // emailAddress falls back to the raw `from`.
      const thread = makeThread({ from: 'Mailer Daemon' });
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('work');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      categorizeEmails();
      expect(global.getCategoryForEmail).toHaveBeenCalledWith('Mailer Daemon');
    });

    it('does not increment newCategories when createNewCategory fails', () => {
      global.isDynamicCategoriesEnabled.mockReturnValue(true);
      global.addCategory.mockReturnValue({ success: false, message: 'dup' }); // -> null
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"travel"}');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      const result = categorizeEmails();
      expect(result.newCategories).toBe(0);
      // Cache still updated with the suggested category.
      expect(global.updateCategoryForEmail).toHaveBeenCalledWith('jobs@acme.com', 'travel');
    });

    it('skips the email when Gemini returns null (rate limited)', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockImplementation(() => { throw new Error('RATE_LIMIT_REACHED'); });

      const result = categorizeEmails();
      expect(result.skippedDueToRateLimit).toBe(1);
      expect(result.categorizedThreads).toBe(0);
    });

    it('skips remaining emails once the per-run Gemini call cap is reached', () => {
      global.EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE = 0;
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);

      const result = categorizeEmails();
      expect(result.skippedDueToRateLimit).toBe(1);
      expect(global.callGeminiWithRateLimiting).not.toHaveBeenCalled();
      global.EMAIL_SORTER_CONFIG.MAX_GEMINI_CALLS_PER_MINUTE = 10;
    });

    it('counts an error and continues when processing a thread throws', () => {
      const goodThread = makeThread();
      const badThread = {
        isUnread: jest.fn(() => { throw new Error('thread boom'); })
      };
      GmailApp.getInboxThreads.mockReturnValue([badThread, goodThread]);
      global.getCategoryForEmail.mockReturnValue('work');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      const result = categorizeEmails();
      expect(result.errors).toBeGreaterThanOrEqual(1);
      // The good thread still got processed after the bad one.
      expect(result.categorizedThreads).toBe(1);
    });

    it('continues to the next email when queryGemini path throws (aiError catch)', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      // queryGeminiForCategory swallows errors internally, so to hit the aiError
      // catch we make isDynamicCategoriesEnabled throw during the new-category check.
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"travel"}');
      global.isDynamicCategoriesEnabled.mockImplementation(() => { throw new Error('flag boom'); });
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      const result = categorizeEmails();
      expect(result.fromAPI).toBe(1);
      // No crash; thread not categorized due to the thrown flag check.
      expect(result.categorizedThreads).toBe(0);
    });

    it('records API monitoring on the Gemini move path when API_MONITOR is present', () => {
      const recordEmailProcessed = jest.fn();
      global.API_MONITOR = { recordEmailProcessed };
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"work"}');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      categorizeEmails();
      expect(recordEmailProcessed).toHaveBeenCalledWith('work');
    });

    it('counts an error when the Gemini-path move fails', () => {
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue(null);
      global.getCategoryForDomain.mockReturnValue(null);
      global.callGeminiWithRateLimiting.mockReturnValue('{"category":"work"}');
      GmailApp.getUserLabelByName.mockReturnValue(null);
      GmailApp.createLabel.mockImplementation(() => { throw new Error('nope'); });

      const result = categorizeEmails();
      expect(result.errors).toBe(1);
    });

    it('handles a "from" with no angle brackets via the bare-address regex', () => {
      const thread = makeThread({ from: 'plainsender@acme.com' });
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('work');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread: jest.fn() });

      categorizeEmails();
      // Bare-address fallback regex (post-bugfix) captures the full address.
      expect(global.getCategoryForEmail).toHaveBeenCalledWith('plainsender@acme.com');
    });

    it('re-throws when the outer try fails (getInboxThreads throws)', () => {
      GmailApp.getInboxThreads.mockImplementation(() => { throw new Error('inbox down'); });
      expect(() => categorizeEmails()).toThrow('inbox down');
    });
  });

  describe('serviceFactory seam (GAS-global branch)', () => {
    afterEach(() => {
      delete global.serviceFactory;
    });

    it('resolves the GAS-global serviceFactory when one is present', () => {
      // Simulate the Apps Script concatenated-scope path where `serviceFactory`
      // is a global, exercising the `typeof serviceFactory !== "undefined"` branch.
      const addToThread = jest.fn();
      global.serviceFactory = serviceFactory;
      const thread = makeThread();
      GmailApp.getInboxThreads.mockReturnValue([thread]);
      global.getCategoryForEmail.mockReturnValue('work');
      GmailApp.getUserLabelByName.mockReturnValue({ addToThread });

      const result = categorizeEmails();
      expect(result.categorizedThreads).toBe(1);
      expect(addToThread).toHaveBeenCalledWith(thread);
    });
  });
});
