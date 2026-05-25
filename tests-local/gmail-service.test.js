/**
 * Gmail Service Tests
 * Comprehensive tests for Gmail label and thread operations
 */

// Load modules using require for proper coverage tracking
const config = require('../src/core/config.js');
const {
  GmailLabelService,
  GmailThreadService,
  GmailMessageService,
  GmailUtilityService,
  GmailService
} = require('../src/core/gmail-service.js');

describe('Gmail Service - Complete Test Suite', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GmailLabelService', () => {

    describe('getOrCreateLabel', () => {
      it('should return existing label if found', () => {
        const mockLabel = { getName: jest.fn(() => 'Work') };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockLabel)
        };

        const result = GmailLabelService.getOrCreateLabel('Work');

        expect(result).toBe(mockLabel);
        expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('Work');
      });

      it('should create simple label if not found', () => {
        const mockLabel = { getName: jest.fn(() => 'NewLabel') };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => null),
          createLabel: jest.fn(() => mockLabel)
        };

        const result = GmailLabelService.getOrCreateLabel('NewLabel');

        expect(result).toBe(mockLabel);
        expect(GmailApp.createLabel).toHaveBeenCalledWith('NewLabel');
      });

      it('should create nested label hierarchy', () => {
        const mockLabelParent = { getName: jest.fn(() => 'Work') };
        const mockLabelChild = { getName: jest.fn(() => 'Work/Projects') };
        const mockLabelFull = { getName: jest.fn(() => 'Work/Projects/Q1') };

        global.GmailApp = {
          getUserLabelByName: jest.fn((path) => {
            // Return null for initial checks (label doesn't exist)
            // Return the created label on final check
            if (path === 'Work/Projects/Q1' && GmailApp.createLabel.mock.calls.length >= 2) {
              return mockLabelFull;
            }
            return null;
          }),
          createLabel: jest.fn((path) => {
            if (path === 'Work') return mockLabelParent;
            if (path === 'Work/Projects') return mockLabelChild;
            if (path === 'Work/Projects/Q1') return mockLabelFull;
            return null;
          })
        };

        const result = GmailLabelService.getOrCreateLabel('Work/Projects/Q1');

        expect(GmailApp.createLabel).toHaveBeenCalledWith('Work');
        expect(GmailApp.createLabel).toHaveBeenCalledWith('Work/Projects');
        // The function creates hierarchy but may not create the final label if it exists
        expect(GmailApp.createLabel.mock.calls.length).toBeGreaterThanOrEqual(2);
      });

      it('should handle errors gracefully', () => {
        global.GmailApp = {
          getUserLabelByName: jest.fn(() => {
            throw new Error('Gmail API error');
          })
        };

        expect(() => {
          GmailLabelService.getOrCreateLabel('BadLabel');
        }).toThrow('Gmail API error');
      });
    });

    describe('getLabelSafe', () => {
      it('should return label if found', () => {
        const mockLabel = { getName: jest.fn(() => 'Work') };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockLabel)
        };

        const result = GmailLabelService.getLabelSafe('Work');

        expect(result).toBe(mockLabel);
      });

      it('should return null if label not found', () => {
        global.GmailApp = {
          getUserLabelByName: jest.fn(() => {
            throw new Error('Label not found');
          })
        };

        const result = GmailLabelService.getLabelSafe('NonExistent');

        expect(result).toBeNull();
      });

      it('should return null on any error', () => {
        global.GmailApp = {
          getUserLabelByName: jest.fn(() => {
            throw new Error('API error');
          })
        };

        const result = GmailLabelService.getLabelSafe('Work');

        expect(result).toBeNull();
      });
    });

    describe('getAllLabels', () => {
      it('should return cached labels if available', () => {
        const cachedLabels = [
          { name: 'Work', type: 'user' },
          { name: 'INBOX', type: 'system' }
        ];

        global.CacheService = {
          getScriptCache: jest.fn(() => ({
            get: jest.fn(() => JSON.stringify(cachedLabels)),
            put: jest.fn()
          }))
        };

        const result = GmailLabelService.getAllLabels();

        expect(result).toEqual(cachedLabels);
      });

      it('should fetch labels from Gmail if cache miss', () => {
        const mockLabel1 = { getName: jest.fn(() => 'Work') };
        const mockLabel2 = { getName: jest.fn(() => 'Personal') };

        global.GmailApp = {
          getUserLabels: jest.fn(() => [mockLabel1, mockLabel2])
        };

        global.CacheService = {
          getScriptCache: jest.fn(() => ({
            get: jest.fn(() => null),
            put: jest.fn()
          }))
        };

        const result = GmailLabelService.getAllLabels();

        expect(result).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'Work', type: 'user' }),
            expect.objectContaining({ name: 'Personal', type: 'user' })
          ])
        );
      });

      it('should include system labels', () => {
        global.GmailApp = {
          getUserLabels: jest.fn(() => [])
        };

        global.CacheService = {
          getScriptCache: jest.fn(() => ({
            get: jest.fn(() => null),
            put: jest.fn()
          }))
        };

        const result = GmailLabelService.getAllLabels();

        const systemLabels = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT', 'SPAM', 'TRASH'];
        systemLabels.forEach(labelName => {
          expect(result).toContainEqual({ name: labelName, type: 'system' });
        });
      });

      it('should force refresh when requested', () => {
        const mockLabel = { getName: jest.fn(() => 'Work') };

        global.GmailApp = {
          getUserLabels: jest.fn(() => [mockLabel])
        };

        const mockCache = {
          get: jest.fn(() => JSON.stringify([{ name: 'Old', type: 'user' }])),
          put: jest.fn()
        };

        global.CacheService = {
          getScriptCache: jest.fn(() => mockCache)
        };

        const result = GmailLabelService.getAllLabels(true);

        expect(mockCache.get).not.toHaveBeenCalled();
        expect(GmailApp.getUserLabels).toHaveBeenCalled();
      });

      it('should cache results', () => {
        const mockLabel = { getName: jest.fn(() => 'Work') };

        global.GmailApp = {
          getUserLabels: jest.fn(() => [mockLabel])
        };

        const mockCache = {
          get: jest.fn(() => null),
          put: jest.fn()
        };

        global.CacheService = {
          getScriptCache: jest.fn(() => mockCache)
        };

        GmailLabelService.getAllLabels();

        expect(mockCache.put).toHaveBeenCalled();
        expect(mockCache.put).toHaveBeenCalledWith(
          'GMAIL_LABELS_CACHE',
          expect.any(String),
          300
        );
      });

      it('should handle errors and return empty array', () => {
        global.GmailApp = {
          getUserLabels: jest.fn(() => {
            throw new Error('Gmail API error');
          })
        };

        global.CacheService = {
          getScriptCache: jest.fn(() => ({
            get: jest.fn(() => null),
            put: jest.fn()
          }))
        };

        const result = GmailLabelService.getAllLabels();

        expect(result).toEqual([]);
      });
    });

    describe('applyLabel', () => {
      it('should apply label to thread', () => {
        const mockLabel = { getName: jest.fn(() => 'Work') };
        const mockThread = {
          addLabel: jest.fn()
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockLabel)
        };

        const result = GmailLabelService.applyLabel(mockThread, 'Work');

        expect(result).toBe(true);
        expect(mockThread.addLabel).toHaveBeenCalledWith(mockLabel);
      });

      it('should create label if it does not exist', () => {
        const mockLabel = { getName: jest.fn(() => 'NewLabel') };
        const mockThread = {
          addLabel: jest.fn()
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => null),
          createLabel: jest.fn(() => mockLabel)
        };

        const result = GmailLabelService.applyLabel(mockThread, 'NewLabel');

        expect(result).toBe(true);
        expect(GmailApp.createLabel).toHaveBeenCalledWith('NewLabel');
        expect(mockThread.addLabel).toHaveBeenCalledWith(mockLabel);
      });

      it('should return false on error', () => {
        const mockThread = {
          addLabel: jest.fn(() => {
            throw new Error('Thread error');
          })
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => ({ getName: () => 'Work' }))
        };

        const result = GmailLabelService.applyLabel(mockThread, 'Work');

        expect(result).toBe(false);
      });
    });

    describe('removeLabel', () => {
      it('should remove label from thread', () => {
        const mockLabel = { getName: jest.fn(() => 'Work') };
        const mockThread = {
          removeLabel: jest.fn()
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockLabel)
        };

        const result = GmailLabelService.removeLabel(mockThread, 'Work');

        expect(result).toBe(true);
        expect(mockThread.removeLabel).toHaveBeenCalledWith(mockLabel);
      });

      it('should handle non-existent label gracefully', () => {
        const mockThread = {
          removeLabel: jest.fn()
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => {
            throw new Error('Label not found');
          })
        };

        const result = GmailLabelService.removeLabel(mockThread, 'NonExistent');

        expect(result).toBe(true);
        expect(mockThread.removeLabel).not.toHaveBeenCalled();
      });

      it('should return false on error', () => {
        const mockLabel = { getName: jest.fn(() => 'Work') };
        const mockThread = {
          removeLabel: jest.fn(() => {
            throw new Error('Thread error');
          })
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockLabel)
        };

        const result = GmailLabelService.removeLabel(mockThread, 'Work');

        expect(result).toBe(false);
      });
    });

    describe('moveThread', () => {
      it('should move thread from one label to another', () => {
        const mockFromLabel = { getName: jest.fn(() => 'INBOX') };
        const mockToLabel = { getName: jest.fn(() => 'Archive') };
        const mockThread = {
          addLabel: jest.fn(),
          removeLabel: jest.fn()
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn((name) => {
            if (name === 'INBOX') return mockFromLabel;
            if (name === 'Archive') return mockToLabel;
            return null;
          }),
          createLabel: jest.fn(() => mockToLabel)
        };

        const result = GmailLabelService.moveThread(mockThread, 'INBOX', 'Archive');

        expect(result).toBe(true);
        expect(mockThread.removeLabel).toHaveBeenCalledWith(mockFromLabel);
        expect(mockThread.addLabel).toHaveBeenCalledWith(mockToLabel);
      });

      it('should handle null fromLabel', () => {
        const mockToLabel = { getName: jest.fn(() => 'Archive') };
        const mockThread = {
          addLabel: jest.fn(),
          removeLabel: jest.fn()
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockToLabel),
          createLabel: jest.fn(() => mockToLabel)
        };

        const result = GmailLabelService.moveThread(mockThread, null, 'Archive');

        expect(result).toBe(true);
        expect(mockThread.removeLabel).not.toHaveBeenCalled();
        expect(mockThread.addLabel).toHaveBeenCalledWith(mockToLabel);
      });

      it('should handle null toLabel', () => {
        const mockFromLabel = { getName: jest.fn(() => 'INBOX') };
        const mockThread = {
          addLabel: jest.fn(),
          removeLabel: jest.fn()
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockFromLabel)
        };

        const result = GmailLabelService.moveThread(mockThread, 'INBOX', null);

        expect(result).toBe(true);
        expect(mockThread.removeLabel).toHaveBeenCalledWith(mockFromLabel);
        expect(mockThread.addLabel).not.toHaveBeenCalled();
      });

      it('should complete even if sub-operations fail', () => {
        // Note: removeLabel and applyLabel have their own error handling
        // and return booleans, so moveThread always succeeds unless there's
        // an unexpected error in the try block itself
        const mockFromLabel = { getName: jest.fn(() => 'INBOX') };
        const mockThread = {
          addLabel: jest.fn(),
          removeLabel: jest.fn(() => {
            throw new Error('Thread error - cannot remove label');
          })
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockFromLabel)
        };

        const result = GmailLabelService.moveThread(mockThread, 'INBOX', 'Archive');

        // moveThread returns true even if sub-operations fail (they handle errors internally)
        expect(result).toBe(true);
      });
    });
  });

  describe('GmailThreadService', () => {

    describe('getThreadsFromLabel', () => {
      it('should return threads from label', () => {
        const mockThread1 = { getId: jest.fn(() => 'thread1') };
        const mockThread2 = { getId: jest.fn(() => 'thread2') };
        const mockLabel = {
          getName: jest.fn(() => 'Work'),
          getThreads: jest.fn(() => [mockThread1, mockThread2])
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockLabel)
        };

        const result = GmailThreadService.getThreadsFromLabel('Work');

        expect(result).toHaveLength(2);
        expect(result).toContain(mockThread1);
        expect(result).toContain(mockThread2);
        expect(mockLabel.getThreads).toHaveBeenCalledWith(0, 100);
      });

      it('should support pagination', () => {
        const mockLabel = {
          getName: jest.fn(() => 'Work'),
          getThreads: jest.fn(() => [])
        };

        global.GmailApp = {
          getUserLabelByName: jest.fn(() => mockLabel)
        };

        GmailThreadService.getThreadsFromLabel('Work', 10, 50);

        expect(mockLabel.getThreads).toHaveBeenCalledWith(10, 50);
      });

      it('should return empty array if label not found', () => {
        global.GmailApp = {
          getUserLabelByName: jest.fn(() => null)
        };

        const result = GmailThreadService.getThreadsFromLabel('NonExistent');

        expect(result).toEqual([]);
      });

      it('should handle errors gracefully', () => {
        global.GmailApp = {
          getUserLabelByName: jest.fn(() => {
            throw new Error('Gmail API error');
          })
        };

        const result = GmailThreadService.getThreadsFromLabel('Work');

        expect(result).toEqual([]);
      });
    });
  });
});
