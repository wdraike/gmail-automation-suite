/**
 * Tests for src/features/job-finder/extractor.js
 * Focus on extractJobDetailsSimple and related helpers.
 */

// Mock globals before requiring the module
global.callGeminiApi = jest.fn();

const extractor = require("../src/features/job-finder/extractor.js");

describe("extractor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("extractTextFromHtml", () => {
    it("extracts plain text and URLs from HTML", () => {
      const html = '<p>Hello</p><a href="https://example.com">link</a>';
      const result = extractor.extractTextFromHtml(html);
      expect(result.plainText).toContain("Hello");
      expect(result.extractedUrls).toContain("https://example.com");
    });

    it("removes script and style tags", () => {
      const html = '<style>body{}</style><script>alert(1)</script><p>Keep me</p>';
      const result = extractor.extractTextFromHtml(html);
      expect(result.plainText).not.toContain("body");
      expect(result.plainText).not.toContain("alert");
      expect(result.plainText).toContain("Keep me");
    });

    it("decodes common HTML entities", () => {
      const result = extractor.extractTextFromHtml("&#39;test&#39;&nbsp;a");
      expect(result.plainText).toContain("'test'");
      expect(result.plainText).toContain(" a");
    });
  });

  describe("extractJobDetailsSimple", () => {
    it("returns empty array for empty email text", () => {
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("", [], state);
      expect(result).toEqual([]);
      expect(state.processedJobs).toEqual([]);
    });

    it("parses JSON array from Gemini response", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","location":"Remote"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result.length).toBe(1);
      expect(result[0]["Company"]).toBe("Acme");
      expect(result[0]["Job Title"]).toBe("Engineer");
    });

    it("filters out tracking and social URLs", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"X","jobTitle":"Dev"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const urls = [
        "https://track.foobar.com/open",
        "https://linkedin.com/in/foo",
        "https://hiring.foobar.com/apply",
        "https://unsubscribe.foobar.com",
      ];
      extractor.extractJobDetailsSimple("Apply now", urls, state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("https://hiring.foobar.com/apply");
      expect(promptArg).not.toContain("track.foobar.com");
      expect(promptArg).not.toContain("linkedin.com");
      expect(promptArg).not.toContain("unsubscribe");
    });

    it("throws RATE_LIMIT_REACHED on 429 error", () => {
      global.callGeminiApi = jest.fn(() => {
        throw new Error("429 Too Many Requests");
      });
      const state = { processedJobs: [], isPartiallyProcessed: false };
      expect(() => extractor.extractJobDetailsSimple("text", [], state)).toThrow("RATE_LIMIT_REACHED");
    });
  });

  describe("extractJobsFallback", () => {
    it("extracts jobs from plain text patterns", () => {
      const text = "Company: Acme Inc\nJob Title: Engineer\nLocation: Remote\nCompany: Beta\nTitle: Manager";
      const result = extractor.extractJobsFallback(text);
      expect(result.length).toBe(2);
      expect(result[0].company).toBe("Acme Inc");
      expect(result[0].jobTitle).toBe("Engineer");
      expect(result[1].company).toBe("Beta");
    });

    it("parses salary range", () => {
      const text = "Company: Acme\nSalary: $100,000 - $150,000";
      const result = extractor.extractJobsFallback(text);
      expect(result[0].minSalary).toBe("100000");
      expect(result[0].maxSalary).toBe("150000");
    });

    it("returns empty array for unparseable text", () => {
      const result = extractor.extractJobsFallback("no job info here");
      expect(result).toEqual([]);
    });
  });

  describe("cleanSalaryValue", () => {
    it("removes currency symbols and commas", () => {
      expect(extractor.cleanSalaryValue("$120,000")).toBe("120000");
    });

    it("trims .00 suffix", () => {
      expect(extractor.cleanSalaryValue("100000.00")).toBe("100000");
    });

    it("returns empty string for falsy input", () => {
      expect(extractor.cleanSalaryValue(null)).toBe("");
      expect(extractor.cleanSalaryValue("")).toBe("");
    });
  });

  describe("inferCareersUrl", () => {
    it("returns base careers URL when job URL contains careers path", () => {
      expect(extractor.inferCareersUrl("https://example.com/careers/job/123")).toBe("https://example.com/careers");
    });

    it("returns base jobs URL when job URL contains jobs path", () => {
      expect(extractor.inferCareersUrl("https://example.com/jobs/123")).toBe("https://example.com/jobs");
    });

    it("returns empty string for falsy input", () => {
      expect(extractor.inferCareersUrl("")).toBe("");
      expect(extractor.inferCareersUrl(null)).toBe("");
    });
  });

  describe("isValidJobListing", () => {
    it("returns true when company is known", () => {
      expect(extractor.isValidJobListing({ Company: "Acme" })).toBe(true);
    });

    it("returns true when job title is known", () => {
      expect(extractor.isValidJobListing({ "Job Title": "Engineer" })).toBe(true);
    });

    it("returns falsy for empty job", () => {
      expect(extractor.isValidJobListing({})).toBeFalsy();
      expect(extractor.isValidJobListing({ Company: "Unknown" })).toBeFalsy();
    });
  });
});
