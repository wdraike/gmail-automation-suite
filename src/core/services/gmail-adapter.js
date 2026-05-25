/**
 * Gmail Service Adapter
 * Provides a testable wrapper around GmailApp
 * This adapter allows dependency injection and easier testing
 */

class GmailAdapter {
  constructor(gmailApp = GmailApp) {
    this.gmail = gmailApp;
  }

  /**
   * Get a thread by ID
   */
  getThreadById(id) {
    return this.gmail.getThreadById(id);
  }

  /**
   * Get or create a label
   */
  getUserLabelByName(name) {
    return this.gmail.getUserLabelByName(name);
  }

  /**
   * Create a new label
   */
  createLabel(name) {
    return this.gmail.createLabel(name);
  }

  /**
   * Search for threads
   */
  search(query, start = 0, max = 500) {
    return this.gmail.search(query, start, max);
  }

  /**
   * Send an email
   */
  sendEmail(recipient, subject, body, options = {}) {
    return MailApp.sendEmail(recipient, subject, body, options);
  }

  /**
   * Get user's email address
   */
  getUserEmailAddress() {
    return Session.getEffectiveUser().getEmail();
  }

  /**
   * Get or create a label (ensures label exists)
   */
  getOrCreateLabel(name) {
    let label = this.getUserLabelByName(name);
    if (!label) {
      label = this.createLabel(name);
    }
    return label;
  }

  /**
   * Search for threads with a specific label
   */
  searchByLabel(labelName, start = 0, max = 500) {
    return this.search(`label:${labelName}`, start, max);
  }

  /**
   * Search for unread threads with a specific label
   */
  searchUnreadByLabel(labelName, start = 0, max = 500) {
    return this.search(`label:${labelName} is:unread`, start, max);
  }

  /**
   * Batch process threads with rate limiting
   */
  async batchProcessThreads(threads, processor, batchSize = 5, delayMs = 1000) {
    const results = [];

    for (let i = 0; i < threads.length; i += batchSize) {
      const batch = threads.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(thread => processor(thread))
      );

      results.push(...batchResults);

      // Delay between batches
      if (i + batchSize < threads.length && delayMs > 0) {
        Utilities.sleep(delayMs);
      }
    }

    return results;
  }
}

// Export for both GAS and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GmailAdapter };
}
