/**
 * Job Finder Extractor Module
 * Handles extraction of job details from email content using Gemini API
 *
 * Platform access (Gemini, Properties) is routed exclusively through
 * src/core/services ports via the serviceFactory (hexagonal-ports-refactor).
 */

/**
 * Resolve the shared serviceFactory singleton (global in Apps Script, required in Node).
 */
function _exServiceFactory() {
  if (typeof serviceFactory !== 'undefined') {
    return serviceFactory;
  }
  /* istanbul ignore else -- in Node `require` is always defined; the else (defensive throw) is unreachable in both Node and GAS. */
  if (typeof require !== 'undefined') {
    return require('../../core/services/index.js').serviceFactory;
  } else {
    throw new Error('serviceFactory is not available');
  }
}

function _exGemini() {
  return _exServiceFactory().getGeminiAdapter();
}

function _exProps() {
  return _exServiceFactory().getPropertiesAdapter();
}

/**
 * Extract anchor text/URL pairs from raw HTML before stripping tags.
 * Returns an array of { text, url } objects for job-title-to-URL matching.
 * @param {string} html - Raw HTML content
 * @returns {Array<{text: string, url: string}>}
 */
function extractAnchorPairs(html) {
  if (!html) return [];
  const pairs = [];
  const anchorRegex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRegex.exec(html)) !== null) {
    const url = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (url && text) pairs.push({ text, url });
  }
  return pairs;
}

/**
 * Build the Gemini extraction prompt.
 *
 * Extracted from extractJobDetailsSimple so the prompt text is unit-testable
 * without exercising the live Gemini path.
 *
 * fix-nojobs-output-truncation: URL/anchor injection and the `jobUrl` schema
 * field were REMOVED. Echoing a long tracking-redirect URL into every job's
 * `jobUrl` bloated the Gemini OUTPUT past maxOutputTokens=8192 on large digests,
 * truncating the JSON array (no closing `]`) and causing NoJobs misfiling. The
 * user does not use these redirect URLs, so the entire URL pathway is dropped.
 * The legacy `urlSection`/`anchorSection` parameters are accepted but ignored
 * for signature stability with existing callers.
 *
 * @param {string} textToProcess - Cleaned/truncated email body
 * @param {string} [_urlSection] - Ignored (URL injection removed).
 * @param {string} [_anchorSection] - Ignored (anchor injection removed).
 * @returns {string} The full prompt string
 */
function buildExtractionPrompt(textToProcess, _urlSection, _anchorSection) {
  return `You are a job listing extraction assistant. Extract ALL job listings from the email below.

RESPONSE FORMAT - Return ONLY a valid JSON array with NO additional text:
[
  {
    "company": "Company Name",
    "companyDescription": "Brief description if mentioned, otherwise empty string",
    "jobTitle": "Exact Job Title",
    "location": "City, State (US) or City, Country (international) or Remote — no other values",
    "minSalary": "",
    "maxSalary": "",
    "salaryPeriod": "",
    "employmentType": "Full-time|Part-time|Contract|Internship|Unknown",
    "workArrangement": "Remote|Hybrid|Onsite|Unknown",
    "experienceLevel": "Entry|Mid|Senior|Lead/Principal|Unknown",
    "confidence": 0.0
  }
]

DIGEST / AGGREGATOR EMAILS:
This email may be a job-alert DIGEST from an aggregator (Glassdoor, Indeed, LinkedIn,
Google Alerts). Digests list MANY roles as repeated blocks, each typically containing:
Title / Company / Location / "via <Source>" / Date posted / Employment type.
Extract EVERY block as a SEPARATE job — do not stop after the first one and do not
merge multiple roles into a single entry. Treat each repeated block as its own listing.

CRITICAL RULES:
1. Return ONLY the JSON array - NO markdown, NO explanations, NO code blocks
2. If no jobs found, return: []
3. Extract ALL jobs from the email
4. Leave salary fields as empty strings if not mentioned
5. confidence: number 0.0-1.0 — how confident you are this row is a real job listing (not an ad or filler)

EMAIL CONTENT:
${textToProcess}

JSON ARRAY:`;
}

/**
 * Extract job details directly from email text without chunking
 * @param {string} emailText - The full email text
 * @param {string[]} extractedUrls - All URLs extracted from the email
 * @param {object} processingState - State tracking for partial processing
 * @param {Array<{text: string, url: string}>} [anchorPairs] - Anchor text/URL pairs from raw HTML
 * @returns {Object[]} Array of job objects
 */
function extractJobDetailsSimple(emailText, extractedUrls, processingState, anchorPairs) {
  try {
    // Validate email text
    if (!emailText) {
      Logger.log("Error: emailText is undefined or empty");
      processingState.processedJobs = [];
      processingState.isPartiallyProcessed = false;
      return [];
    }

    // Initialize the processing state
    processingState.processedJobs = [];
    processingState.isPartiallyProcessed = false;

    // Clean and prepare the email text
    const cleanedText = emailText
      .replace(/\s+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // If text is too long, take the most relevant portion
    const maxLength = 30000;
    const textToProcess = cleanedText.length > maxLength
      ? cleanedText.substring(0, maxLength) + "... [truncated]"
      : cleanedText;

    // fix-nojobs-output-truncation: URL/anchor extraction is no longer injected
    // into the prompt. The tracking-redirect URLs the user does not use were
    // echoed into every job's jobUrl, bloating Gemini OUTPUT past
    // maxOutputTokens=8192 and truncating the JSON array. The extractedUrls and
    // anchorPairs parameters are kept on the signature for caller stability but
    // are intentionally NOT passed into the prompt.

    // Prepare the prompt for Gemini (no URL/anchor injection).
    const prompt = buildExtractionPrompt(textToProcess);

    try {
      // Call Gemini API
      const geminiResponse = _exGemini().call(prompt, "job_extraction");
      
      if (!geminiResponse || !geminiResponse.response) {
        Logger.log("No response from Gemini API");
        return [];
      }

      // Parse the response
      let jobs = [];
      try {
        Logger.log(`Gemini response type: ${typeof geminiResponse.response}`);
        /* istanbul ignore next -- `geminiResponse.response` is guaranteed truthy here: the `!geminiResponse.response` guard above returns [] before this point, so the `: 'null'` ternary arms are unreachable diagnostic-log defaults. */
        Logger.log(`Gemini response length: ${geminiResponse.response ? geminiResponse.response.length : 'null'}`);
        /* istanbul ignore next */
        Logger.log(`First 200 chars of response: ${geminiResponse.response ? geminiResponse.response.substring(0, 200) : 'null'}`);

        // Extract JSON from the response
        const jsonMatch = geminiResponse.response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          Logger.log(`Found JSON match, length: ${jsonMatch[0].length}`);
          jobs = JSON.parse(jsonMatch[0]);
          Logger.log(`Parsed ${jobs.length} jobs from JSON`);
        } else {
          // No closing `]` — the response was almost certainly truncated by
          // Gemini hitting maxOutputTokens (finishReason=MAX_TOKENS). Try to
          // salvage the complete records before giving up (see salvage note).
          Logger.log("No JSON array found in Gemini response — attempting truncated-array salvage");
          jobs = salvageTruncatedJobArray(geminiResponse.response);
          if (jobs.length === 0) {
            Logger.log("Salvage found no complete jobs");
            Logger.log(`Full response: ${geminiResponse.response}`);
            return [];
          }
        }
      } catch (parseError) {
        // JSON.parse can throw when the matched array is itself truncated
        // (the greedy /\[[\s\S]*\]/ may capture a stray `]` inside a string but
        // leave the array structurally invalid). Attempt salvage before the
        // pattern-based fallback.
        Logger.log(`Error parsing Gemini response: ${parseError} — attempting truncated-array salvage`);
        jobs = salvageTruncatedJobArray(geminiResponse.response);
        if (jobs.length > 0) {
          Logger.log(`Salvage recovered ${jobs.length} jobs from truncated response`);
        } else {
          Logger.log(`Response that failed to parse: ${geminiResponse.response}`);
          // Try fallback extraction
          jobs = extractJobsFallback(geminiResponse.response);
          Logger.log(`Fallback extraction found ${jobs.length} jobs`);
        }
      }

      // Validate and clean the jobs
      const validJobs = jobs
        .filter(job => job && (job.company || job.jobTitle))
        .map(job => ({
          "Company": job.company || job.Company || "Unknown",
          "Company Description": job.companyDescription || job["Company Description"] || "",
          "Job Title": job.jobTitle || job["Job Title"] || "Unknown Position",
          "Location": normalizeLocation(job.location || job.Location || ""),
          "Minimum Salary": cleanSalaryValue(job.minSalary || job["Minimum Salary"]),
          "Maximum Salary": cleanSalaryValue(job.maxSalary || job["Maximum Salary"]),
          "Salary Period": job.salaryPeriod || job["Salary Period"] || "",
          // fix-nojobs-output-truncation: the jobUrl feature is removed (tracking
          // redirects the user does not use). Columns kept for sheet-schema
          // compatibility but always empty. This is a removed feature, not a fallback.
          "Job URL": "",
          "URL Status": "",
          "Employment Type": job.employmentType || job["Employment Type"] || "Unknown",
          "Work Arrangement": job.workArrangement || job["Work Arrangement"] || "Unknown",
          "Experience Level": job.experienceLevel || job["Experience Level"] || "Unknown",
          "_confidence": typeof job.confidence === "number" ? job.confidence : 1.0
        }));

      processingState.processedJobs = validJobs;
      return validJobs;

    } catch (apiError) {
      if (apiError.message && apiError.message.includes("429")) {
        Logger.log("Rate limit reached during job extraction");
        processingState.isPartiallyProcessed = true;
        throw new Error("RATE_LIMIT_REACHED");
      }
      
      Logger.log(`Error calling Gemini API: ${apiError}`);
      return [];
    }

  } catch (error) {
    Logger.log(`Error in extractJobDetailsSimple: ${error}`);
    
    if (error.message === "RATE_LIMIT_REACHED") {
      throw error;
    }
    
    return [];
  }
}

/**
 * Fallback extraction method when JSON parsing fails
 * @param {string} response - Raw response from Gemini
 * @returns {Array} Array of job objects
 */
function extractJobsFallback(response) {
  try {
    const jobs = [];
    
    // Try to extract job information using patterns
    const lines = response.split('\n');
    let currentJob = {};
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Look for company names
      if (trimmed.match(/company:?\s*(.+)/i)) {
        if (currentJob.company) {
          jobs.push(currentJob);
          currentJob = {};
        }
        currentJob.company = trimmed.match(/company:?\s*(.+)/i)[1].trim();
      }
      // Look for job titles
      else if (trimmed.match(/(?:job\s*)?title:?\s*(.+)/i)) {
        currentJob.jobTitle = trimmed.match(/(?:job\s*)?title:?\s*(.+)/i)[1].trim();
      }
      // Look for locations
      else if (trimmed.match(/location:?\s*(.+)/i)) {
        currentJob.location = trimmed.match(/location:?\s*(.+)/i)[1].trim();
      }
      // Look for salary
      else if (trimmed.match(/salary:?\s*(.+)/i)) {
        const salaryInfo = trimmed.match(/salary:?\s*(.+)/i)[1].trim();
        // Try to extract min/max from salary string
        const rangeMatch = salaryInfo.match(/\$?([\d,]+)\s*-\s*\$?([\d,]+)/);
        if (rangeMatch) {
          currentJob.minSalary = rangeMatch[1].replace(/,/g, '');
          currentJob.maxSalary = rangeMatch[2].replace(/,/g, '');
        }
      }
    }
    
    // Don't forget the last job
    if (currentJob.company || currentJob.jobTitle) {
      jobs.push(currentJob);
    }
    
    Logger.log(`Fallback extraction found ${jobs.length} jobs`);
    return jobs;
    
  } catch (error) {
    Logger.log(`Error in fallback extraction: ${error}`);
    return [];
  }
}

/**
 * Salvage complete job records from a Gemini JSON array that was truncated
 * mid-record (no closing `]`).
 *
 * APPROVED RECOVERY (fix-nojobs-output-truncation): when Gemini hits its
 * output-token limit (finishReason=MAX_TOKENS) the JSON array is cut off in the
 * middle of the last object with no closing bracket. The primary
 * `/\[[\s\S]*\]/` regex then returns null and the whole digest was misfiled as
 * NoJobs, silently dropping 15-25 real listings. Recovering the already-complete
 * records (everything up to the last balanced `}`) is the user-approved
 * behavior for this leg — it is NOT a value-substituting fallback; it parses the
 * jobs Gemini did emit and only the dangling partial record is discarded.
 *
 * Strategy: take the substring from the first `[`, cut back to the last complete
 * top-level `}`, append `]`, and JSON.parse. Returns [] if nothing parses.
 *
 * @param {string} response - Raw (possibly truncated) Gemini response text
 * @returns {Array} Array of complete job objects, or [] if unsalvageable
 */
function salvageTruncatedJobArray(response) {
  try {
    if (!response || typeof response !== 'string') return [];

    const start = response.indexOf('[');
    if (start === -1) return [];

    // Cut back to the last complete top-level object closer. The records Gemini
    // emits are flat objects with no nested braces, so the last `}` before the
    // truncation point closes the last complete record.
    const lastBrace = response.lastIndexOf('}');
    if (lastBrace === -1 || lastBrace < start) return [];

    const candidate = response.substring(start, lastBrace + 1) + ']';
    const parsed = JSON.parse(candidate);
    /* istanbul ignore next -- unreachable else: candidate always begins with the '[' at `start`, so a successful JSON.parse always yields an array; the `: []` arm cannot be taken. Defensive guard only. */
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    Logger.log(`Truncated-array salvage failed: ${e}`);
    return [];
  }
}

/**
 * Extract text content from HTML
 * @param {string} html - HTML content
 * @returns {Object} Object with plainText, extractedUrls, and anchorPairs
 */
function extractTextFromHtml(html) {
  try {
    // Extract anchor pairs BEFORE stripping tags so job titles can be matched to URLs
    const anchorPairs = extractAnchorPairs(html);

    // Extract URLs first
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const extractedUrls = [];
    let match;

    while ((match = urlRegex.exec(html)) !== null) {
      const url = match[0];
      // Clean up the URL
      const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
      if (!extractedUrls.includes(cleanUrl)) {
        extractedUrls.push(cleanUrl);
      }
    }

    // Remove high-volume noise BEFORE tag-stripping/truncation so the real job
    // text (often at the TAIL of digest/aggregator HTML) survives the prompt budget.
    // Order matters: comments first (they wrap MSO conditionals + VML), then
    // script/style blocks, then any stray VML/Office tags.
    //
    // 1. HTML comments — covers Outlook MSO conditional blocks
    //    (<!--[if mso]>...<![endif]-->) which carry VML button markup.
    let text = html.replace(/<!--[\s\S]*?-->/g, '');
    // 2. Script and style elements (style carries @font-face / CSS).
    text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    // 3. VML / Office namespaced elements (e.g. <v:roundrect>, <o:p>), both
    //    paired and self-closing, including their text content.
    text = text.replace(/<([vo]):([a-z]+)\b[^>]*>[\s\S]*?<\/\1:\2>/gi, '');
    text = text.replace(/<[vo]:[a-z]+\b[^>]*\/?>/gi, '');

    // Replace common HTML entities
    text = text.replace(/&nbsp;/gi, ' ');
    text = text.replace(/&amp;/gi, '&');
    text = text.replace(/&lt;/gi, '<');
    text = text.replace(/&gt;/gi, '>');
    text = text.replace(/&quot;/gi, '"');
    text = text.replace(/&#39;/gi, "'");

    // Replace br tags with newlines
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<\/div>/gi, '\n');
    text = text.replace(/<\/li>/gi, '\n');

    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Remove zero-width / invisible characters that digest emails (Indeed,
    // Glassdoor) inject between and inside words as obfuscation. Stripping them
    // reconnects words ("Nor​throp" -> "Northrop") and removes large junk runs
    // that otherwise eat into the prompt budget.
    // U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+200E LRM, U+200F RLM, U+FEFF BOM.
    text = text.replace(/[​‌‍‎‏﻿]/g, '');

    // Clean up whitespace
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    text = text.trim();

    return {
      plainText: text,
      extractedUrls: extractedUrls,
      anchorPairs: anchorPairs
    };

  } catch (error) {
    Logger.log(`Error extracting text from HTML: ${error}`);
    return {
      plainText: html,
      extractedUrls: [],
      anchorPairs: []
    };
  }
}

/**
 * Check if a job listing is valid
 * @param {Object} job - Job object to validate
 * @returns {boolean} True if valid
 */
function isValidJobListing(job) {
  // Must have at least a company or job title
  const hasCompany = job["Company"] && job["Company"] !== "Unknown";
  const hasTitle = job["Job Title"] && job["Job Title"] !== "Unknown Position";
  
  return hasCompany || hasTitle;
}

/**
 * Clean salary value.
 *
 * Returns a JavaScript Number when the cleaned value is fully numeric (so the
 * $#,##0 cell number-format applies and numeric sort works), or "" (empty
 * string) when the value is missing or non-numeric (e.g. "DOE", "Competitive").
 *
 * @param {*} salary - Raw salary value
 * @returns {number|string} A Number for numeric salaries, otherwise ""
 */
function cleanSalaryValue(salary) {
  if (salary === null || salary === undefined || salary === "") return "";

  // Convert to string and strip currency symbols / thousands separators.
  const cleaned = salary
    .toString()
    .trim()
    .replace(/[$,]/g, '')
    .trim();

  if (cleaned === "") return "";

  // Only treat as a salary if the whole string is a number (optionally decimal).
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return "";

  return Number(cleaned);
}

/**
 * Normalize a location string conservatively.
 *
 * Trims, collapses runs of internal whitespace to a single space, and
 * standardizes comma separators to ", " (e.g. "New York,NY" -> "New York, NY").
 * Does NOT invent or guess a location: an empty / whitespace-only input
 * returns "".
 *
 * @param {*} str - Raw location value
 * @returns {string} Normalized location, or "" when none
 */
function normalizeLocation(str) {
  if (str === null || str === undefined) return "";

  let s = str.toString().trim();
  if (s === "") return "";

  // Collapse any internal whitespace runs to a single space.
  s = s.replace(/\s+/g, ' ');

  // Standardize comma separators to ", " (handles "A,B", "A ,B", "A , B").
  s = s.replace(/\s*,\s*/g, ', ');

  return s.trim();
}

/**
 * Extract email source from the from field
 * @param {string} from - Email from field
 * @returns {string} Extracted source
 */
function extractEmailSource(from) {
  if (!from) return "Unknown";
  
  // Extract domain from email
  const emailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
  if (emailMatch) {
    const email = emailMatch[1];
    const domain = email.split('@')[1];
    
    // Extract the main part of domain (e.g., "indeed" from "indeed.com")
    const domainParts = domain.split('.');
    if (domainParts.length >= 2) {
      return domainParts[domainParts.length - 2];
    }
  }
  
  // If no email found, try to extract company name from display name
  const nameMatch = from.match(/^([^<]+)</);
  if (nameMatch) {
    return nameMatch[1].trim();
  }
  
  return from.substring(0, 50);
}

/**
 * Log Gemini API interaction
 * @param {string} type - Type of interaction
 * @param {Object} content - Content to log
 */
function logJobFinderGeminiInteraction(type, content) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp: timestamp,
      type: type,
      content: content
    };
    
    // Log to console
    Logger.log(`Gemini ${type}: ${JSON.stringify(logEntry)}`);
    
    // Could also save to a sheet or properties for debugging
    if (type === "error") {
      // Store errors for later analysis
      const errors = _exProps().getProperty("GEMINI_ERRORS");
      const errorList = errors ? JSON.parse(errors) : [];
      errorList.push(logEntry);
      
      // Keep only last 10 errors
      if (errorList.length > 10) {
        errorList.shift();
      }
      
      _exProps().setProperty(
        "GEMINI_ERRORS",
        JSON.stringify(errorList)
      );
    }
  } catch (error) {
    Logger.log(`Error logging Gemini interaction: ${error}`);
  }
}

// Conditional exports for testing (works in both Node.js and Apps Script)
/* istanbul ignore next -- the `typeof module` guard is always true under Node/Jest and always false in GAS; the false branch is never taken in the test runtime. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractAnchorPairs,
    buildExtractionPrompt,
    extractJobDetailsSimple,
    extractJobsFallback,
    salvageTruncatedJobArray,
    extractTextFromHtml,
    isValidJobListing,
    cleanSalaryValue,
    normalizeLocation,
    extractEmailSource,
    logJobFinderGeminiInteraction
  };
}
