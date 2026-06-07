/**
 * GmailAdapter Tests
 */

const { GmailAdapter } = require('../src/core/services/gmail-adapter.js');

describe('GmailAdapter', () => {
  let adapter;
  let mockGmailApp;

  beforeEach(() => {
    mockGmailApp = {
      getThreadById: jest.fn(),
      getUserLabelByName: jest.fn(),
      createLabel: jest.fn(),
      search: jest.fn(),
    };
    adapter = new GmailAdapter(mockGmailApp);
  });

  describe('getThreadById', () => {
    it('should delegate to gmail.getThreadById', () => {
      const mockThread = { getId: jest.fn(() => 't1') };
      mockGmailApp.getThreadById.mockReturnValue(mockThread);

      const result = adapter.getThreadById('t1');

      expect(mockGmailApp.getThreadById).toHaveBeenCalledWith('t1');
      expect(result).toBe(mockThread);
    });
  });

  describe('getUserLabelByName', () => {
    it('should delegate to gmail.getUserLabelByName', () => {
      const mockLabel = { getName: jest.fn(() => 'Work') };
      mockGmailApp.getUserLabelByName.mockReturnValue(mockLabel);

      const result = adapter.getUserLabelByName('Work');

      expect(mockGmailApp.getUserLabelByName).toHaveBeenCalledWith('Work');
      expect(result).toBe(mockLabel);
    });
  });

  describe('createLabel', () => {
    it('should delegate to gmail.createLabel', () => {
      const mockLabel = { getName: jest.fn(() => 'NewLabel') };
      mockGmailApp.createLabel.mockReturnValue(mockLabel);

      const result = adapter.createLabel('NewLabel');

      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('NewLabel');
      expect(result).toBe(mockLabel);
    });
  });

  describe('getInboxThreads', () => {
    it('should delegate to gmail.getInboxThreads', () => {
      mockGmailApp.getInboxThreads = jest.fn(() => ['t1', 't2']);

      const result = adapter.getInboxThreads(0, 50);

      expect(mockGmailApp.getInboxThreads).toHaveBeenCalledWith(0, 50);
      expect(result).toEqual(['t1', 't2']);
    });
  });

  describe('search', () => {
    it('should delegate to gmail.search with default max', () => {
      mockGmailApp.search.mockReturnValue([]);

      adapter.search('label:work');

      expect(mockGmailApp.search).toHaveBeenCalledWith('label:work', 0, 500);
    });

    it('should accept custom start and max results', () => {
      mockGmailApp.search.mockReturnValue([]);

      adapter.search('label:work', 10, 50);

      expect(mockGmailApp.search).toHaveBeenCalledWith('label:work', 10, 50);
    });
  });

  describe('sendEmail', () => {
    it('should delegate to MailApp.sendEmail', () => {
      global.MailApp = { sendEmail: jest.fn() };

      adapter.sendEmail('to@test.com', 'Subject', 'Body');

      expect(global.MailApp.sendEmail).toHaveBeenCalledWith('to@test.com', 'Subject', 'Body', {});
    });
  });

  describe('getUserEmailAddress', () => {
    it('should delegate to Session.getEffectiveUser().getEmail()', () => {
      global.Session = {
        getEffectiveUser: jest.fn(() => ({ getEmail: jest.fn(() => 'user@example.com') }))
      };

      const result = adapter.getUserEmailAddress();

      expect(result).toBe('user@example.com');
    });
  });

  describe('getAllLabels', () => {
    let mockCache;

    beforeEach(() => {
      mockCache = {
        get: jest.fn(() => null),
        put: jest.fn(),
      };
      global.CacheService = { getScriptCache: jest.fn(() => mockCache) };
      global.Logger = { log: jest.fn() };
      mockGmailApp.getUserLabels = jest.fn(() => [
        { getName: jest.fn(() => 'Work') },
        { getName: jest.fn(() => 'Work/Projects') },
      ]);
    });

    it('returns cached labels on cache hit without calling Gmail', () => {
      const cached = [{ name: 'Cached', type: 'user' }];
      mockCache.get.mockReturnValue(JSON.stringify(cached));

      const result = adapter.getAllLabels();

      expect(result).toEqual(cached);
      expect(mockGmailApp.getUserLabels).not.toHaveBeenCalled();
    });

    it('reads user labels, prepends system labels, and caches on cache miss', () => {
      const result = adapter.getAllLabels();

      // system labels are prepended
      expect(result.some(l => l.name === 'INBOX' && l.type === 'system')).toBe(true);
      // user labels present
      expect(result.some(l => l.name === 'Work' && l.type === 'user')).toBe(true);
      expect(result.some(l => l.name === 'Work/Projects' && l.type === 'user')).toBe(true);
      expect(mockCache.put).toHaveBeenCalled();
    });

    it('bypasses cache when forceRefresh is true', () => {
      mockCache.get.mockReturnValue(JSON.stringify([{ name: 'Cached', type: 'user' }]));

      const result = adapter.getAllLabels(true);

      expect(mockGmailApp.getUserLabels).toHaveBeenCalled();
      expect(result.some(l => l.name === 'Work')).toBe(true);
    });

    it('returns empty array when Gmail throws', () => {
      mockGmailApp.getUserLabels = jest.fn(() => { throw new Error('Gmail error'); });

      const result = adapter.getAllLabels();

      expect(result).toEqual([]);
    });
  });

  describe('getMessageById', () => {
    it('should delegate to gmail.getMessageById', () => {
      const mockMsg = { getId: jest.fn(() => 'm1') };
      mockGmailApp.getMessageById = jest.fn(() => mockMsg);

      const result = adapter.getMessageById('m1');

      expect(mockGmailApp.getMessageById).toHaveBeenCalledWith('m1');
      expect(result).toBe(mockMsg);
    });
  });

  describe('getUserLabels', () => {
    it('should delegate to gmail.getUserLabels', () => {
      const labels = [{ getName: () => 'Work' }];
      mockGmailApp.getUserLabels = jest.fn(() => labels);

      const result = adapter.getUserLabels();

      expect(mockGmailApp.getUserLabels).toHaveBeenCalled();
      expect(result).toBe(labels);
    });
  });

  describe('getLabelSafe', () => {
    it('returns the label when found', () => {
      const mockLabel = { getName: () => 'Work' };
      mockGmailApp.getUserLabelByName.mockReturnValue(mockLabel);

      expect(adapter.getLabelSafe('Work')).toBe(mockLabel);
    });

    it('returns null when getUserLabelByName throws', () => {
      global.Logger = { log: jest.fn() };
      mockGmailApp.getUserLabelByName = jest.fn(() => { throw new Error('boom'); });

      expect(adapter.getLabelSafe('Work')).toBeNull();
    });
  });

  describe('getOrCreateLabel (nested-path)', () => {
    it('returns existing label without creating', () => {
      const existing = { getName: () => 'Work' };
      mockGmailApp.getUserLabelByName = jest.fn(() => existing);

      const result = adapter.getOrCreateLabel('Work');

      expect(result).toBe(existing);
      expect(mockGmailApp.createLabel).not.toHaveBeenCalled();
    });

    it('creates each level of a nested path that does not exist', () => {
      global.Logger = { log: jest.fn() };
      const created = {};
      const finalLabel = { getName: () => 'A/B/C' };
      mockGmailApp.getUserLabelByName = jest.fn((name) => {
        // First overall lookup -> null; per-level lookups -> null until created;
        // final return lookup -> finalLabel
        if (name === 'A/B/C' && created['A/B/C']) return finalLabel;
        return null;
      });
      mockGmailApp.createLabel = jest.fn((name) => {
        created[name] = true;
        return { getName: () => name };
      });

      adapter.getOrCreateLabel('A/B/C');

      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('A');
      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('A/B');
      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('A/B/C');
    });

    it('creates a simple label when not nested and missing', () => {
      mockGmailApp.getUserLabelByName = jest.fn(() => null);
      mockGmailApp.createLabel = jest.fn((name) => ({ getName: () => name }));

      adapter.getOrCreateLabel('Simple');

      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('Simple');
    });
  });

  describe('getThreadsFromLabel', () => {
    it('returns threads from the label', () => {
      const threads = ['t1', 't2'];
      const label = { getThreads: jest.fn(() => threads) };
      mockGmailApp.getUserLabelByName = jest.fn(() => label);

      const result = adapter.getThreadsFromLabel('Work', 0, 10);

      expect(label.getThreads).toHaveBeenCalledWith(0, 10);
      expect(result).toBe(threads);
    });

    it('returns [] when label not found', () => {
      mockGmailApp.getUserLabelByName = jest.fn(() => null);

      expect(adapter.getThreadsFromLabel('Missing')).toEqual([]);
    });
  });

  describe('getThreadMetadata', () => {
    it('extracts metadata from a thread', () => {
      const firstMsg = {
        getDate: () => new Date('2026-01-01'),
        getFrom: () => 'a@b.com',
        getAttachments: () => [],
      };
      const lastMsg = {
        getDate: () => new Date('2026-01-02'),
        getAttachments: () => [{}],
      };
      const thread = {
        getMessages: () => [firstMsg, lastMsg],
        getId: () => 'th1',
        getFirstMessageSubject: () => 'Hello',
        isUnread: () => true,
        isImportant: () => false,
        getLabels: () => [{ getName: () => 'Work' }],
      };

      const meta = adapter.getThreadMetadata(thread);

      expect(meta.id).toBe('th1');
      expect(meta.subject).toBe('Hello');
      expect(meta.messageCount).toBe(2);
      expect(meta.isUnread).toBe(true);
      expect(meta.labels).toEqual(['Work']);
      expect(meta.hasAttachments).toBe(true);
    });

    it('returns null when thread access throws', () => {
      global.Logger = { log: jest.fn() };
      const thread = { getMessages: () => { throw new Error('x'); } };

      expect(adapter.getThreadMetadata(thread)).toBeNull();
    });
  });

  describe('constructor + default params', () => {
    it('defaults to the global GmailApp when no arg is given', () => {
      const prevGmail = global.GmailApp;
      global.GmailApp = { getThreadById: jest.fn(() => 'thread') };
      const a = new GmailAdapter();
      expect(a.getThreadById('id')).toBe('thread');
      global.GmailApp = prevGmail;
    });

    it('getInboxThreads uses default start/max when omitted', () => {
      mockGmailApp.getInboxThreads = jest.fn(() => ['t']);
      const out = adapter.getInboxThreads();
      expect(mockGmailApp.getInboxThreads).toHaveBeenCalledWith(0, 50);
      expect(out).toEqual(['t']);
    });
  });

  describe('getOrCreateLabel reuses existing intermediate levels', () => {
    it('does not recreate a nested level that already exists', () => {
      // "Work" exists; "Work/Projects" does not -> only the missing level is created.
      const existing = { getName: () => 'Work' };
      mockGmailApp.getUserLabelByName = jest.fn((name) => {
        if (name === 'Work') return existing;          // intermediate exists -> `if(!...)` FALSE
        if (name === 'Work/Projects') return null;     // leaf missing first, then created
        return null;
      });
      const created = { getName: () => 'Work/Projects' };
      mockGmailApp.createLabel = jest.fn(() => created);
      adapter.getOrCreateLabel('Work/Projects');
      // "Work" was NOT created (already existed); only "Work/Projects" created.
      expect(mockGmailApp.createLabel).toHaveBeenCalledWith('Work/Projects');
      expect(mockGmailApp.createLabel).not.toHaveBeenCalledWith('Work');
    });
  });

  describe('getThreadsFromLabel inner catch', () => {
    it('returns [] when the found label getThreads throws', () => {
      global.Logger = { log: jest.fn() };
      const label = { getThreads: jest.fn(() => { throw new Error('threads boom'); }) };
      mockGmailApp.getUserLabelByName = jest.fn(() => label);
      expect(adapter.getThreadsFromLabel('Work', 0, 10)).toEqual([]);
    });
  });

  describe('searchByLabel / searchUnreadByLabel', () => {
    it('searchByLabel issues a label: query', () => {
      mockGmailApp.search = jest.fn(() => ['t1']);
      const out = adapter.searchByLabel('Work', 0, 5);
      expect(mockGmailApp.search).toHaveBeenCalledWith('label:Work', 0, 5);
      expect(out).toEqual(['t1']);
    });

    it('searchByLabel uses default pagination', () => {
      mockGmailApp.search = jest.fn(() => []);
      adapter.searchByLabel('Work');
      expect(mockGmailApp.search).toHaveBeenCalledWith('label:Work', 0, 500);
    });

    it('searchUnreadByLabel issues a label:...is:unread query', () => {
      mockGmailApp.search = jest.fn(() => ['u1']);
      const out = adapter.searchUnreadByLabel('Work', 0, 5);
      expect(mockGmailApp.search).toHaveBeenCalledWith('label:Work is:unread', 0, 5);
      expect(out).toEqual(['u1']);
    });

    it('searchUnreadByLabel uses default pagination', () => {
      mockGmailApp.search = jest.fn(() => []);
      adapter.searchUnreadByLabel('Work');
      expect(mockGmailApp.search).toHaveBeenCalledWith('label:Work is:unread', 0, 500);
    });
  });

  describe('batchProcessThreads', () => {
    it('processes all threads in batches and returns the results', async () => {
      global.Utilities = { sleep: jest.fn() };
      const threads = [1, 2, 3, 4, 5, 6];
      const processor = jest.fn(async (t) => t * 10);
      const results = await adapter.batchProcessThreads(threads, processor, 2, 100);
      expect(results).toEqual([10, 20, 30, 40, 50, 60]);
      expect(processor).toHaveBeenCalledTimes(6);
      // Sleeps between batches (after batch 1 and batch 2, not after the last).
      expect(Utilities.sleep).toHaveBeenCalledTimes(2);
      expect(Utilities.sleep).toHaveBeenCalledWith(100);
    });

    it('does not sleep when delayMs is 0', async () => {
      global.Utilities = { sleep: jest.fn() };
      const results = await adapter.batchProcessThreads([1, 2, 3], async (t) => t, 1, 0);
      expect(results).toEqual([1, 2, 3]);
      expect(Utilities.sleep).not.toHaveBeenCalled();
    });

    it('uses default batch size and delay', async () => {
      global.Utilities = { sleep: jest.fn() };
      const threads = Array.from({ length: 7 }, (_, i) => i);
      const results = await adapter.batchProcessThreads(threads, async (t) => t);
      expect(results.length).toBe(7);
      // 7 threads, batchSize 5 -> two batches -> one inter-batch sleep.
      expect(Utilities.sleep).toHaveBeenCalledTimes(1);
      expect(Utilities.sleep).toHaveBeenCalledWith(1000);
    });
  });
});
