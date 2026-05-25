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
});
