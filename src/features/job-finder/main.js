/**
 * Job Finder Main Module
 * Core job email processing functionality - refactored for clarity
 */

/**
 * Main orchestrator function to process job alert emails
 * @returns {Object} Results of the processing
 */
function processJobEmailsMain() {
  try {
    Logger.log("=== Starting job email processing ===");

    // Step 1: Initialize system
    const initResult = initializeJobFinder();
    if (!initResult.success) {
      Logger.log(`Failed to initialize job finder: ${initResult.message}`);
      return {
        success: false,
        message: initResult.message,
        processedCount: 0,
        totalJobs: 0,
      };
    }

    // Step 2: Get email threads to process
    const threadsResult = getEmailThreadsToProcess();
    if (!threadsResult.success) {
      return {
        success: threadsResult.success,
        message: threadsResult.message,
        processedCount: 0,
        totalJobs: 0,
      };
    }

    const threads = threadsResult.threads;
    if (threads.length === 0) {
      Logger.log("No threads to process");
      return {
        success: true,
        message: "No new job emails found",
        processedCount: 0,
        totalJobs: 0,
      };
    }

    Logger.log(`Processing ${threads.length} email thread(s)`);

    // Step 3: Process the batch of emails
    const batchResult = processEmailBatch(threads);

    // Step 4: Log results
    Logger.log(`=== Job email processing complete ===`);
    Logger.log(`Processed: ${batchResult.processedCount} emails, Found: ${batchResult.totalJobs} jobs`);

    return {
      success: true,
      message: `Successfully processed ${batchResult.processedCount} emails and found ${batchResult.totalJobs} jobs`,
      processedCount: batchResult.processedCount,
      totalJobs: batchResult.totalJobs,
      jobs: batchResult.allJobs,
    };

  } catch (error) {
    Logger.log(`Error in processJobEmailsMain: ${error}`);

    if (error.message === "RATE_LIMIT_REACHED") {
      return {
        success: false,
        message: "Gemini API rate limit reached. Emails have been queued for later processing.",
        processedCount: 0,
        totalJobs: 0,
      };
    }

    sendNotificationEmail({
      isError: true,
      errorMessage: error.toString(),
      jobCount: 0,
      jobs: []
    });

    return {
      success: false,
      message: `Error: ${error.toString()}`,
      processedCount: 0,
      totalJobs: 0,
    };
  }
}

/**
 * Get email threads to process from Gmail labels
 * Fetches threads from source label and rate-limited queue
 * @returns {Object} {success, threads, message}
 */
function getEmailThreadsToProcess() {
  try {
    // Get the source label (e.g., "JobAlerts")
    const sourceLabel = GmailService.labels.getLabelSafe(JOB_FINDER_CONFIG.SOURCE_LABEL);
    if (!sourceLabel) {
      return {
        success: false,
        message: `Source label "${JOB_FINDER_CONFIG.SOURCE_LABEL}" not found. Please create this label.`,
        threads: []
      };
    }

    // Get new threads from source label (limit to 5 to avoid long execution times)
    const MAX_EMAILS_PER_RUN = 5;
    const threads = sourceLabel.getThreads(0, MAX_EMAILS_PER_RUN);
    Logger.log(`Found ${threads.length} new thread(s) in "${JOB_FINDER_CONFIG.SOURCE_LABEL}" (max ${MAX_EMAILS_PER_RUN} per run)`);

    // Check for rate-limited threads from previous runs (prioritize these)
    const rateLimitLabel = GmailService.labels.getLabelSafe(JOB_FINDER_CONFIG.RATE_LIMIT_LABEL);
    if (rateLimitLabel) {
      const rateLimitedThreads = rateLimitLabel.getThreads(0, 3);
      if (rateLimitedThreads.length > 0) {
        Logger.log(`Found ${rateLimitedThreads.length} rate-limited thread(s) from previous run`);
        // Add rate-limited threads but keep total at MAX_EMAILS_PER_RUN
        threads.unshift(...rateLimitedThreads);
        // Trim to max
        if (threads.length > MAX_EMAILS_PER_RUN) {
          threads.length = MAX_EMAILS_PER_RUN;
          Logger.log(`Limiting to ${MAX_EMAILS_PER_RUN} total threads (rate-limited + new)`);
        }
      }
    }

    return {
      success: true,
      threads: threads,
      message: `Found ${threads.length} thread(s) to process`
    };

  } catch (error) {
    Logger.log(`Error getting email threads: ${error}`);
    return {
      success: false,
      message: error.toString(),
      threads: []
    };
  }
}

/**
 * Extract content and metadata from an email thread
 * @param {GmailThread} thread - Gmail thread to extract from
 * @returns {Object} Email content and metadata
 */
function extractEmailContent(thread) {
  try {
    const messages = thread.getMessages();
    const message = messages[messages.length - 1]; // Get latest message

    // Extract basic info
    const subject = message.getSubject();
    const body = message.getBody();
    const date = message.getDate();
    const from = message.getFrom();
    const source = extractEmailSource(from);

    // Parse HTML to get plain text and URLs
    const { plainText, extractedUrls } = extractTextFromHtml(body);

    return {
      thread: thread,
      subject: subject,
      body: body,
      plainText: plainText,
      urls: extractedUrls,
      date: date,
      from: from,
      source: source
    };

  } catch (error) {
    Logger.log(`Error extracting email content: ${error}`);
    throw error;
  }
}

/**
 * Extract jobs from email content using Gemini API
 * @param {Object} emailContent - Email content from extractEmailContent()
 * @returns {Object} {jobs, wasRateLimited}
 */
function extractJobsFromEmail(emailContent) {
  try {
    const processingState = {
      isPartiallyProcessed: false,
      processedJobs: []
    };

    const jobDetails = extractJobDetailsSimple(
      emailContent.plainText,
      emailContent.urls,
      processingState
    );

    return {
      jobs: jobDetails || [],
      wasRateLimited: processingState.isPartiallyProcessed
    };

  } catch (error) {
    if (error.message === "RATE_LIMIT_REACHED") {
      return {
        jobs: [],
        wasRateLimited: true
      };
    }
    throw error;
  }
}

/**
 * Save extracted jobs to CSV file
 * @param {Array} jobs - Array of job objects
 * @param {Object} metadata - Email metadata {subject, source, date}
 * @returns {Object} {success, fileName, message}
 */
function saveJobsToCsv(jobs, metadata) {
  try {
    if (!jobs || jobs.length === 0) {
      return {
        success: true,
        fileName: null,
        message: "No jobs to save"
      };
    }

    // Filter valid jobs
    const validJobs = jobs.filter(job => isValidJobListing(job));

    if (validJobs.length === 0) {
      Logger.log("No valid jobs to save after filtering");
      return {
        success: true,
        fileName: null,
        message: "No valid jobs after filtering"
      };
    }

    // Enrich jobs with email metadata for all spreadsheet columns
    const enrichedJobs = validJobs.map(job => ({
      ...job,
      "Email Received Date": metadata.date ? formatDateTime(metadata.date) : "",
      "Email Source": metadata.source || "",
      "Date Added": formatDateTime(new Date()),
      "Interest": "",  // User fills this in manually
      "Email Title": metadata.subject || "",
      "Jobs Found In Email": validJobs.length.toString()
    }));

    // Write to CSV
    const csvResult = writeJobsToCsv(enrichedJobs);

    if (csvResult.success) {
      Logger.log(`Saved ${validJobs.length} job(s) to CSV: ${csvResult.fileName}`);
      return {
        success: true,
        fileName: csvResult.fileName,
        message: `Saved ${validJobs.length} jobs`,
        savedJobs: validJobs
      };
    } else {
      Logger.log(`Failed to save jobs to CSV: ${csvResult.message}`);
      return {
        success: false,
        fileName: null,
        message: csvResult.message
      };
    }

  } catch (error) {
    Logger.log(`Error saving jobs to CSV: ${error}`);
    return {
      success: false,
      fileName: null,
      message: error.toString()
    };
  }
}

/**
 * Mark email thread as successfully processed
 * Adds processed label, removes source label, archives thread
 * @param {GmailThread} thread - Thread to mark
 */
function markEmailAsProcessed(thread) {
  try {
    const processedLabel = GmailService.labels.getOrCreateLabel(JOB_FINDER_CONFIG.PROCESSED_LABEL);
    const sourceLabel = GmailService.labels.getLabelSafe(JOB_FINDER_CONFIG.SOURCE_LABEL);
    const rateLimitLabel = GmailService.labels.getLabelSafe(JOB_FINDER_CONFIG.RATE_LIMIT_LABEL);

    thread.addLabel(processedLabel);
    if (sourceLabel) thread.removeLabel(sourceLabel);
    if (rateLimitLabel) thread.removeLabel(rateLimitLabel);
    thread.moveToArchive();

    Logger.log(`Marked thread as processed`);

  } catch (error) {
    Logger.log(`Error marking thread as processed: ${error}`);
  }
}

/**
 * Mark email thread as rate-limited for later processing
 * @param {GmailThread} thread - Thread to mark
 */
function markEmailAsRateLimited(thread) {
  try {
    const rateLimitLabel = GmailService.labels.getOrCreateLabel(JOB_FINDER_CONFIG.RATE_LIMIT_LABEL);
    thread.addLabel(rateLimitLabel);
    Logger.log(`Marked thread as rate-limited for later processing`);

  } catch (error) {
    Logger.log(`Error marking thread as rate-limited: ${error}`);
  }
}

/**
 * Process a single email thread to extract jobs and save to CSV
 * @param {GmailThread} thread - Gmail thread to process
 * @param {number} threadIndex - Index for logging
 * @param {number} totalThreads - Total threads for logging
 * @returns {Object} {success, jobCount, jobs}
 */
function processOneEmail(thread, threadIndex, totalThreads) {
  try {
    // Extract email content
    const emailContent = extractEmailContent(thread);
    Logger.log(`[${threadIndex}/${totalThreads}] Processing: "${emailContent.subject}"`);

    // Extract jobs from email
    const extractionResult = extractJobsFromEmail(emailContent);

    // Handle rate limiting
    if (extractionResult.wasRateLimited) {
      markEmailAsRateLimited(thread);
      return {
        success: false,
        jobCount: 0,
        jobs: [],
        wasRateLimited: true
      };
    }

    // Log extraction results
    if (extractionResult.jobs.length === 0) {
      Logger.log(`No jobs found in "${emailContent.subject}"`);
    } else {
      Logger.log(`Found ${extractionResult.jobs.length} job(s) in "${emailContent.subject}"`);
    }

    // Save jobs to CSV
    const saveResult = saveJobsToCsv(extractionResult.jobs, {
      subject: emailContent.subject,
      source: emailContent.source,
      date: emailContent.date
    });

    // Mark email as processed
    markEmailAsProcessed(thread);

    return {
      success: true,
      jobCount: saveResult.savedJobs ? saveResult.savedJobs.length : 0,
      jobs: saveResult.savedJobs || [],
      wasRateLimited: false
    };

  } catch (error) {
    Logger.log(`Error processing email thread: ${error}`);

    // If rate limit, throw to stop batch processing
    if (error.message === "RATE_LIMIT_REACHED") {
      markEmailAsRateLimited(thread);
      throw error;
    }

    // For other errors, mark as processed to avoid retry loops
    markEmailAsProcessed(thread);

    return {
      success: false,
      jobCount: 0,
      jobs: [],
      error: error.toString()
    };
  }
}

/**
 * Process a batch of email threads
 * @param {GmailThread[]} threads - Array of threads to process
 * @returns {Object} Batch processing results
 */
function processEmailBatch(threads) {
  const results = {
    processedCount: 0,
    totalJobs: 0,
    allJobs: [],
    errors: []
  };

  try {
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i];

      try {
        const result = processOneEmail(thread, i + 1, threads.length);

        if (result.wasRateLimited) {
          Logger.log(`Rate limit reached. Stopping batch processing.`);
          throw new Error("RATE_LIMIT_REACHED");
        }

        if (result.success) {
          results.processedCount++;
          results.totalJobs += result.jobCount;
          if (result.jobs.length > 0) {
            results.allJobs.push(...result.jobs);
          }
        } else if (result.error) {
          results.errors.push(result.error);
        }

      } catch (threadError) {
        if (threadError.message === "RATE_LIMIT_REACHED") {
          throw threadError; // Propagate rate limit errors
        }

        Logger.log(`Error processing thread ${i + 1}: ${threadError}`);
        results.errors.push(threadError.toString());
      }

      // Brief pause between emails
      if (i < threads.length - 1) {
        Utilities.sleep(500);
      }
    }

    return results;

  } catch (error) {
    if (error.message === "RATE_LIMIT_REACHED") {
      Logger.log(`Batch processing stopped due to rate limit. Processed ${results.processedCount} emails.`);
      throw error;
    }

    Logger.log(`Error in batch processing: ${error}`);
    return results;
  }
}

/**
 * Initialize the job finder system
 * Creates spreadsheet and Gmail labels if needed
 * @returns {Object} Initialization result
 */
function initializeJobFinder() {
  try {
    // Check if spreadsheet exists
    let spreadsheetId = getJobFinderSpreadsheetId();

    if (!spreadsheetId) {
      // Create new spreadsheet
      const spreadsheet = SpreadsheetApp.create("Job Listings");
      spreadsheetId = spreadsheet.getId();

      // Save the ID
      PropertiesService.getScriptProperties().setProperty(
        "JOB_FINDER_SPREADSHEET_ID",
        spreadsheetId
      );

      Logger.log(`Created new job listings spreadsheet with ID: ${spreadsheetId}`);

      // Set up the sheet
      const sheet = spreadsheet.getActiveSheet();
      sheet.setName(JOB_FINDER_CONFIG.ACTIVE_SHEET_NAME);

      // Set up headers
      const headers = [...JOB_FINDER_CONFIG.SHEET_COLUMNS];
      if (!headers.includes("Email Title")) {
        headers.push("Email Title");
      }
      if (!headers.includes("Jobs Found In Email")) {
        headers.push("Jobs Found In Email");
      }

      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    // Create required labels
    const requiredLabels = [
      JOB_FINDER_CONFIG.SOURCE_LABEL,
      JOB_FINDER_CONFIG.PROCESSED_LABEL,
      JOB_FINDER_CONFIG.RATE_LIMIT_LABEL
    ];

    for (const labelName of requiredLabels) {
      GmailService.labels.getOrCreateLabel(labelName);
    }

    Logger.log("Job finder initialized successfully");

    return {
      success: true,
      message: "Job finder initialized successfully",
      spreadsheetId: spreadsheetId
    };

  } catch (error) {
    Logger.log(`Error initializing job finder: ${error}`);
    return {
      success: false,
      message: `Failed to initialize job finder: ${error.toString()}`
    };
  }
}

/**
 * Get the Job Finder spreadsheet ID from properties
 * @returns {string|null} Spreadsheet ID or null
 */
function getJobFinderSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty("JOB_FINDER_SPREADSHEET_ID");
}

/**
 * Update job finder configuration
 * @param {Object} newConfig - New configuration values
 * @returns {Object} Update result
 */
function updateJobFinderConfig(newConfig) {
  try {
    const props = PropertiesService.getScriptProperties();

    // Update each config value
    Object.entries(newConfig).forEach(([key, value]) => {
      props.setProperty(`JOB_FINDER_${key}`, value.toString());
    });

    return {
      success: true,
      message: "Configuration updated successfully"
    };
  } catch (error) {
    Logger.log(`Error updating job finder config: ${error}`);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * Set up a trigger to run the job finder periodically
 * @returns {string} Success message
 */
function setupJobFinderTrigger() {
  try {
    // Remove any existing triggers
    const triggers = ScriptApp.getProjectTriggers();
    for (const trigger of triggers) {
      if (trigger.getHandlerFunction() === "processJobEmailsMain" ||
          trigger.getHandlerFunction() === "importPendingJobCsvs") {
        ScriptApp.deleteTrigger(trigger);
      }
    }

    // Create a new time-based trigger to run every hour
    ScriptApp.newTrigger("processJobEmailsMain")
      .timeBased()
      .everyHours(1)
      .create();

    const message = `Trigger set up to run job finder every hour`;
    Logger.log(message);
    return message;
  } catch (error) {
    Logger.log(`Error setting up job finder trigger: ${error}`);
    return `Error: ${error.toString()}`;
  }
}

// Conditional exports for testing (works in both Node.js and Apps Script)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    processJobEmailsMain,
    getEmailThreadsToProcess,
    extractEmailContent,
    extractJobsFromEmail,
    saveJobsToCsv,
    markEmailAsProcessed,
    markEmailAsRateLimited,
    processOneEmail,
    processEmailBatch,
    initializeJobFinder,
    getSpreadsheetId,
    updateJobFinderConfig,
    setupJobFinderTrigger
  };
}
