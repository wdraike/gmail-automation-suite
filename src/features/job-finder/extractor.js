/**
 * Job Finder Extractor Module
 * Handles extraction of job details from email content using Gemini API
 */

/**
 * Extract job details directly from email text without chunking
 * @param {string} emailText - The full email text
 * @param {string[]} extractedUrls - All URLs extracted from the email
 * @param {object} processingState - State tracking for partial processing
 * @returns {Object[]} Array of job objects
 */
function extractJobDetailsSimple(emailText, extractedUrls, processingState) {
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
      if (lower.includes('sendgrid.net') ||
          lower.includes('ct.sendgrid.net') ||
          lower.includes('click.') ||
          lower.includes('track.') ||
          lower.includes('tracking') ||
          lower.includes('analytics') ||
          lower.includes('utm_') ||
          lower.includes('/wf/open') ||
          lower.includes('/wf/click') ||
          lower.includes('_opens') ||
          lower.includes('_clicks') ||
          lower.includes('mailings') ||
          lower.includes('email-track') ||
          lower.includes('e.') && lower.includes('.com/')) {
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

    // Prepare the prompt for Gemini
    const prompt = `You are a job listing extraction assistant. Extract ALL job listings from the email below.

RESPONSE FORMAT - Return ONLY a valid JSON array with NO additional text:
[
  {
    "company": "Company Name",
    "companyDescription": "Brief description if mentioned, otherwise empty string",
    "jobTitle": "Exact Job Title",
    "location": "City, State, Country",
    "minSalary": "",
    "maxSalary": "",
    "salaryPeriod": "",
    "jobUrl": "URL from the numbered list below if available, otherwise empty string",
    "careersUrl": ""
  }
]

CRITICAL RULES:
1. Return ONLY the JSON array - NO markdown, NO explanations, NO code blocks
2. If no jobs found, return: []
3. Extract ALL jobs from the email
4. For jobUrl, use the URL number from the list below (e.g., if URL #3 matches, use that full URL)
5. Leave salary fields as empty strings if not mentioned

${urlSection}

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
          "Location": job.location || job.Location || "Not specified",
          "Minimum Salary": cleanSalaryValue(job.minSalary || job["Minimum Salary"]),
          "Maximum Salary": cleanSalaryValue(job.maxSalary || job["Maximum Salary"]),
          "Salary Period": job.salaryPeriod || job["Salary Period"] || "",
          "Job URL": job.jobUrl || job["Job URL"] || "",
          "URL Status": job.jobUrl ? "Found" : "Not found",
          "Careers URL": job.careersUrl || job["Careers URL"] || inferCareersUrl(job.jobUrl),
          "Careers URL Status": job.careersUrl ? "Found" : "Inferred"
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
 * @returns {Object} Object with plainText and extractedUrls
 */
function extractTextFromHtml(html) {
  try {
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
      extractedUrls: extractedUrls
    };
    
  } catch (error) {
    Logger.log(`Error extracting text from HTML: ${error}`);
    return {
      plainText: html,
      extractedUrls: []
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
 * Infer careers URL from job URL
 * @param {string} jobUrl - Job posting URL
 * @returns {string} Inferred careers URL
 */
function inferCareersUrl(jobUrl) {
  if (!jobUrl) return "";
  
  try {
    const url = new URL(jobUrl);
    const domain = url.hostname;
    
    // Common careers page patterns
    const patterns = [
      '/careers',
      '/jobs',
      '/opportunities',
      '/work-with-us',
      '/join-us',
      '/employment'
    ];
    
    // Check if URL already contains a careers pattern
    for (const pattern of patterns) {
      if (url.pathname.includes(pattern)) {
        // Return the base careers URL
        return `${url.protocol}//${domain}${pattern}`;
      }
    }
    
    // Default to /careers
    return `${url.protocol}//${domain}/careers`;
    
  } catch (error) {
    return "";
  }
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
 * Process email content with rate limiting awareness
 * @param {string} content - Email content
 * @param {Array} extractedUrls - URLs found in email
 * @param {string} contentId - Unique ID for this content
 * @returns {Object} Processing result
 */
function processEmailContent(content, extractedUrls, contentId) {
  try {
    const processingState = {
      isPartiallyProcessed: false,
      processedJobs: []
    };
    
    const jobs = extractJobDetailsSimple(content, extractedUrls, processingState);
    
    return {
      success: true,
      jobs: jobs,
      isPartiallyProcessed: processingState.isPartiallyProcessed,
      contentId: contentId
    };
    
  } catch (error) {
    if (error.message === "RATE_LIMIT_REACHED") {
      return {
        success: false,
        jobs: [],
        isPartiallyProcessed: true,
        error: "RATE_LIMIT_REACHED",
        contentId: contentId
      };
    }
    
    return {
      success: false,
      jobs: [],
      isPartiallyProcessed: false,
      error: error.toString(),
      contentId: contentId
    };
  }
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
    extractJobDetailsSimple,
    extractJobsFallback,
    extractTextFromHtml,
    isValidJobListing,
    cleanSalaryValue,
    inferCareersUrl,
    extractEmailSource,
    processEmailContent,
    logJobFinderGeminiInteraction
  };
}
