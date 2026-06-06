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
   * Get inbox threads
   */
  getInboxThreads(start = 0, max = 50) {
    return this.gmail.getInboxThreads(start, max);
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
   * Get all user labels with caching + system labels.
   *
   * Relocated verbatim from the legacy GmailLabelService.getAllLabels so feature
   * code can consolidate onto GmailAdapter. The 5-minute CacheService cache, the
   * prepended system labels, and the `return []` on error are pre-existing behavior
   * preserved exactly (not a new fallback).
   *
   * @param {boolean} forceRefresh - Force refresh the cache
   * @returns {Array<Object>} Array of label objects with name and type
   */
  getAllLabels(forceRefresh = false) {
    const cacheKey = 'GMAIL_LABELS_CACHE';
    const cacheExpiry = 300; // 5 minutes

    if (!forceRefresh) {
      const cached = CacheService.getScriptCache().get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      const labels = this.gmail.getUserLabels();

      const labelData = labels.map(label => ({
        name: label.getName(),
        type: 'user'
      }));

      // Add system labels
      const systemLabels = ['INBOX', 'STARRED', 'IMPORTANT', 'SENT', 'DRAFT', 'SPAM', 'TRASH'];
      systemLabels.forEach(name => {
        labelData.unshift({ name, type: 'system' });
      });

      // Cache the results
      CacheService.getScriptCache().put(cacheKey, JSON.stringify(labelData), cacheExpiry);

      return labelData;
    } catch (error) {
      Logger.log(`Error getting labels: ${error}`);
      return [];
    }
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
