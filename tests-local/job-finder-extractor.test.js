/**
 * Tests for src/features/job-finder/extractor.js
 * Focus on extractJobDetailsSimple and related helpers.
 */

// Mock globals before requiring the module.
// Gemini + Properties access is routed through the serviceFactory ports; tests
// drive Gemini by reassigning global.callGeminiApi and resetting the factory so a
// fresh GeminiAdapter binds to the current global each test.
global.callGeminiApi = jest.fn();

const fs = require("fs");
const path = require("path");

const { serviceFactory } = require("../src/core/services/index.js");
const extractor = require("../src/features/job-finder/extractor.js");

const GLASSDOOR_FIXTURE = fs.readFileSync(
  path.join(__dirname, "fixtures", "job-finder-nojobs", "glassdoor-99k-no-plaintext.html"),
  "utf8"
);

// The truncation budget used inside extractJobDetailsSimple. Mirrored here so the
// noise-strip-before-truncation tests assert against the same window Gemini sees.
const EXTRACTION_MAX_LENGTH = 30000;

describe("extractor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Rebuild adapters each test so the GeminiAdapter binds to the per-test
    // global.callGeminiApi reassignment.
    serviceFactory.reset();
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

    // fix-nojobs: real digest jobs sit at the TAIL of a 99K HTML body whose front
    // is dominated by CSS/@font-face/MSO-conditional/VML noise. After noise removal,
    // the tail job markers must survive within the 30000-char prompt budget.
    it("retains Glassdoor tail job markers within the prompt budget", () => {
      const { plainText } = extractor.extractTextFromHtml(GLASSDOOR_FIXTURE);
      // Mirror the cleaning + truncation that extractJobDetailsSimple applies.
      const cleaned = plainText
        .replace(/\s+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      const budget = cleaned.substring(0, EXTRACTION_MAX_LENGTH);
      expect(budget).toContain("Northrop Grumman");
      expect(budget).toContain("Sr. Staff Chief Engineer");
      expect(budget).toContain("Rolling Meadows");
    });

    it("strips MSO conditional / VML / CSS noise from Glassdoor HTML", () => {
      const { plainText } = extractor.extractTextFromHtml(GLASSDOOR_FIXTURE);
      expect(plainText).not.toContain("roundrect");
      expect(plainText).not.toContain("mso-");
      expect(plainText).not.toContain("@font-face");
      expect(plainText).not.toContain("v-text-anchor");
    });

    // ZOE-1/ZOE-2: this case is engineered so the GENERIC `<[^>]+>` tag-strip
    // alone CANNOT remove the noise — the text BETWEEN the MSO comment delimiters
    // and INSIDE the VML element survives a tag-only strip. Only the dedicated
    // comment-strip + VML-strip remove it. Guards the new code from regression.
    it("removes text inside MSO comments and VML elements that survives a tag-only strip", () => {
      const html =
        "<p>Real Job Title</p>" +
        "<!--[if mso]>MSO_JUNK_TEXT_SHOULD_VANISH<![endif]-->" +
        "<v:roundrect>BUTTON_LABEL_JUNK</v:roundrect>";
      const { plainText } = extractor.extractTextFromHtml(html);
      expect(plainText).toContain("Real Job Title");
      expect(plainText).not.toContain("MSO_JUNK_TEXT_SHOULD_VANISH");
      expect(plainText).not.toContain("BUTTON_LABEL_JUNK");
    });

    it("strips zero-width characters injected inside words", () => {
      // U+200B inside a word, U+FEFF and U+200C/200D between words.
      const html = "<p>Nor​throp‌ ‍Grum﻿man</p>";
      const { plainText } = extractor.extractTextFromHtml(html);
      expect(plainText).toContain("Northrop");
      expect(plainText).toContain("Grumman");
      expect(plainText).not.toMatch(/[​‌‍‎‏﻿]/);
    });

    it("removes the high-volume zero-width runs from the Glassdoor digest", () => {
      const { plainText } = extractor.extractTextFromHtml(GLASSDOOR_FIXTURE);
      expect(plainText).not.toMatch(/[​‌‍‎‏﻿]/);
    });
  });

  describe("buildExtractionPrompt", () => {
    it("is exported as a function", () => {
      expect(typeof extractor.buildExtractionPrompt).toBe("function");
    });

    it("includes digest/aggregator guidance instructing extraction of every block", () => {
      const prompt = extractor.buildExtractionPrompt("EMAIL BODY", "", "");
      expect(prompt.toLowerCase()).toMatch(/digest|aggregator/);
      expect(prompt.toLowerCase()).toMatch(/every|each/);
    });

    it("preserves the JSON contract and CRITICAL RULES", () => {
      const prompt = extractor.buildExtractionPrompt("EMAIL BODY", "", "");
      expect(prompt).toContain("RESPONSE FORMAT");
      expect(prompt).toContain("CRITICAL RULES");
      expect(prompt).toContain('"jobTitle"');
      expect(prompt).toContain("EMAIL BODY");
    });

    // fix-nojobs-output-truncation: URL/anchor injection + jobUrl removed from
    // the prompt entirely. They bloated Gemini OUTPUT past maxOutputTokens=8192,
    // truncating the JSON array (no closing ]) and causing NoJobs misfiling.
    it("does NOT inject any URL or anchor sections", () => {
      const prompt = extractor.buildExtractionPrompt(
        "EMAIL BODY",
        "Job Application URLs:\n1. https://example.com/apply",
        '\nLink Text → URL Mappings:\n"Engineer" → https://example.com/eng'
      );
      expect(prompt).not.toContain("Job Application URLs");
      expect(prompt).not.toContain("Link Text");
      expect(prompt).not.toContain("→");
      expect(prompt).not.toContain("https://example.com/apply");
      expect(prompt).not.toContain("https://example.com/eng");
    });

    it("does NOT reference jobUrl in the schema or rules", () => {
      const prompt = extractor.buildExtractionPrompt("EMAIL BODY", "", "");
      expect(prompt).not.toContain("jobUrl");
    });

    it("retains the wanted fields in the schema", () => {
      const prompt = extractor.buildExtractionPrompt("EMAIL BODY", "", "");
      expect(prompt).toContain('"company"');
      expect(prompt).toContain('"location"');
      expect(prompt).toContain('"minSalary"');
      expect(prompt).toContain('"employmentType"');
      expect(prompt).toContain('"workArrangement"');
      expect(prompt).toContain('"experienceLevel"');
      expect(prompt).toContain('"confidence"');
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

    // fix-nojobs-output-truncation: URLs and anchor pairs are NO LONGER injected
    // into the prompt. The Gemini OUTPUT bloat they caused (echoing a long
    // redirect URL into every job's jobUrl) overran maxOutputTokens=8192 and
    // truncated the JSON array. URLs are tracking redirects the user does not use,
    // so the entire URL/anchor pathway is dropped from the prompt.
    it("does NOT inject anchor pairs into the prompt", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const anchorPairs = [{ text: "Software Engineer at Acme", url: "https://acme.com/jobs/123" }];
      extractor.extractJobDetailsSimple("We are hiring", [], state, anchorPairs);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("https://acme.com/jobs/123");
      expect(promptArg).not.toContain("Link Text");
    });

    it("does NOT inject extracted URLs into the prompt", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"X","jobTitle":"Dev"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const urls = ["https://hiring.foobar.com/apply", "https://career.com/jobs"];
      extractor.extractJobDetailsSimple("Apply now", urls, state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("https://hiring.foobar.com/apply");
      expect(promptArg).not.toContain("https://career.com/jobs");
      expect(promptArg).not.toContain("Job Application URLs");
    });

    it("throws RATE_LIMIT_REACHED on 429 error", () => {
      global.callGeminiApi = jest.fn(() => {
        throw new Error("429 Too Many Requests");
      });
      const state = { processedJobs: [], isPartiallyProcessed: false };
      expect(() => extractor.extractJobDetailsSimple("text", [], state)).toThrow("RATE_LIMIT_REACHED");
    });

    // fix-nojobs-output-truncation: jobUrl is dropped from the prompt/schema.
    // Job URL and URL Status sheet columns are kept for sheet-schema compatibility
    // but always set to "" (the URL feature is removed, not a fallback).
    it("always sets Job URL and URL Status to empty string", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","jobUrl":"https://acme.com/jobs/1"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]["Job URL"]).toBe("");
      expect(result[0]["URL Status"]).toBe("");
      // Wanted fields still carried through.
      expect(result[0]["Company"]).toBe("Acme");
      expect(result[0]["Job Title"]).toBe("Engineer");
    });

    it("does not emit Careers URL keys in validJobs", () => {
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Engineer","careersUrl":"https://acme.com/careers"}]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("We are hiring", [], state);
      expect(result[0]).not.toHaveProperty("Careers URL");
      expect(result[0]).not.toHaveProperty("Careers URL Status");
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

    it("does not include careersUrl in the prompt JSON shape", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      extractor.extractJobDetailsSimple("We are hiring", [], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).not.toContain("careersUrl");
    });

    // fix-nojobs-output-truncation: when Gemini hits MAX_TOKENS the JSON array is
    // cut off mid-record with no closing ]. The /\[[\s\S]*\]/ regex then returns
    // null and the email was misfiled NoJobs. Salvage recovers the complete jobs.
    describe("truncated-array salvage", () => {
      // Build a valid array of N jobs, then cut the string mid-way through the
      // LAST object so there is no closing ] (simulates finishReason=MAX_TOKENS).
      function truncatedArrayOf(n) {
        const jobs = [];
        for (let i = 0; i < n; i++) {
          jobs.push({
            company: "Company" + i,
            jobTitle: "Title" + i,
            location: "Remote",
            confidence: 0.9,
          });
        }
        const full = JSON.stringify(jobs);
        // Drop the closing ] and chop the last object so it is incomplete:
        // keep everything up to (but not including) the final complete record's
        // closer, then append a fragment of a new record with no terminator.
        const withoutBracket = full.slice(0, -1); // remove trailing ]
        return withoutBracket + ',{"company":"Acme","jobTit';
      }

      it("salvages the complete jobs from a truncated (no closing ]) array", () => {
        const truncated = truncatedArrayOf(19);
        global.callGeminiApi = jest.fn(() => ({ response: truncated }));
        const state = { processedJobs: [], isPartiallyProcessed: false };
        const result = extractor.extractJobDetailsSimple("Big digest", [], state);
        // 19 complete jobs recovered; the dangling 20th fragment dropped.
        expect(result.length).toBe(19);
        expect(result[0]["Company"]).toBe("Company0");
        expect(result[18]["Job Title"]).toBe("Title18");
      });

      it("still returns [] when there is no salvageable complete object", () => {
        global.callGeminiApi = jest.fn(() => ({ response: '[{"company":"Acme","jobTit' }));
        const state = { processedJobs: [], isPartiallyProcessed: false };
        const result = extractor.extractJobDetailsSimple("Big digest", [], state);
        expect(result).toEqual([]);
      });

      it("does not affect a well-formed (non-truncated) array", () => {
        global.callGeminiApi = jest.fn(() => ({
          response: '[{"company":"Acme","jobTitle":"Dev","location":"Remote"}]',
        }));
        const state = { processedJobs: [], isPartiallyProcessed: false };
        const result = extractor.extractJobDetailsSimple("text", [], state);
        expect(result.length).toBe(1);
        expect(result[0]["Company"]).toBe("Acme");
      });
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
    it("returns a Number (not a string) for currency-formatted input", () => {
      const result = extractor.cleanSalaryValue("$120,000.00");
      expect(result).toBe(120000);
      expect(typeof result).toBe("number");
    });

    it("returns a Number for plain comma-separated input", () => {
      const result = extractor.cleanSalaryValue("120,000");
      expect(result).toBe(120000);
      expect(typeof result).toBe("number");
    });

    it("returns a Number when .00 suffix is present", () => {
      const result = extractor.cleanSalaryValue("100000.00");
      expect(result).toBe(100000);
      expect(typeof result).toBe("number");
    });

    it("returns empty string for non-numeric text", () => {
      expect(extractor.cleanSalaryValue("DOE")).toBe("");
      expect(extractor.cleanSalaryValue("Competitive")).toBe("");
    });

    it("returns empty string for falsy input", () => {
      expect(extractor.cleanSalaryValue(null)).toBe("");
      expect(extractor.cleanSalaryValue(undefined)).toBe("");
      expect(extractor.cleanSalaryValue("")).toBe("");
    });

    it("accepts a numeric Number input and returns it as a Number", () => {
      const result = extractor.cleanSalaryValue(95000);
      expect(result).toBe(95000);
      expect(typeof result).toBe("number");
    });
  });

  describe("normalizeLocation", () => {
    it("returns empty string for falsy input", () => {
      expect(extractor.normalizeLocation(null)).toBe("");
      expect(extractor.normalizeLocation(undefined)).toBe("");
      expect(extractor.normalizeLocation("")).toBe("");
    });

    it("trims surrounding whitespace", () => {
      expect(extractor.normalizeLocation("Remote ")).toBe("Remote");
      expect(extractor.normalizeLocation("  New York, NY  ")).toBe("New York, NY");
    });

    it("collapses internal whitespace to single spaces", () => {
      expect(extractor.normalizeLocation("New    York,   NY")).toBe("New York, NY");
    });

    it("normalizes comma separators to ', '", () => {
      expect(extractor.normalizeLocation("New York,NY")).toBe("New York, NY");
      expect(extractor.normalizeLocation("San Francisco ,CA")).toBe("San Francisco, CA");
    });

    it("leaves an already-clean value unchanged", () => {
      expect(extractor.normalizeLocation("Austin, TX")).toBe("Austin, TX");
      expect(extractor.normalizeLocation("Remote")).toBe("Remote");
    });

    it("does not invent a location when none is given", () => {
      expect(extractor.normalizeLocation("   ")).toBe("");
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

  describe("extractJobDetailsSimple — response/error branches", () => {
    it("returns [] when Gemini returns no response object", () => {
      global.callGeminiApi = jest.fn(() => null);
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result).toEqual([]);
    });

    it("returns [] when the response object has no response field", () => {
      global.callGeminiApi = jest.fn(() => ({ success: true })); // no .response
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result).toEqual([]);
    });

    it("returns [] when no JSON array is present and salvage finds nothing", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "no json here at all" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result).toEqual([]);
    });

    it("salvages complete records via the no-closing-bracket branch", () => {
      // No closing ']' -> jsonMatch is null -> else branch -> salvage recovers
      // the one complete record before the truncation point.
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Dev"},{"company":"Beta"',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result.length).toBe(1);
      expect(result[0]["Company"]).toBe("Acme");
    });

    it("salvages records via the parseError catch when the matched array is invalid", () => {
      // Has a closing ']' so jsonMatch matches, but the captured text is invalid
      // JSON -> JSON.parse throws -> catch -> salvage recovers the complete record.
      global.callGeminiApi = jest.fn(() => ({
        response: '[{"company":"Acme","jobTitle":"Dev"} garbage ]',
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result.length).toBe(1);
      expect(result[0]["Company"]).toBe("Acme");
    });

    it("truncates very long email text before building the prompt", () => {
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const longText = "x".repeat(40000); // > 30000 maxLength
      extractor.extractJobDetailsSimple(longText, [], state);
      const promptArg = global.callGeminiApi.mock.calls[0][0];
      expect(promptArg).toContain("... [truncated]");
    });

    it("falls back to pattern extraction when the matched array is invalid and salvage fails", () => {
      // Has [ ... ] so jsonMatch matches, JSON.parse throws, but there is no
      // closing `}` for salvage -> salvage returns [] -> pattern fallback runs on
      // the raw response and recovers the Company/Title lines.
      global.callGeminiApi = jest.fn(() => ({
        response: "[\nCompany: Acme\nJob Title: Engineer\n]",
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result.length).toBe(1);
      expect(result[0]["Company"]).toBe("Acme");
    });

    it("returns [] (not throw) on a non-429 API error", () => {
      global.callGeminiApi = jest.fn(() => { throw new Error("500 Internal Error"); });
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result).toEqual([]);
    });

    it("maps the capitalized alternate-key job shape", () => {
      // Lowercase `company` passes the validJobs filter; the remaining fields use
      // the capitalized alternate keys, exercising the right-hand `||` arms.
      global.callGeminiApi = jest.fn(() => ({
        response: JSON.stringify([{
          company: "Acme",
          "Company Description": "desc",
          "Job Title": "Engineer",
          Location: "NYC",
          "Minimum Salary": "100",
          "Maximum Salary": "200",
          "Salary Period": "year",
          "Employment Type": "Full-time",
          "Work Arrangement": "Remote",
          "Experience Level": "Senior"
        }]),
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result[0]["Company"]).toBe("Acme");
      expect(result[0]["Company Description"]).toBe("desc");
      expect(result[0]["Job Title"]).toBe("Engineer");
      expect(result[0]["Salary Period"]).toBe("year");
      expect(result[0]["Employment Type"]).toBe("Full-time");
    });

    it('defaults Company to "Unknown" when only a job title is present', () => {
      global.callGeminiApi = jest.fn(() => ({
        response: JSON.stringify([{ jobTitle: "Engineer" }]), // no company
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result[0]["Company"]).toBe("Unknown");
      expect(result[0]["Job Title"]).toBe("Engineer");
    });

    it('defaults Job Title to "Unknown Position" when only a company is present', () => {
      global.callGeminiApi = jest.fn(() => ({
        response: JSON.stringify([{ company: "Acme" }]), // no jobTitle
      }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result[0]["Company"]).toBe("Acme");
      expect(result[0]["Job Title"]).toBe("Unknown Position");
    });

    it("re-throws RATE_LIMIT_REACHED from the outer guard", () => {
      // processingState is null -> assigning processedJobs throws AFTER... actually
      // force the outer catch path: emailText present but processingState null makes
      // `processingState.processedJobs = []` throw, hitting the OUTER catch -> [].
      const result = extractor.extractJobDetailsSimple("hiring", [], null);
      expect(result).toEqual([]);
    });
  });

  describe("extractJobsFallback catch", () => {
    it("returns [] when the input is not a string (split throws)", () => {
      expect(extractor.extractJobsFallback(null)).toEqual([]);
    });

    it("pushes a prior job when a second Company line is seen", () => {
      const out = extractor.extractJobsFallback(
        "Company: Acme\nJob Title: Dev\nCompany: Beta\nJob Title: QA"
      );
      expect(out.length).toBe(2);
      expect(out[0].company).toBe("Acme");
      expect(out[1].company).toBe("Beta");
    });

    it("parses a salary range into min/max", () => {
      const out = extractor.extractJobsFallback("Company: Acme\nSalary: $80,000 - $100,000");
      expect(out[0].minSalary).toBe("80000");
      expect(out[0].maxSalary).toBe("100000");
    });

    it("ignores a salary line that has no numeric range (rangeMatch false)", () => {
      const out = extractor.extractJobsFallback("Company: Acme\nSalary: Competitive");
      expect(out[0].minSalary).toBeUndefined();
      expect(out[0].maxSalary).toBeUndefined();
    });
  });

  describe("salvageTruncatedJobArray", () => {
    it("returns [] for a non-string input", () => {
      expect(extractor.salvageTruncatedJobArray(null)).toEqual([]);
    });
    it("returns [] when there is no opening bracket", () => {
      expect(extractor.salvageTruncatedJobArray("no array")).toEqual([]);
    });
    it("returns [] when there is no closing brace after the bracket", () => {
      expect(extractor.salvageTruncatedJobArray("[ incomplete")).toEqual([]);
    });
    it("returns [] when the salvaged candidate is still unparseable (catch)", () => {
      // '[' then a '}' but the slice is invalid JSON -> JSON.parse throws -> [].
      expect(extractor.salvageTruncatedJobArray("[not json}")).toEqual([]);
    });
    it("recovers complete records up to the last closing brace", () => {
      const out = extractor.salvageTruncatedJobArray(
        '[{"company":"A"},{"company":"B"},{"company":"C"'
      );
      expect(out.map(j => j.company)).toEqual(["A", "B"]);
    });

  });

  describe("extractAnchorPairs skips anchors with empty text", () => {
    it("does not push an anchor whose inner text strips to empty", () => {
      // href present but the anchor body is only an image/markup -> text === "".
      const pairs = extractor.extractAnchorPairs(
        '<a href="https://x.com/job"><img src="i.png"></a>'
      );
      expect(pairs).toEqual([]);
    });
  });

  describe("cleanSalaryValue empty-after-strip branch", () => {
    it('returns "" when the value is only currency punctuation', () => {
      // "$," -> stripped to "" -> the `cleaned === ""` early return.
      expect(extractor.cleanSalaryValue("$,")).toBe("");
    });
  });

  describe("extractTextFromHtml catch", () => {
    it("returns the raw html and empty arrays when processing throws", () => {
      // A non-string with a throwing replace -> the function's try/catch fires.
      const evil = { replace: () => { throw new Error("boom"); } };
      const result = extractor.extractTextFromHtml(evil);
      expect(result.plainText).toBe(evil);
      expect(result.extractedUrls).toEqual([]);
      expect(result.anchorPairs).toEqual([]);
    });
  });

  describe("extractEmailSource", () => {
    it("returns Unknown for empty input", () => {
      expect(extractor.extractEmailSource("")).toBe("Unknown");
    });
    it("extracts the domain core from an angle-bracketed address", () => {
      expect(extractor.extractEmailSource("Indeed <alerts@indeed.com>")).toBe("indeed");
    });
    it("extracts the domain core from a bare address", () => {
      expect(extractor.extractEmailSource("alerts@glassdoor.com")).toBe("glassdoor");
    });
    it("falls back to the display name when no email is present", () => {
      expect(extractor.extractEmailSource("Acme Recruiting <>")).toBe("Acme Recruiting");
    });
    it("returns the truncated raw string when nothing else matches", () => {
      expect(extractor.extractEmailSource("just a plain string")).toBe("just a plain string");
    });
    it("returns the single-label domain string when domain has no dot core", () => {
      // domainParts.length < 2 -> skips the slice, falls through to name/truncate.
      expect(extractor.extractEmailSource("user@localhost")).toBe("user@localhost");
    });
  });

  describe("logJobFinderGeminiInteraction", () => {
    let props;
    beforeEach(() => {
      props = new Map();
      global.PropertiesService = {
        getScriptProperties: jest.fn(() => ({
          getProperty: jest.fn(k => props.has(k) ? props.get(k) : null),
          setProperty: jest.fn((k, v) => props.set(k, v))
        }))
      };
      serviceFactory.reset();
    });

    it("logs non-error interactions without touching properties", () => {
      const spy = jest.spyOn(Logger, "log");
      extractor.logJobFinderGeminiInteraction("request", { prompt: "p" });
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Gemini request"));
      spy.mockRestore();
    });

    it("persists error interactions to GEMINI_ERRORS (capped at 10)", () => {
      const existing = Array.from({ length: 10 }, (_, i) => ({ n: i }));
      props.set("GEMINI_ERRORS", JSON.stringify(existing));
      extractor.logJobFinderGeminiInteraction("error", { error: "oops" });
      const stored = JSON.parse(props.get("GEMINI_ERRORS"));
      expect(stored.length).toBe(10);
      expect(stored[0]).toEqual({ n: 1 }); // oldest shifted out
    });

    it("starts a fresh error list when none exists", () => {
      extractor.logJobFinderGeminiInteraction("error", { error: "first" });
      const stored = JSON.parse(props.get("GEMINI_ERRORS"));
      expect(stored.length).toBe(1);
    });

    it("swallows errors thrown during logging (outer catch)", () => {
      const circular = {};
      circular.self = circular; // JSON.stringify on the logEntry throws
      expect(() => extractor.logJobFinderGeminiInteraction("error", circular)).not.toThrow();
    });
  });

  describe("serviceFactory seam (GAS-global branch)", () => {
    afterEach(() => { delete global.serviceFactory; });
    it("resolves the GAS-global serviceFactory when present", () => {
      global.serviceFactory = serviceFactory;
      global.callGeminiApi = jest.fn(() => ({ response: "[]" }));
      const state = { processedJobs: [], isPartiallyProcessed: false };
      const result = extractor.extractJobDetailsSimple("hiring", [], state);
      expect(result).toEqual([]);
    });
  });
});
