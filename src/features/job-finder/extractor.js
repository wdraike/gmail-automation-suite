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
  if (typeof require !== 'undefined') {
    return require('../../core/services/index.js').serviceFactory;
  }
  throw new Error('serviceFactory is not available');
}

function _exGemini() {
  return _exServiceFactory().getGeminiAdapter();
}

function _exProps() {
  return _exServiceFactory().getPropertiesAdapter();
}

// Module-level constants for anchor/URL noise filtering — hoisted to avoid
// recreating these on every call to extractJobDetailsSimple.
const ANCHOR_NOISE_DOMAINS = ['linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com',
  'unsubscribe'];
// Matches tracking/redirect subdomains: click., track., email., go., r.
// Hostname-anchored so 'clickup.com' or 'career.com' are not falsely caught.
const ANCHOR_TRACKING_SUBDOMAIN_RE = /^(click|track|email|go|r)\./i;

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
 * @param {string} textToProcess - Cleaned/truncated email body
 * @param {string} urlSection - Pre-formatted "Job Application URLs" block
 * @param {string} anchorSection - Pre-formatted link-text→URL mappings block
 * @returns {string} The full prompt string
 */
function buildExtractionPrompt(textToProcess, urlSection, anchorSection) {
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
    "jobUrl": "URL from the numbered list or link mappings below that matches this job title, otherwise empty string",
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
4. For jobUrl, match the job title to the link text in the mappings section below, then use the corresponding URL
5. Leave salary fields as empty strings if not mentioned
6. confidence: number 0.0-1.0 — how confident you are this row is a real job listing (not an ad or filler)

${urlSection}
${anchorSection}

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

    // Comprehensive URL filtering to remove tracking, analytics, social media, and images
    const relevantUrls = extractedUrls.filter(url => {
      const lower = url.toLowerCase();

      // Exclude email tracking and analytics
      // Use hostname-anchored regex for subdomain checks to avoid false positives
      // (e.g. 'click.' substring would wrongly filter clickup.com)
      let hostname = '';
      try { hostname = new URL(url).hostname.toLowerCase(); } catch (e) { hostname = ''; }
      if (lower.includes('sendgrid.net') ||
          ANCHOR_TRACKING_SUBDOMAIN_RE.test(hostname) ||
          lower.includes('tracking') ||
          lower.includes('analytics') ||
          lower.includes('utm_') ||
          lower.includes('/wf/open') ||
          lower.includes('/wf/click') ||
          lower.includes('_opens') ||
          lower.includes('_clicks') ||
          lower.includes('mailings') ||
          lower.includes('email-track')) {
        return false;
      }

      // Exclude career platform tracking/assets.
      // Use hostname-anchored checks for 'assets.' and 'phenom.' to avoid
      // false positives on paths like '/assets/' or legitimate domains
      // that happen to contain these strings elsewhere.
      if (lower.includes('phenompro.com') ||
          lower.includes('phenompeople.com') ||
          /^phenom\./i.test(hostname) ||
          lower.includes('careerconnect') ||
          /^assets\./i.test(hostname)) {
        return false;
      }

      // Exclude images and media files
      if (lower.match(/\.(png|jpg|jpeg|gif|svg|webp|ico|bmp)($|[\?#])/)) {
        return false;
      }

      // Exclude social media
      if (lower.includes('linkedin.com') ||
          lower.includes('facebook.com') ||
          lower.includes('twitter.com') ||
          lower.includes('x.com') ||
          lower.includes('instagram.com') ||
          lower.includes('tiktok.com') ||
          lower.includes('youtube.com')) {
        return false;
      }

      // Exclude unsubscribe and preference links
      if (lower.includes('unsubscribe') ||
          lower.includes('optout') ||
          lower.includes('preferences') ||
          lower.includes('manage-email')) {
        return false;
      }

      // Exclude very long URLs (usually tracking)
      if (url.length > 500) {
        return false;
      }

      return true;
    });

    // Deduplicate and clean URLs
    const uniqueUrls = [...new Set(relevantUrls)].map(url => {
      // Remove tracking parameters
      try {
        const urlObj = new URL(url);
        // Remove common tracking params
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                                'ref', 'source', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'];
        trackingParams.forEach(param => urlObj.searchParams.delete(param));
        return urlObj.toString();
      } catch (e) {
        return url; // Return original if URL parsing fails
      }
    });

    Logger.log(`Filtered URLs: ${extractedUrls.length} -> ${uniqueUrls.length} relevant URLs`);

    // Format URLs for better readability in prompt
    let urlSection = '';
    if (uniqueUrls.length > 0) {
      urlSection = 'Job Application URLs:\n' + uniqueUrls.map((url, index) => `${index + 1}. ${url}`).join('\n');
    } else {
      urlSection = 'No direct job application URLs found in this email.';
    }

    // Include anchor text/URL pairs to help match job titles to their apply links
    let anchorSection = '';
    if (anchorPairs && anchorPairs.length > 0) {
      const filteredPairs = anchorPairs
        .filter(p => {
          const href = (p.url || '').toLowerCase();
          if (ANCHOR_NOISE_DOMAINS.some(d => href.includes(d))) return false;
          try {
            const anchorHost = new URL(p.url).hostname.toLowerCase();
            if (ANCHOR_TRACKING_SUBDOMAIN_RE.test(anchorHost)) return false;
          } catch (e) { /* malformed URL — keep it */ }
          return true;
        })
        .slice(0, 30);
      if (filteredPairs.length > 0) {
        anchorSection = '\nLink Text → URL Mappings (use these to match job titles to apply links):\n' +
          filteredPairs.map(p => `"${p.text}" → ${p.url}`).join('\n');
      }
    }

    // Prepare the prompt for Gemini
    const prompt = buildExtractionPrompt(textToProcess, urlSection, anchorSection);

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
        Logger.log(`Gemini response length: ${geminiResponse.response ? geminiResponse.response.length : 'null'}`);
        Logger.log(`First 200 chars of response: ${geminiResponse.response ? geminiResponse.response.substring(0, 200) : 'null'}`);

        // Extract JSON from the response
        const jsonMatch = geminiResponse.response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          Logger.log(`Found JSON match, length: ${jsonMatch[0].length}`);
          jobs = JSON.parse(jsonMatch[0]);
          Logger.log(`Parsed ${jobs.length} jobs from JSON`);
        } else {
          Logger.log("No JSON array found in Gemini response");
          Logger.log(`Full response: ${geminiResponse.response}`);
          return [];
        }
      } catch (parseError) {
        Logger.log(`Error parsing Gemini response: ${parseError}`);
        Logger.log(`Response that failed to parse: ${geminiResponse.response}`);
        // Try fallback extraction
        jobs = extractJobsFallback(geminiResponse.response);
        Logger.log(`Fallback extraction found ${jobs.length} jobs`);
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
          "Job URL": job.jobUrl || job["Job URL"] || "",
          "URL Status": job.jobUrl ? "Found" : "",
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
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractAnchorPairs,
    buildExtractionPrompt,
    extractJobDetailsSimple,
    extractJobsFallback,
    extractTextFromHtml,
    isValidJobListing,
    cleanSalaryValue,
    normalizeLocation,
    extractEmailSource,
    logJobFinderGeminiInteraction
  };
}
