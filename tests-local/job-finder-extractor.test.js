/**
 * Tests for src/features/job-finder/extractor.js
 * Focus on extractJobDetailsSimple and related helpers.
 */

// Mock globals before requiring the module
global.callGeminiApi = jest.fn();

const extractor = require("../src/features/job-finder/extractor.js");

describe("isJobListingEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns true when Gemini responds YES", () => {
    global.callGeminiApi = jest.fn(() => ({ response: "YES" }));
    expect(extractor.isJobListingEmail("We are hiring engineers")).toBe(true);
  });

  it("returns true when response is YES with surrounding whitespace", () => {
    global.callGeminiApi = jest.fn(() => ({ response: "  Yes\n" }));
    expect(extractor.isJobListingEmail("some body")).toBe(true);
  });

  it("returns false when Gemini responds NO", () => {
    global.callGeminiApi = jest.fn(() => ({ response: "NO" }));
    expect(extractor.isJobListingEmail("Newsletter content")).toBe(false);
  });

  it("returns false when Gemini returns null response", () => {
    global.callGeminiApi = jest.fn(() => null);
    expect(extractor.isJobListingEmail("some body")).toBe(false);
  });

  it("truncates body to 2000 chars before sending", () => {
    global.callGeminiApi = jest.fn(() => ({ response: "YES" }));
    const longBody = "x".repeat(5000);
    extractor.isJobListingEmail(longBody);
    const promptArg = global.callGeminiApi.mock.calls[0][0];
    // The prompt includes the 2000-char snippet; the original 5000-char body must be truncated
    expect(promptArg.length).toBeLessThan(5000 + 200); // 200 chars of prompt overhead
    expect(promptArg).toContain("x".repeat(100)); // snippet is present
  });
});

describe("extractor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("extractAnchorPairs", () => {
    it("extracts text and URL from anchor tags", () => {
      const html = '<a href="https://example.com/job/1">Software Engineer</a>';
      const pairs = extractor.extractAnchorPairs(html);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].text).toBe("Software Engineer");
      expect(pairs[0].url).toBe("https://example.com/job/1");
    });

    it("strips inner HTML tags from anchor text", () => {
      const html = '<a href="https://acme.com/apply"><strong>Product Manager</strong></a>';
      const pairs = extractor.extractAnchorPairs(html);
      expect(pairs[0].text).toBe("Product Manager");
    });

    it("returns empty array for HTML with no anchors", () => {
      expect(extractor.extractAnchorPairs("<p>No links here</p>")).toEqual([]);
    });

    it("returns empty array for null/empty input", () => {
      expect(extractor.extractAnchorPairs(null)).toEqual([]);
      expect(extractor.extractAnchorPairs("")).toEqual([]);
    });

    it("handles multiple anchor tags", () => {
      const html = '<a href="https://a.com">Job A</a><a href="https://b.com">Job B</a>';
      const pairs = extractor.extractAnchorPairs(html);
      expect(pairs).toHaveLength(2);
      expect(pairs[0].text).toBe("Job A");
      expect(pairs[1].text).toBe("Job B");
    });
  });

  describe("extractTextFromHtml", () => {
    it("extracts plain text and URLs from HTML", () => {
      const html = '<p>Hello</p><a href="https://example.com">link</a>';
      const result = extractor.extractTextFromHtml(html);
      expect(result.plainText).toContain("Hello");
      expect(result.extractedUrls).toContain("https://example.com");
    });

    it("returns anchorPairs in the result", () => {
      const html = '<a href="https://jobs.acme.com/123">Senior Engineer</a>';
      const result = extractor.extractTextFromHtml(html);
      expect(result.anchorPairs).toBeDefined();
      expect(result.anchorPairs.length).toBeGreaterThanOrEqual(1);
      expect(result.anchorPairs[0].text).toBe("Senior Engineer");
      expect(result.anchorPairs[0].url).toBe("https://jobs.acme.com/123");
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

    it("includes new fields in extraction result", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","location":"Remote","employmentType":"Full-time","workArrangement":"Remote","experienceLevel":"Mid","confidence":0.9}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result.length).toBe(1);
      expect(result[0]["Employment Type"]).toBe("Full-time");
      expect(result[0]["Work Arrangement"]).toBe("Remote");
      expect(result[0]["Experience Level"]).toBe("Mid");
      expect(result[0]["_confidence"]).toBe(0.9);
    });

    it("defaults new fields to Unknown when absent from Gemini response", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Dev"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]["Employment Type"]).toBe("Unknown");
      expect(result[0]["Work Arrangement"]).toBe("Unknown");
      expect(result[0]["Experience Level"]).toBe("Unknown");
    });

    it("defaults _confidence to 1.0 when absent from Gemini response", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Dev"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]["_confidence"]).toBe(1.0);
    });

    it("includes anchor pairs in the prompt when provided", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const anchorPairs = [{ text: "Software Engineer at Acme", url: "https://acme.com/jobs/123" }];
      extractor.extractJobDetailsSimple("We are hiring", [], state, anchorPairs);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("Software Engineer at Acme");
      expect(promptArg).toContain("https://acme.com/jobs/123");
    });

    // WARN-14 regression: anchor filter must not strip career.com or director.jobs anchors
    it("keeps career.com anchor pairs (WARN-14 anchor regression)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const anchorPairs = [{ text: "Director of Engineering", url: "https://career.com/jobs/dir-eng" }];
      extractor.extractJobDetailsSimple("We are hiring", [], state, anchorPairs);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("https://career.com/jobs/dir-eng");
    });

    it("filters r.example.com anchor pairs (tracking subdomain)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const anchorPairs = [
        { text: "Apply Here", url: "https://r.example.com/redirect?url=jobs" },
        { text: "Real Job", url: "https://jobs.acme.com/123" },
      ];
      extractor.extractJobDetailsSimple("We are hiring", [], state, anchorPairs);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("r.example.com");
      expect(promptArg).toContain("https://jobs.acme.com/123");
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

    // WARN-14 regression: 'r.' was too broad and matched career.com, director.jobs etc.
    it("does NOT filter out career.com URLs (WARN-14 regression)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      extractor.extractJobDetailsSimple("Apply now", ["https://career.com/jobs"], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("https://career.com/jobs");
    });

    it("does NOT filter out director.jobs URLs (WARN-14 regression)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      extractor.extractJobDetailsSimple("Apply now", ["https://director.jobs/apply"], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("https://director.jobs/apply");
    });

    // WARN-15: tracking subdomains must be filtered via hostname-anchored regex
    it("filters out click.example.com tracking URLs (WARN-15)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      extractor.extractJobDetailsSimple("Apply now", ["https://click.example.com/track"], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("click.example.com");
    });

    it("filters out r.example.com redirect URLs (WARN-14/15 combined)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      extractor.extractJobDetailsSimple("Apply now", ["https://r.example.com/redirect"], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("r.example.com");
    });

    // WARN-18: go. and email. subdomain anchor filter
    it("filters out go.example.com anchor pair (tracking subdomain)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const anchorPairs = [{ text: "Apply Here", url: "https://go.example.com/link" }];
      extractor.extractJobDetailsSimple("We are hiring", [], state, anchorPairs);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("go.example.com");
    });

    it("filters out email.example.com anchor pair (tracking subdomain)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const anchorPairs = [{ text: "View Job", url: "https://email.example.com/track" }];
      extractor.extractJobDetailsSimple("We are hiring", [], state, anchorPairs);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("email.example.com");
    });

    it("does NOT filter anchor pair with 'email' in path (WARN-18 regression)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const anchorPairs = [{ text: "Email Marketing Manager", url: "https://jobs.com/email-marketing" }];
      extractor.extractJobDetailsSimple("We are hiring", [], state, anchorPairs);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("https://jobs.com/email-marketing");
    });

    // WARN-19: go. URL noise filter
    it("filters out go.example.com redirect URL (WARN-19)", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      extractor.extractJobDetailsSimple("Apply now", ["https://go.example.com/redirect"], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("go.example.com");
    });

    it("throws RATE_LIMIT_REACHED on 429 error", () => {
      global.callGeminiApi = jest.fn(() => {
        throw new Error("429 Too Many Requests");
      });
      const state = { processedJobs: [], isPartiallyProcessed: false };
      expect(() => extractor.extractJobDetailsSimple("text", [], state)).toThrow("RATE_LIMIT_REACHED");
    });

    it("sets URL Status to empty string when jobUrl is absent", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","jobUrl":""}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]["URL Status"]).toBe("");
    });

    it("sets URL Status to Found when jobUrl is present", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","jobUrl":"https://acme.com/jobs/1"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]["URL Status"]).toBe("Found");
    });

    it("sets Careers URL Status to empty string when careersUrl is absent", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","careersUrl":""}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]["Careers URL Status"]).toBe("");
    });

    it("location prompt instruction uses City/State or City/Country or Remote format", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      extractor.extractJobDetailsSimple("We are hiring", [], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("City, State");
      expect(promptArg).toContain("City, Country");
      expect(promptArg).toContain("Remote");
      expect(promptArg).not.toContain("N/A");
      // WARN-13: positive assertion — prompt must specify exactly the three allowed formats
      expect(promptArg).toMatch(/City, State.*City, Country.*Remote|City, Country.*City, State.*Remote/s);
    });

    it("sets Careers URL Status to Found when careersUrl is present", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","careersUrl":"https://acme.com/careers"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]["Careers URL Status"]).toBe("Found");
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
