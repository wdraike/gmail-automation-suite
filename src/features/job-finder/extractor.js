/**
 * Job Finder Extractor Module
 * Handles extraction of job details from email content using Gemini API
 */

/**
 * Cheap pre-check: asks Gemini whether the email contains job listings.
 * Uses only the first 2000 chars of the body to keep cost low.
 * @param {string} emailBody - Plain-text email body
 * @returns {boolean} true if the email appears to contain job listings
 */
function isJobListingEmail(emailBody) {
  const snippet = (emailBody || "").substring(0, 2000);
  const prompt = `Does this email contain job listings or job alerts? Reply with only YES or NO.\n\n${snippet}`;
  try {
    const result = callGeminiApi(prompt, "precheck");
    if (!result || !result.response) return false;
    return result.response.trim().toUpperCase().startsWith("YES");
  } catch (e) {
    Logger.log(`isJobListingEmail error: ${e}`);
    return false;
  }
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
          /^(click|track|email|go|r)\./i.test(hostname) ||
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

      // Exclude career platform tracking/assets
      if (lower.includes('phenompro.com') ||
          lower.includes('phenompeople.com') ||
          lower.includes('phenom.') ||
          lower.includes('careerconnect') ||
          lower.includes('assets.')) {
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
      // Exact-domain noise list; tracking subdomains checked separately via regex
      const ANCHOR_NOISE_DOMAINS = ['linkedin.com', 'twitter.com', 'facebook.com', 'instagram.com',
        'unsubscribe'];
      const ANCHOR_TRACKING_SUBDOMAIN_RE = /^(click|track|email|go|r)\./i;
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
    const prompt = `You are a job listing extraction assistant. Extract ALL job listings from the email below.

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
    "careersUrl": "",
    "employmentType": "Full-time|Part-time|Contract|Internship|Unknown",
    "workArrangement": "Remote|Hybrid|Onsite|Unknown",
    "experienceLevel": "Entry|Mid|Senior|Lead/Principal|Unknown",
    "confidence": 0.0
  }
]

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

    try {
      // Call Gemini API
      const geminiResponse = callGeminiApi(prompt, "job_extraction");
      
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
          "Location": job.location || job.Location || "",
          "Minimum Salary": cleanSalaryValue(job.minSalary || job["Minimum Salary"]),
          "Maximum Salary": cleanSalaryValue(job.maxSalary || job["Maximum Salary"]),
          "Salary Period": job.salaryPeriod || job["Salary Period"] || "",
          "Job URL": job.jobUrl || job["Job URL"] || "",
          "URL Status": job.jobUrl ? "Found" : "",
          "Careers URL": job.careersUrl || job["Careers URL"] || "",
          "Careers URL Status": job.careersUrl ? "Found" : "",
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

    // Remove script and style elements
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

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
 * Clean salary value
 * @param {*} salary - Raw salary value
 * @returns {string} Cleaned salary value
 */
function cleanSalaryValue(salary) {
  if (!salary) return "";
  
  // Convert to string and clean
  const salaryStr = salary.toString().trim();
  
  // Remove currency symbols and clean up
  return salaryStr
    .replace(/[$,]/g, '')
    .replace(/\.00$/, '')
    .trim();
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
      const errors = PropertiesService.getScriptProperties().getProperty("GEMINI_ERRORS");
      const errorList = errors ? JSON.parse(errors) : [];
      errorList.push(logEntry);
      
      // Keep only last 10 errors
      if (errorList.length > 10) {
        errorList.shift();
      }
      
      PropertiesService.getScriptProperties().setProperty(
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
    isJobListingEmail,
    extractAnchorPairs,
    extractJobDetailsSimple,
    extractJobsFallback,
    extractTextFromHtml,
    isValidJobListing,
    cleanSalaryValue,
    extractEmailSource,
    logJobFinderGeminiInteraction
  };
}
