/**
 * Tests for src/features/job-finder/main.js
 * Focus on processJobEmailsMain, initializeJobFinder, getEmailThreadsToProcess, processOneEmail.
 */

// Mock globals before requiring the module
global.JOB_FINDER_CONFIG = {
  SOURCE_LABEL: "📬 JobAlerts",
  PROCESSED_LABEL: "📬 JobAlerts/Processed",
  RATE_LIMIT_LABEL: "📬 JobAlerts/RateLimited",
  ACTIVE_SHEET_NAME: "Jobs",
  SHEET_COLUMNS: [
    "Company", "Company Description", "Job Title", "Location",
    "Minimum Salary", "Maximum Salary", "Salary Period", "Job URL",
    "URL Status", "Careers URL", "Careers URL Status",
  ],
};

global.getJobFinderSourceLabel = jest.fn(() => "📬 JobAlerts");
global.getJobFinderProcessedLabel = jest.fn(() => "📬 JobAlerts/Processed");
global.getJobFinderRateLimitLabel = jest.fn(() => "📬 JobAlerts/RateLimited");
global.getJobFinderNoJobsLabel = jest.fn(() => "📬 JobAlerts/NoJobs");

global.GmailService = {
  labels: {
    getLabelSafe: jest.fn((name) => ({
      getName: jest.fn(() => name),
      getThreads: jest.fn(() => []),
      addToThread: jest.fn(),
      removeFromThread: jest.fn(),
    })),
    getOrCreateLabel: jest.fn((name) => ({
      getName: jest.fn(() => name),
      addToThread: jest.fn(),
      removeFromThread: jest.fn(),
    })),
  },
};

global.callGeminiApi = jest.fn();
global.sendNotificationEmail = jest.fn();
global.extractJobDetailsSimple = jest.fn(() => []);
global.isValidJobListing = jest.fn(() => true);
global.extractTextFromHtml = jest.fn(() => ({ plainText: "Email body", extractedUrls: [] }));
global.extractEmailSource = jest.fn(() => "example");
global.formatDateTime = jest.fn(() => "2026-01-01");
global.addJobToSpreadsheet = jest.fn(() => true);

const main = require("../src/features/job-finder/main.js");

describe("job-finder main", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("initializeJobFinder", () => {
    it("returns success when spreadsheet already exists", () => {
      global.PropertiesService.getScriptProperties().setProperty("JOB_FINDER_SPREADSHEET_ID", "ss123");
      const result = main.initializeJobFinder();
      expect(result.success).toBe(true);
      expect(result.spreadsheetId).toBe("ss123");
    });

    it("creates spreadsheet and labels when none exists", () => {
      global.PropertiesService.getScriptProperties().deleteProperty("JOB_FINDER_SPREADSHEET_ID");
      const mockSheet = {
        setName: jest.fn(),
        getRange: jest.fn(() => ({ setValues: jest.fn(), setFontWeight: jest.fn() })),
        setFrozenRows: jest.fn(),
      };
      const mockSpreadsheet = {
        getId: jest.fn(() => "new-ss-id"),
        getActiveSheet: jest.fn(() => mockSheet),
      };
      global.SpreadsheetApp.create = jest.fn(() => mockSpreadsheet);
      const result = main.initializeJobFinder();
      expect(result.success).toBe(true);
      expect(result.spreadsheetId).toBe("new-ss-id");
      expect(global.SpreadsheetApp.create).toHaveBeenCalledWith("Job Listings");
      expect(mockSheet.setName).toHaveBeenCalledWith("Jobs");
    });
  });

  describe("getEmailThreadsToProcess", () => {
    it("returns error when source label not found", () => {
      global.GmailService.labels.getLabelSafe = jest.fn(() => null);
      const result = main.getEmailThreadsToProcess();
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
      expect(result.threads).toEqual([]);
    });

    it("returns threads from source label", () => {
      const threads = [{ id: "t1" }];
      global.GmailService.labels.getLabelSafe = jest.fn((name) => {
        if (name === "📬 JobAlerts") {
          return { getThreads: jest.fn(() => threads) };
        }
        return null;
      });
      const result = main.getEmailThreadsToProcess();
      expect(result.success).toBe(true);
      expect(result.threads).toEqual(threads);
    });

    it("prepends rate-limited threads when available", () => {
      global.GmailService.labels.getLabelSafe = jest.fn((name) => {
        if (name === "📬 JobAlerts") return { getThreads: jest.fn(() => [{ id: "new1" }]) };
        if (name === "📬 JobAlerts/RateLimited") return { getThreads: jest.fn(() => [{ id: "rl1" }]) };
        return null;
      });
      const result = main.getEmailThreadsToProcess();
      expect(result.threads.length).toBe(2);
      expect(result.threads[0].id).toBe("rl1");
      expect(result.threads[1].id).toBe("new1");
    });
  });

  describe("processOneEmail", () => {
    it("returns success with job count when extraction succeeds", () => {
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "<p>Apply</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev" },
      ]);
      const result = main.processOneEmail(thread, 1, 1);
      expect(result.success).toBe(true);
      expect(result.jobCount).toBe(1);
      expect(result.jobs.length).toBe(1);
    });

    it("returns rate-limited result when extraction is rate limited", () => {
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "body"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
      global.extractJobDetailsSimple = jest.fn(() => {
        throw new Error("RATE_LIMIT_REACHED");
      });
      const result = main.processOneEmail(thread, 1, 1);
      expect(result.success).toBe(false);
      expect(result.wasRateLimited).toBe(true);
    });

    it("returns error object on unexpected failure", () => {
      const thread = {
        getMessages: jest.fn(() => { throw new Error("bad thread"); }),
      };
      const result = main.processOneEmail(thread, 1, 1);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.jobCount).toBe(0);
    });
  });

  describe("processJobEmailsMain", () => {
    it("returns success with counts when batch processing completes", () => {
      global.PropertiesService.getScriptProperties().setProperty("JOB_FINDER_SPREADSHEET_ID", "ss123");
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "<p>Apply</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
      global.GmailService.labels.getLabelSafe = jest.fn((name) => {
        if (name === "📬 JobAlerts") return { getThreads: jest.fn(() => [thread]) };
        return null;
      });
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev" },
      ]);
      const result = main.processJobEmailsMain();
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.totalJobs).toBe(1);
    });

    it("returns no-threads message when no threads found", () => {
      global.GmailService.labels.getLabelSafe = jest.fn((name) => {
        if (name === "📬 JobAlerts") return { getThreads: jest.fn(() => []) };
        return null;
      });
      const result = main.processJobEmailsMain();
      expect(result.success).toBe(true);
      expect(result.message).toContain("No new job emails");
    });

    it("returns rate limit message when rate limit reached", () => {
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "body"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
      global.GmailService.labels.getLabelSafe = jest.fn((name) => {
        if (name === "📬 JobAlerts") return { getThreads: jest.fn(() => [thread]) };
        return null;
      });
      global.extractJobDetailsSimple = jest.fn(() => {
        throw new Error("RATE_LIMIT_REACHED");
      });
      const result = main.processJobEmailsMain();
      expect(result.success).toBe(false);
      expect(result.message).toContain("rate limit");
    });
  });

  describe("processOneEmail zero-job routing", () => {
    function makeThread() {
      return {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "<p>No jobs here</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
        addLabel: jest.fn(),
        removeLabel: jest.fn(),
        moveToArchive: jest.fn(),
      };
    }

    it("applies no-jobs label (not processed label) when extraction returns zero valid jobs", () => {
      const thread = makeThread();
      global.extractJobDetailsSimple = jest.fn(() => []);
      global.isValidJobListing = jest.fn(() => false);

      const noJobsLabelObj = { getName: jest.fn(() => "📬 JobAlerts/NoJobs") };
      const sourceLabelObj = { getName: jest.fn(() => "📬 JobAlerts") };
      const processedLabelObj = { getName: jest.fn(() => "📬 JobAlerts/Processed") };

      global.GmailService.labels.getOrCreateLabel = jest.fn((name) => {
        if (name === "📬 JobAlerts/NoJobs") return noJobsLabelObj;
        if (name === "📬 JobAlerts/Processed") return processedLabelObj;
        return { getName: jest.fn(() => name) };
      });
      global.GmailService.labels.getLabelSafe = jest.fn((name) => {
        if (name === "📬 JobAlerts") return sourceLabelObj;
        return null;
      });

      const result = main.processOneEmail(thread, 1, 1);

      expect(thread.addLabel).toHaveBeenCalledWith(noJobsLabelObj);
      expect(thread.addLabel).not.toHaveBeenCalledWith(processedLabelObj);
      expect(thread.moveToArchive).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.jobCount).toBe(0);
      expect(global.addJobToSpreadsheet).not.toHaveBeenCalled();
    });

    it("markEmailAsNoJobs applies no-jobs label, removes source label, archives", () => {
      const noJobsLabelObj = { getName: jest.fn(() => "📬 JobAlerts/NoJobs") };
      const sourceLabelObj = { getName: jest.fn(() => "📬 JobAlerts") };
      global.GmailService.labels.getOrCreateLabel = jest.fn((name) => {
        if (name === "📬 JobAlerts/NoJobs") return noJobsLabelObj;
        return { getName: jest.fn(() => name) };
      });
      global.GmailService.labels.getLabelSafe = jest.fn((name) => {
        if (name === "📬 JobAlerts") return sourceLabelObj;
        return null;
      });

      const thread = {
        addLabel: jest.fn(),
        removeLabel: jest.fn(),
        moveToArchive: jest.fn(),
      };

      main.markEmailAsNoJobs(thread);

      expect(thread.addLabel).toHaveBeenCalledWith(noJobsLabelObj);
      expect(thread.removeLabel).toHaveBeenCalledWith(sourceLabelObj);
      expect(thread.moveToArchive).toHaveBeenCalled();
    });
  });

  describe("processOneEmail direct-to-sheet", () => {
    it("calls addJobToSpreadsheet for each valid job", () => {
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "<p>Apply</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev" },
        { Company: "Beta", "Job Title": "PM" },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);
      const result = main.processOneEmail(thread, 1, 1);
      expect(result.success).toBe(true);
      expect(result.jobCount).toBe(2);
      expect(global.addJobToSpreadsheet).toHaveBeenCalledTimes(2);
    });

    it("filters invalid jobs before writing to sheet", () => {
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "<p>Apply</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev" },
        { Company: "Unknown" },
      ]);
      global.isValidJobListing = jest.fn((job) => job && job["Company"] === "Acme");
      global.addJobToSpreadsheet = jest.fn(() => true);
      const result = main.processOneEmail(thread, 1, 1);
      expect(result.success).toBe(true);
      expect(result.jobCount).toBe(1);
      expect(global.addJobToSpreadsheet).toHaveBeenCalledTimes(1);
      expect(global.addJobToSpreadsheet.mock.calls[0][0]["Company"]).toBe("Acme");
    });
  });
});
