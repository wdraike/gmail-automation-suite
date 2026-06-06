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
  MAX_EMAILS_PER_RUN: 10,
  EXECUTION_BUDGET_MS: 290000,
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
// NOTE: getter mocks above are initialized at module-load time (required for require() to work).
// They are re-assigned to their default implementations in beforeEach (WARN-2 fix).

// Gmail label access is routed through GmailAdapter (serviceFactory). Tests drive
// it by mocking the underlying GmailApp.getUserLabelByName / createLabel, which the
// adapter delegates to. A per-test label registry backs these mocks.
let _labelRegistry = {};

function _defaultLabelObj(name) {
  return {
    getName: jest.fn(() => name),
    getThreads: jest.fn(() => []),
  };
}

global.GmailApp.getUserLabelByName = jest.fn((name) =>
  Object.prototype.hasOwnProperty.call(_labelRegistry, name) ? _labelRegistry[name] : null
);
global.GmailApp.createLabel = jest.fn((name) => {
  const obj = _defaultLabelObj(name);
  _labelRegistry[name] = obj;
  return obj;
});

// Helper: register label objects for a test. Pass a map of name -> labelObject
// (or name -> getThreads-array shorthand handled by callers).
function setLabels(map) {
  _labelRegistry = Object.assign({}, map);
}

const { serviceFactory } = require("../src/core/services/index.js");

global.callGeminiApi = jest.fn();
global.sendNotificationEmail = jest.fn();
global.extractJobDetailsSimple = jest.fn(() => []);
global.isValidJobListing = jest.fn(() => true);
global.extractTextFromHtml = jest.fn(() => ({ plainText: "Email body", extractedUrls: [], anchorPairs: [] }));
global.extractEmailSource = jest.fn(() => "example");
global.formatDateTime = jest.fn(() => "2026-01-01");
global.addJobToSpreadsheet = jest.fn(() => true);
global.setupSheetHeaders = jest.fn();
global.auditAndRepairSheetHeaders = jest.fn(() => ({ repaired: false }));

const main = require("../src/features/job-finder/main.js");

describe("job-finder main", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset port adapters so each test gets fresh adapters bound to current globals.
    serviceFactory.reset();
    // Reset label registry and re-arm the GmailApp label mocks (clearAllMocks wiped impls).
    _labelRegistry = {};
    global.GmailApp.getUserLabelByName.mockImplementation((name) =>
      Object.prototype.hasOwnProperty.call(_labelRegistry, name) ? _labelRegistry[name] : null
    );
    global.GmailApp.createLabel.mockImplementation((name) => {
      const obj = _defaultLabelObj(name);
      _labelRegistry[name] = obj;
      return obj;
    });
    // WARN-2: reset getter mock implementations every test so overrides in one test don't bleed
    global.getJobFinderSourceLabel.mockImplementation(() => "📬 JobAlerts");
    global.getJobFinderProcessedLabel.mockImplementation(() => "📬 JobAlerts/Processed");
    global.getJobFinderRateLimitLabel.mockImplementation(() => "📬 JobAlerts/RateLimited");
    global.getJobFinderNoJobsLabel.mockImplementation(() => "📬 JobAlerts/NoJobs");
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
      setLabels({});
      const result = main.getEmailThreadsToProcess();
      expect(result.success).toBe(false);
      expect(result.message).toContain("not found");
      expect(result.threads).toEqual([]);
    });

    it("returns threads from source label", () => {
      const threads = [{ id: "t1" }];
      setLabels({ "📬 JobAlerts": { getThreads: jest.fn(() => threads) } });
      const result = main.getEmailThreadsToProcess();
      expect(result.success).toBe(true);
      expect(result.threads).toEqual(threads);
    });

    it("fetches new threads using the limit from JOB_FINDER_CONFIG (0, 10)", () => {
      const getThreadsSpy = jest.fn(() => []);
      setLabels({ "📬 JobAlerts": { getThreads: getThreadsSpy } });
      main.getEmailThreadsToProcess();
      expect(getThreadsSpy).toHaveBeenCalledWith(0, 10);
    });

    it("trims combined rate-limited + new threads to MAX_EMAILS_PER_RUN (10)", () => {
      const newThreads = Array.from({ length: 10 }, (_, i) => ({ id: `new${i}` }));
      setLabels({
        "📬 JobAlerts": { getThreads: jest.fn(() => newThreads) },
        "📬 JobAlerts/RateLimited": { getThreads: jest.fn(() => [{ id: "rl1" }, { id: "rl2" }]) },
      });
      const result = main.getEmailThreadsToProcess();
      expect(result.threads.length).toBe(10);
      // rate-limited threads are prioritized (prepended)
      expect(result.threads[0].id).toBe("rl1");
      expect(result.threads[1].id).toBe("rl2");
    });

    it("prepends rate-limited threads when available", () => {
      setLabels({
        "📬 JobAlerts": { getThreads: jest.fn(() => [{ id: "new1" }]) },
        "📬 JobAlerts/RateLimited": { getThreads: jest.fn(() => [{ id: "rl1" }]) },
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
      setLabels({ "📬 JobAlerts": { getThreads: jest.fn(() => [thread]) } });
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev" },
      ]);
      const result = main.processJobEmailsMain();
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(1);
      expect(result.totalJobs).toBe(1);
    });

    it("returns no-threads message when no threads found", () => {
      setLabels({ "📬 JobAlerts": { getThreads: jest.fn(() => []) } });
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
      setLabels({ "📬 JobAlerts": { getThreads: jest.fn(() => [thread]) } });
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

      setLabels({
        "📬 JobAlerts/NoJobs": noJobsLabelObj,
        "📬 JobAlerts/Processed": processedLabelObj,
        "📬 JobAlerts": sourceLabelObj,
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
      setLabels({
        "📬 JobAlerts/NoJobs": noJobsLabelObj,
        "📬 JobAlerts": sourceLabelObj,
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

  describe("processOneEmail extraction (no pre-check)", () => {
    // drop-precheck-bump-throughput: the isJobListingEmail cost-saving pre-check
    // was removed (it mis-filed real job emails as NoJobs because it only saw the
    // first 2000 chars). processOneEmail now runs full extraction directly.
    it("runs full extraction directly without any pre-check gate", () => {
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Job Alerts"),
          getBody: jest.fn(() => "<p>We are hiring</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev" },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const result = main.processOneEmail(thread, 1, 1);

      expect(global.extractJobDetailsSimple).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.jobCount).toBe(1);
    });

    it("marks the thread rate-limited (not NoJobs) when extraction rate-limits", () => {
      const thread = {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Job Alerts"),
          getBody: jest.fn(() => "<p>We are hiring</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
        addLabel: jest.fn(),
        removeLabel: jest.fn(),
        moveToArchive: jest.fn(),
      };
      global.extractJobDetailsSimple = jest.fn(() => {
        throw new Error("RATE_LIMIT_REACHED");
      });

      const rateLimitLabelObj = { getName: jest.fn(() => "📬 JobAlerts/RateLimited") };
      const noJobsLabelObj = { getName: jest.fn(() => "📬 JobAlerts/NoJobs") };
      setLabels({
        "📬 JobAlerts/RateLimited": rateLimitLabelObj,
        "📬 JobAlerts/NoJobs": noJobsLabelObj,
      });

      const result = main.processOneEmail(thread, 1, 1);

      // rate-limited path: thread queued, NOT archived as NoJobs
      expect(thread.addLabel).toHaveBeenCalledWith(rateLimitLabelObj);
      expect(thread.addLabel).not.toHaveBeenCalledWith(noJobsLabelObj);
      expect(result.wasRateLimited).toBe(true);
    });
  });

  describe("processOneEmail double-Unknown rejection", () => {
    function makeThread() {
      return {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => "<p>Apply</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
        addLabel: jest.fn(),
        removeLabel: jest.fn(),
        moveToArchive: jest.fn(),
      };
    }

    it("rejects jobs where company is Unknown AND title is Unknown Position", () => {
      const thread = makeThread();
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Unknown", "Job Title": "Unknown Position", _confidence: 0.9 },
        { Company: "Acme", "Job Title": "Unknown Position", _confidence: 0.9 },
        { Company: "Unknown", "Job Title": "Engineer", _confidence: 0.9 },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const noJobsLabelObj = { getName: jest.fn(() => "📬 JobAlerts/NoJobs") };
      setLabels({ "📬 JobAlerts/NoJobs": noJobsLabelObj });

      const result = main.processOneEmail(thread, 1, 1);

      expect(result.jobCount).toBe(2);
      expect(global.addJobToSpreadsheet).toHaveBeenCalledTimes(2);
      const savedJobs = global.addJobToSpreadsheet.mock.calls.map(c => c[0]);
      const doubleUnknown = savedJobs.filter(j => j["Company"] === "Unknown" && j["Job Title"] === "Unknown Position");
      expect(doubleUnknown).toHaveLength(0);
    });

    it("keeps jobs where only one of company/title is Unknown", () => {
      const thread = makeThread();
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Unknown Position", _confidence: 0.9 },
        { Company: "Unknown", "Job Title": "Software Engineer", _confidence: 0.9 },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);
      setLabels({});

      const result = main.processOneEmail(thread, 1, 1);

      expect(result.jobCount).toBe(2);
    });
  });

  describe("processOneEmail confidence filtering", () => {
    function makeThreadWith(body) {
      return {
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => "Jobs"),
          getBody: jest.fn(() => body),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
      };
    }

    // drop-precheck-bump-throughput: confidence threshold lowered 0.5 -> 0.3.
    it("WRITES a job with confidence 0.4 (was dropped at the old 0.5 gate)", () => {
      const thread = makeThreadWith("<p>Apply</p>");
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev", _confidence: 0.4 },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const result = main.processOneEmail(thread, 1, 1);

      expect(result.jobCount).toBe(1);
      expect(global.addJobToSpreadsheet.mock.calls[0][0]["Company"]).toBe("Acme");
    });

    it("filters out jobs with confidence below 0.3 AND logs the dropped job", () => {
      const thread = makeThreadWith("<p>Apply</p>");
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev", _confidence: 0.8 },
        { Company: "Noise", "Job Title": "Ad", _confidence: 0.2 },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const result = main.processOneEmail(thread, 1, 1);

      expect(result.jobCount).toBe(1);
      expect(global.addJobToSpreadsheet).toHaveBeenCalledTimes(1);
      expect(global.addJobToSpreadsheet.mock.calls[0][0]["Company"]).toBe("Acme");

      // the confidence-dropped job is logged with its title/company/confidence
      const logged = global.Logger.log.mock.calls.map(c => String(c[0])).join("\n");
      expect(logged).toMatch(/Confidence-dropped/);
      expect(logged).toMatch(/Ad@Noise/);
    });

    it("keeps jobs where _confidence is exactly 0.3", () => {
      const thread = makeThreadWith("<p>Apply</p>");
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev", _confidence: 0.3 },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const result = main.processOneEmail(thread, 1, 1);

      expect(result.jobCount).toBe(1);
    });

    it("keeps jobs with no _confidence field (defaults pass)", () => {
      const thread = makeThreadWith("<p>Apply</p>");
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev" },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const result = main.processOneEmail(thread, 1, 1);

      expect(result.jobCount).toBe(1);
    });

    // confidence=null is coerced to 0 by JS comparison (null < 0.3 === true), so filtered out
    it("filters out jobs with confidence=null (null < 0.3 is true in JS)", () => {
      const thread = makeThreadWith("<p>Apply</p>");
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev", _confidence: null },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const result = main.processOneEmail(thread, 1, 1);

      // null coerces to 0, so null < 0.3 is true → job is rejected
      expect(result.jobCount).toBe(0);
    });

    it("filters out jobs with confidence=0", () => {
      const thread = makeThreadWith("<p>Apply</p>");
      global.extractJobDetailsSimple = jest.fn(() => [
        { Company: "Acme", "Job Title": "Dev", _confidence: 0 },
      ]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const result = main.processOneEmail(thread, 1, 1);

      expect(result.jobCount).toBe(0);
    });
  });

  describe("markEmailAsNoJobs rate-limit label cleanup", () => {
    // WARN-3: markEmailAsNoJobs must remove rate-limit label before archiving
    it("removes rate-limit label when present", () => {
      const noJobsLabelObj = { getName: jest.fn(() => "📬 JobAlerts/NoJobs") };
      const sourceLabelObj = { getName: jest.fn(() => "📬 JobAlerts") };
      const rateLimitLabelObj = { getName: jest.fn(() => "📬 JobAlerts/RateLimited") };

      setLabels({
        "📬 JobAlerts/NoJobs": noJobsLabelObj,
        "📬 JobAlerts": sourceLabelObj,
        "📬 JobAlerts/RateLimited": rateLimitLabelObj,
      });

      const thread = {
        addLabel: jest.fn(),
        removeLabel: jest.fn(),
        moveToArchive: jest.fn(),
      };

      main.markEmailAsNoJobs(thread);

      expect(thread.removeLabel).toHaveBeenCalledWith(rateLimitLabelObj);
      expect(thread.removeLabel).toHaveBeenCalledWith(sourceLabelObj);
      expect(thread.addLabel).toHaveBeenCalledWith(noJobsLabelObj);
      expect(thread.moveToArchive).toHaveBeenCalled();
    });

    it("does not error when rate-limit label is absent", () => {
      const noJobsLabelObj = { getName: jest.fn(() => "📬 JobAlerts/NoJobs") };
      setLabels({ "📬 JobAlerts/NoJobs": noJobsLabelObj });

      const thread = {
        addLabel: jest.fn(),
        removeLabel: jest.fn(),
        moveToArchive: jest.fn(),
      };

      expect(() => main.markEmailAsNoJobs(thread)).not.toThrow();
      expect(thread.removeLabel).not.toHaveBeenCalled();
    });
  });

  describe("processEmailBatch execution-budget deadline guard", () => {
    // fix-processjobemails-timeout: a wall-clock deadline guard must stop the
    // per-email loop once EXECUTION_BUDGET_MS elapses, deferring the remaining
    // threads to the next hourly run (they keep their source label, so the next
    // run picks them up). This prevents the Apps Script 6-min hard cap kill.
    function makeProcessableThread(id) {
      return {
        _id: id,
        getMessages: jest.fn(() => [{
          getSubject: jest.fn(() => `Jobs ${id}`),
          getBody: jest.fn(() => "<p>Apply</p>"),
          getDate: jest.fn(() => new Date()),
          getFrom: jest.fn(() => "jobs@example.com"),
        }]),
        addLabel: jest.fn(),
        removeLabel: jest.fn(),
        moveToArchive: jest.fn(),
      };
    }

    afterEach(() => {
      if (Date.now.mockRestore) Date.now.mockRestore();
    });

    it("stops the loop and defers remaining threads once the budget is exceeded", () => {
      global.extractJobDetailsSimple = jest.fn(() => [{ Company: "Acme", "Job Title": "Dev" }]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const threads = [
        makeProcessableThread("t1"),
        makeProcessableThread("t2"),
        makeProcessableThread("t3"),
      ];

      // Clock: start=0, then before t1 still 0 (under budget), before t2 jump
      // past the budget so the loop stops before processing t2 and t3.
      const budget = JOB_FINDER_CONFIG.EXECUTION_BUDGET_MS;
      const ticks = [0, 0, budget + 1, budget + 1];
      let tick = 0;
      jest.spyOn(Date, "now").mockImplementation(() => {
        const v = ticks[Math.min(tick, ticks.length - 1)];
        tick++;
        return v;
      });

      const result = main.processEmailBatch(threads);

      // Only t1 processed; t2 & t3 deferred (their getMessages never called).
      expect(threads[0].getMessages).toHaveBeenCalled();
      expect(threads[1].getMessages).not.toHaveBeenCalled();
      expect(threads[2].getMessages).not.toHaveBeenCalled();
      expect(result.processedCount).toBe(1);
      expect(result.deferredCount).toBe(2);
    });

    it("processes all threads when the budget is never exceeded", () => {
      global.extractJobDetailsSimple = jest.fn(() => [{ Company: "Acme", "Job Title": "Dev" }]);
      global.isValidJobListing = jest.fn(() => true);
      global.addJobToSpreadsheet = jest.fn(() => true);

      const threads = [makeProcessableThread("t1"), makeProcessableThread("t2")];

      jest.spyOn(Date, "now").mockImplementation(() => 0);

      const result = main.processEmailBatch(threads);

      expect(threads[0].getMessages).toHaveBeenCalled();
      expect(threads[1].getMessages).toHaveBeenCalled();
      expect(result.processedCount).toBe(2);
      expect(result.deferredCount).toBe(0);
    });
  });

  describe("getEmailThreadsToProcess custom label (WARN-1)", () => {
    it("uses custom source label value when set", () => {
      global.getJobFinderSourceLabel.mockImplementation(() => "MyCustomJobs");
      global.getJobFinderRateLimitLabel.mockImplementation(() => "MyCustomJobs/Queue");

      const threads = [{ id: "t1" }];
      setLabels({ "MyCustomJobs": { getThreads: jest.fn(() => threads) } });

      const result = main.getEmailThreadsToProcess();

      expect(result.success).toBe(true);
      expect(result.threads).toEqual(threads);
      // Confirm the source label lookup used the custom label, not the default
      expect(global.GmailApp.getUserLabelByName).toHaveBeenCalledWith("MyCustomJobs");
    });

    it("returns not-found error when custom label does not exist in Gmail", () => {
      global.getJobFinderSourceLabel.mockImplementation(() => "NonExistentLabel");
      setLabels({});

      const result = main.getEmailThreadsToProcess();

      expect(result.success).toBe(false);
      expect(result.message).toContain("NonExistentLabel");
    });
  });
});
